# Student accounts and paid registration — design

**Date:** 2026-08-22
**Status:** Approved for planning
**Companion document:** `payment-flow-review.md` (project root) records the six defects
found in an earlier draft of the payment flow and why each correction was made. Read it
before changing anything in the payment path.

---

## Problem

Registration is currently free, public, and unauthenticated. Two changes are wanted:

1. **Students must sign in with Google or Microsoft before they can register.** Today
   anyone can type any email address, including one they don't own or one that doesn't
   exist. Since the reference code and all shortlist correspondence go to that address,
   a typo produces an applicant nobody can contact.
2. **Registration becomes paid.** Students pay a fee via Razorpay as part of applying.

These are two independent subsystems. They ship in that order — auth first, payment
second — so that each is verifiable on its own.

## What this reverses, deliberately

`README.md` states: *"Students have no accounts. Registration is a public form
returning an on-screen reference code. This removes an auth surface and avoids
per-student email volume."*

That decision is being reversed on purpose. The reasoning that replaces it: collecting
money requires knowing who paid, and a verified identity is the cheapest way to get a
trustworthy email address and a stable per-person key. The README must be updated as
part of this work — leaving it contradicting the code is not acceptable.

**Recruiter functionality is out of scope and must not change.** `recruiterMemberships`,
`requireRecruiter`, `/portal`, `canActForCompany`, and the bundle release rules stay
exactly as they are. The only recruiter-adjacent edit is defensive: adding `"student"`
to the `Role` union forces each policy function to state what a student gets, and the
answer is always `false`.

## Non-goals

- No student dashboard or "my application" page. Accounts exist to gate registration
  and payment, nothing more.
- No automated refunds. Refunds are performed by a human in the Razorpay dashboard.
- No changes to screening, bundles, or the recruiter portal.

---

## Part 1 — Student accounts

### Roles

`Role` becomes `"admin" | "recruiter" | "student"`.

Admin and recruiter are **granted** roles: a human sets `publicMetadata.role` in Clerk.
Student is the **default** — any signed-in account without a granted role is a student.
This is required because students self-serve; there is nobody to provision them.

`getActor()` currently returns `null` when no role is set. It will return a student
actor instead.

### The security risk this creates

Today, "signed in but no role" means *no access to anything*. After this change it means
*student*. Any authorization check that relies on `getActor()` returning `null` to deny
access would silently begin allowing students through.

Mitigation, and the highest-value testing in this feature:

- Audit every call site of `getActor()`, `requireActor()`, `requireAdmin()`,
  `requireRecruiter()`.
- Add explicit `student → false` branches to `canActForCompany`,
  `canReadStudentResume`, and `canViewBundle` in `src/lib/access-policy.ts`.
- Extend the existing policy tests with student cases for every function. A mistake here
  exposes candidate PII.

Add `requireStudent()` for the registration flow.

### Sign-in

Clerk with Google and Microsoft OAuth enabled — a Clerk dashboard configuration step,
not code. Clerk is already provisioned and its CSP allowances are already in place.

### What identity supplies

- **Email** comes from the verified OAuth identity and is no longer a form field. This
  is what solves the "enter a real address" problem — completely, rather than by
  validation.
- **Full name** is pre-filled from the OAuth profile but stays editable. Google profile
  names are often informal or missing a surname, and this name is what recruiters see.

### Public vs. gated

Browsing stays fully public and anonymous: homepage, track record, FAQ, partner pages.
Sign-in is never forced on a visitor.

Only registration is gated. "Register Now" while signed out routes to sign-in, then
back.

**A signed-in account creates no database row.** Someone who signs in, looks at the
form, and leaves exists only in Clerk. The `students` table only ever contains people
who submitted the form.

---

## Part 2 — Data model

### `students` — modified

| Column | Change | Why |
|---|---|---|
| `clerkUserId` | new, `varchar(64)`, unique, nullable | Links the row to the account. **Replaces email as the duplicate check** — one application per account, keyed on a stable ID rather than a typed string. Nullable because existing test rows predate accounts. |
| `paymentStatus` | new enum `pending_payment \| paid \| failed`, default `pending_payment` | Separates a started application from a real one. |
| `paidAt` | new, nullable timestamp | Receipt trail. |
| `refCode` | **becomes nullable** | Issued only when payment confirms. An unpaid row genuinely has no reference code — the rule is enforced by the schema, not just the UI. |
| `email` | unchanged column, new source | Populated from verified OAuth identity. |

`razorpayOrderId` deliberately does **not** live here. See Defect 1 in
`payment-flow-review.md`.

### `paymentOrders` — new

One row per payment attempt.

