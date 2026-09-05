# Payment flow — design review notes

Working notes from the design session on 2026-08-22. This records **six defects found
in a first-draft payment design and how each was corrected**, so the reasoning behind
the final design isn't lost. The authoritative spec lives in
`docs/superpowers/specs/`; this file is the "why", not the "what".

Two of these defects lose real money. They are recorded because they are easy to
reintroduce.

---

## Defect 1 — a single `razorpayOrderId` column loses payments

**The bug.** The first draft put `razorpayOrderId` directly on the `students` row.
Combined with the retry feature (an abandoned attempt keeps its data so the student
can edit and resubmit), this sequence loses money:

1. Student submits the form → order A created, column set to A.
2. Student abandons the payment popup.
3. Student returns, edits their CGPA, submits again → order B created, column
   **overwritten** to B.
4. Order A completes anyway — a stale tab, or they had already approved it in their
   UPI app.
5. The webhook for order A arrives, finds no row matching A, and gives up.

The student is charged. No registration exists. Nothing can recover it automatically,
because the link between order A and that student was destroyed in step 3.

**The correction.** Order IDs move off `students` into a **`paymentOrders`** table —
one row per attempt, foreign-keyed to the student. Any order ID from any webhook,
however old or superseded, always resolves back to its student.

**The lesson.** The retry feature *created* this bug. A safety feature added on top of
a single-value column turned into a money-loss path.

---

## Defect 2 — verifying the amount against current config is wrong

**The bug.** The draft said "re-verify the amount against config." If the fee changes
from ₹500 to ₹600 while a student has an open ₹500 order, that check rejects their
payment. They paid exactly what they were quoted, and the system calls it fraud.

**The correction.** Verify the webhook amount against `paymentOrders.amountPaise` —
what we told Razorpay when we created *that* order. The order record is the contract
with the student, not the current config value.

The tamper protection still holds: the amount is set server-side at order creation and
is never accepted from the browser.

---

## Defect 3 — "reference code and email inside one transaction" is not implementable

**The bug.** An email send cannot sit inside a database transaction. If the send fails,
rolling back would undo a payment that genuinely happened. It also risks exceeding
Razorpay's webhook timeout, which triggers retries.

**The correction.** The transaction covers the database state change only. The email
sends afterwards via `waitUntil`, failing soft — the same pattern already used for the
registration confirmation email in `src/lib/email.ts`. The payment record is the real
record; the email is a courtesy.

---

## Defect 4 — "idempotent" was asserted without a mechanism

**The bug.** The draft claimed the webhook handler was idempotent but never said how.
That is the entire substance of the problem. Razorpay can deliver `payment.captured`
and `order.paid` near-simultaneously, and retries any webhook that doesn't return 2xx
quickly. Two concurrent handlers could both observe `pending_payment` and both issue a
reference code and both send an email.

**The correction.** One conditional UPDATE does the work — a database-level
compare-and-swap:

```sql
UPDATE students SET payment_status='paid', ref_code=$1, paid_at=now()
WHERE id=$2 AND payment_status='pending_payment'
RETURNING id
```

Zero rows returned means another handler already won → no-op, return 200. No locks, no
application-level coordination, no race. This is the load-bearing line of the feature.

---

## Defect 5 — cleanup could delete a row mid-payment

**The bug.** Deleting `pending_payment` rows older than 24h can delete a row while a
payment against it is still in flight. Same outcome as Defect 1: money arrives, row is
gone.

**The correction.** Only delete rows with **no payment order at all** — someone who
uploaded a resume and never opened the popup. Any row with an order attempt is kept
permanently. A row is ~1 KB; keeping them removes an entire class of disaster and gives
useful drop-off data. `paymentEvents` is never deleted.

---

## Defect 6 — unpaid rows would corrupt the admin console

**The bug.** Verified in `src/db/queries/students.ts`: `listStudents()`,
`studentStatusCounts()`, and `listStudentsForExport()` have no payment filter. Every
unpaid row would appear in the student list, the dashboard counts, and CSV exports as a
genuine applicant.

**The correction.** All three gain a payment filter; default views show `paid` only.
Unpaid rows remain visible behind an explicit filter for drop-off analysis. This is a
required change, not an optional polish.

---

## Why form-first, not pay-first

The original proposal was: sign in → pay → then fill in details and upload the resume.
That ordering means payment succeeds against a student the system knows almost nothing
about, and their application only exists if they return and finish typing. A closed tab
between payment and submission means money taken with no record, unrecoverable, because
the form data never left the browser.

Form-first inverts this: the application is saved before payment is attempted, so a
successful payment always has something to attach to. A student who pays and never
returns is still fully registered — the webhook completes it and the confirmation email
delivers their reference code.

The cost is that the database briefly holds unpaid applications. That is invisible
plumbing, not a registration: no reference code is issued and no email is sent until
payment confirms, so from the student's side the rule "no payment, no registration"
holds exactly.

### Why something must be written before the popup opens

Razorpay needs an order created server-side before its checkout can open, and the
webhook that confirms payment carries only that order ID — it knows nothing about who
the student is or what they typed. Something must exist in our database beforehand for
the payment to attach to. Holding form data only in the browser is what creates the
unrecoverable case above.

---

## Webhook handler — order of operations

1. Verify the HMAC signature against `RAZORPAY_WEBHOOK_SECRET`; reject unsigned
   requests immediately.
2. Log to `paymentEvents` **before** acting, so even rejected or unparseable events are
   on record.
3. Act **only** on `order.paid`. Log and ignore `payment.authorized`,
   `payment.failed`, and everything else.
4. Verify the webhook amount equals `paymentOrders.amountPaise` for that order. On
   mismatch: log, alert, do not mark paid.
5. Run the compare-and-swap from Defect 4.
6. Return 200 immediately.
7. Send the confirmation email afterwards via `waitUntil`, failing soft.

## Other decisions worth keeping

- **Integer paise throughout, never floats.** The same discipline this codebase already
  applies to CGPA (`numeric`, not float).
- **Reconciliation cron.** Daily, asks Razorpay's API directly about any order stuck
  non-terminal for over an hour, and settles it. Covers a webhook that never arrived.
- **No automated refunds.** Refunds happen through the Razorpay dashboard by a human.
  Automating money going out is a far higher-risk surface than money coming in, and
  there is no volume here to justify it.
- **`refCode` becomes nullable.** Issued only on payment, so unpaid rows genuinely have
  no reference code — the rule is enforced at the database level, not just in the UI.

---

## Known risks — not designed away, deliberately accepted

- **Razorpay webhook delivery is a real dependency.** If their webhooks are down,
  payments succeed and confirmations lag until the reconciliation cron catches them.
  Students get their email late.
- **Pre-existing blob leak, surfaced by this work.** Resumes upload on file-select,
  before submit. Anyone who picks a file and leaves already orphans a blob with no
  database row today. Not caused by this feature; worth fixing separately.

---

## Unresolved before go-live

These are modelled the way `EDITION.startsAt` already is — the code ships correct but
inert until real values exist. Neither may be invented; see the content rule in
`src/lib/content.ts`.

- **The fee amount.** Not decided.
- **Whose Razorpay account receives the money.** Personal vs. institutional has real
  accountability implications for a university-adjacent event, and needs organiser sign-off.