| Column | Notes |
|---|---|
| `id` | serial PK |
| `studentId` | FK → `students.id`, cascade delete |
| `razorpayOrderId` | unique — how a webhook resolves back to a student |
| `amountPaise` | **integer**, never a float. The amount quoted for *this* order. |
| `currency` | `"INR"` |
| `status` | `created \| paid \| failed` |
| `razorpayPaymentId` | nullable, set on success |
| `createdAt`, `updatedAt` | |

A student may have several rows here across retries. Every one of them remains
resolvable, which is what prevents a superseded order's late payment from being lost.

### `paymentEvents` — new

Append-only log of every webhook received.

| Column | Notes |
|---|---|
| `id` | serial PK |
| `razorpayOrderId` | indexed, nullable (an unparseable payload may have none) |
| `eventType` | e.g. `order.paid` |
| `signatureValid` | boolean |
| `payload` | raw JSON as received |
| `receivedAt` | |

Money needs an audit trail independent of the row it mutates. If a student disputes a
charge, this shows exactly what Razorpay sent and when. Never deleted.

### Money representation

Integer paise everywhere. Never floating point. This is the same discipline the codebase
already applies to CGPA (`numeric(4,2)`, explicitly not a float, because
`6.00 >= 6.00` must not be a coin toss).

---

## Part 3 — Registration and payment flow

### Screens

1. **Sign in** (if not already) — Google or Microsoft.
2. **Form** — name (pre-filled, editable), phone, CGPA, programme, branch, year, focus
   area, skills, resume. Email shown read-only from their account so they can see which
   account they are registering under.
3. **Review** — every entered value shown back, with Edit, alongside the fee and a
   "Confirm & Pay" button. This is the last point at which a mistake is free to fix. A
   review screen is used rather than a confirmation checkbox because a checkbox gets
   ticked reflexively, while a displayed `CGPA: 7.00` makes a wrong value visible.
4. **Razorpay checkout** — popup.
5. **Result** — success screen with the reference code, or a retry path.

### Sequence

1. Submit → server validates, writes or updates the student's `pending_payment` row,
   creates a Razorpay order server-side, writes a `paymentOrders` row, returns the order
   ID.
2. Checkout opens. Student pays.
3. Razorpay POSTs a webhook to `/api/payments/razorpay/webhook` — **the source of
   truth**. Independently, the browser polls for status — **display only**.
4. Webhook marks the row paid, issues the reference code, and triggers the confirmation
   email.
5. Browser observes `paid` and shows the reference code.

The browser is never trusted to report payment. A student can complete a UPI payment in
Google Pay and close the tab before returning; the webhook still completes their
registration and the email delivers their code.

### Why the row is written before the popup opens

Razorpay requires a server-created order before checkout can open, and the confirming
webhook carries only that order ID — it knows nothing about the student or their form
data. Something must exist to attach the payment to. Holding form data in the browser
instead is what produces the unrecoverable case: payment succeeds, tab dies, money taken
with no record anywhere.

From the student's side the rule still holds exactly: **no payment, no registration.**
No reference code, no email, and not an applicant.

### Webhook handler — required order of operations

1. Verify HMAC signature against `RAZORPAY_WEBHOOK_SECRET`. Reject unsigned immediately.
2. Write to `paymentEvents` **before** acting, so rejected and unparseable events are
   still recorded.
3. Act **only** on `order.paid`. Log and ignore `payment.authorized`, `payment.failed`,
   and all others.
4. Verify the webhook amount equals `paymentOrders.amountPaise` **for that order** — not
   against current config. A fee change while an order is open must not invalidate a
   payment the student was correctly quoted.
5. Compare-and-swap (below).
6. Return 200 immediately.
7. Send the confirmation email afterwards via `waitUntil`, failing soft — matching the
   existing pattern in `src/lib/email.ts`.

### The atomic state change

This single statement is what makes concurrent and replayed webhooks safe:

```sql
UPDATE students SET payment_status='paid', ref_code=$1, paid_at=now()
WHERE id=$2 AND payment_status='pending_payment'
RETURNING id
```

Zero rows returned means another handler already won → no-op, return 200. Razorpay may
deliver `payment.captured` and `order.paid` near-simultaneously and retries anything that
doesn't return 2xx promptly; without this, two handlers could each issue a reference code
and send an email.

Reference-code collisions retry as they do today (`src/lib/ref-code.ts`), inside this
conditional update.

### Tamper resistance

The amount is set server-side at order creation and never read from the browser. A
student editing the page cannot pay ₹1 against a ₹500 fee. The signature check makes a
forged "payment succeeded" POST impossible without the webhook secret.

### Failure matrix

| Situation | Outcome |
|---|---|
| Payment fails or is cancelled | Row stays `pending_payment`. Retry immediately; nothing re-typed. |
| Student pays, closes tab before returning | Webhook completes it. Registered; reference code arrives by email. |
| Webhook delayed | Browser shows "confirming your payment…" and keeps polling. Never reports failure merely because confirmation is slow. |
| Webhook delivered twice | Second is a no-op via the compare-and-swap. No duplicate code, no duplicate email. |
| Webhook never arrives | Reconciliation cron queries Razorpay directly for any order non-terminal over an hour and settles it. |
| Student somehow pays twice | Unique `clerkUserId` prevents a second application. The extra payment is visible in `paymentEvents` for manual refund. |
| Student returns to an abandoned attempt | Form pre-fills from their existing `pending_payment` row, resume included. A new order is created; the old order remains resolvable. |

### Status polling

`GET /api/payments/status` — requires authentication, returns only the caller's own
status. Polled every 2s for up to 90s. After that the UI states plainly that
confirmation will arrive by email, which is true because the webhook path is
independent of the browser.

---

## Part 4 — Admin console

`src/db/queries/students.ts` currently has **no payment filter** in `listStudents()`,
`studentStatusCounts()`, or `listStudentsForExport()`. Left alone, every unpaid row would
appear in the student list, dashboard counts, and CSV exports as a genuine applicant.

All three gain a payment filter. Default views show `paid` only. Unpaid rows remain
reachable behind an explicit filter for drop-off analysis. This is required, not polish.

The student detail page shows payment status, amount paid, and payment date.

---

## Part 5 — Cleanup

A daily job, reusing the existing cron infrastructure, deletes `pending_payment` rows
older than 24 hours **that have no `paymentOrders` row at all** — someone who filled the
form and never opened checkout. Their orphaned resume blob is deleted with them; a blob
deletion failure is logged and must not abort the run.

Any row with a payment attempt is **kept permanently**. A row is roughly 1 KB, and
keeping it eliminates an entire class of "money arrived, row gone." `paymentEvents` is
never deleted.

### Storage is not a constraint

Measured 2026-08-22: the whole database is 8.5 MB of the 500 MB available; `students` is
128 KB, mostly fixed index overhead. Resumes live in Blob, not Postgres. Even 5,000
registrations lands around 5–10 MB. Clerk accounts consume none of it. The Resend
100 emails/day cap is a far more real limit than storage.

---

## Testing

**Unit, no live payments** — fabricated payloads covering: signature verification
(valid, invalid, absent); replayed and concurrent `order.paid`; amount mismatch; unknown
event types; unparseable bodies.

**Policy** — every access-policy function with a student actor, asserting `false`.

**Integration** — Razorpay test-mode keys for a full pass before any real money moves.

**E2E** — the existing suite's two standing contracts still hold: the console never
renders to a signed-out visitor, and the body never scrolls horizontally. Add: an
anonymous visitor is redirected from registration to sign-in; an unpaid application
never yields a reference code.

---

## Environment

| Variable | Scope |
|---|---|
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | client — public by design |
| `RAZORPAY_KEY_SECRET` | server only |
| `RAZORPAY_WEBHOOK_SECRET` | server only — **distinct from the API secret** |

Razorpay is not a Vercel Marketplace integration (verified 2026-08-22: the payments
category offers Stripe only). It is wired directly via its SDK with keys in env vars.
Razorpay remains the right choice for domestic ₹ collection from Indian students.

---

## Blockers before go-live

Both are modelled the way `EDITION.startsAt` already is: the code ships correct but
inert until real values exist. Neither may be invented — see the sourcing rule at the
top of `src/lib/content.ts`.

1. **The fee amount.** Not yet decided.
2. **Whose Razorpay account receives the money.** Personal versus institutional has real
   accountability implications for a university-adjacent event and needs organiser sign-off.

## Accepted risks

- **Razorpay webhook delivery is a hard dependency.** If their webhooks are down,
  payments succeed and confirmations lag until reconciliation catches them.

**Resolved 2026-08-22 — the pre-existing blob leak.** Resumes upload on file-select, so
abandoning the page orphaned a blob with no database row (measured: 10 blobs, 2
referenced). Fixed ahead of this feature by `src/lib/orphaned-resumes.ts` and a daily
cron. The pending-row cleanup in Part 5 composes with it: a `pending_payment` row still
references its resume, so the sweep leaves it alone, and deleting the row releases the
blob to a later sweep.

## Build order

1. Student role and OAuth sign-in; registration gated; email and name from identity.
   Ships and is verifiable while registration is still free.
2. Payment: schema, order creation, checkout, webhook, reconciliation, admin filters,
   cleanup.
