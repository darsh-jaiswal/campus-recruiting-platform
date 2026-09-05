# Student Accounts Implementation Plan (Stage 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require students to sign in with Google or Microsoft before registering, and take their email address from that verified identity instead of a typed form field.

**Architecture:** Clerk already gates the admin console; this extends it to students by adding `"student"` as a third role that is the *default* for any signed-in account without a granted role. Registration becomes an authenticated route. The email field leaves the form entirely and comes from the OAuth identity, which is what makes a typo'd or non-existent address impossible.

**Tech Stack:** Next.js 16 (App Router), Clerk, Drizzle + Neon Postgres, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-22-student-accounts-and-payment-design.md`

## Global Constraints

- **Recruiter functionality must not change.** `recruiterMemberships`, `requireRecruiter`, `/portal`, `canActForCompany`, and bundle release rules stay exactly as they are. The only recruiter-adjacent edit is adding an explicit `student → false` branch where TypeScript forces one.
- **Payment is out of scope.** This is Stage 1. No Razorpay, no fee, no `paymentStatus`. Registration stays free.
- **No student dashboard.** Accounts gate registration, nothing more.
- **`src/lib/content.ts` sourcing rule:** every public-facing figure must be a real sourced fact. Do not invent copy containing numbers, dates, or fees.
- **Verification command:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`
- **`npm run db:push` needs `-- --force`** without a TTY. The database holds real rows now — read `git log` and check before running it.
- **Base CSS must stay inside `@layer base`** (see CLAUDE.md traps).
- **Do not verify auth behaviour with `curl`** — Clerk's dev instance handshakes in JavaScript. Use Playwright.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/access-policy.ts` | modify — add `"student"` to `Role`, explicit deny branches |
| `src/lib/access-policy.test.ts` | modify — student cases for all three functions |
| `src/lib/auth.ts` | modify — `getActor` returns a student actor; add `requireStudent` |
| `src/db/schema.ts` | modify — add `clerkUserId` to `students` |
| `src/app/register/actions.ts` | modify — identity from Clerk, duplicate check on `clerkUserId` |
| `src/app/register/page.tsx` | modify — gate on auth, pass identity to the form |
| `src/app/register/RegistrationForm.tsx` | modify — email read-only, name pre-filled |
| `src/proxy.ts` | modify — add `/register` to the protected matcher |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | modify — copy no longer claims students have no accounts |
| `src/app/no-access/page.tsx` | modify — copy reflects that no-role now means student |
| `README.md` | modify — reverse the documented "students have no accounts" decision |
| `e2e/registration-auth.spec.ts` | create — anonymous visitor is redirected to sign-in |

---

### Task 1: Add the student role to the access policy

The security-critical task. Today "signed in with no role" means *no access to anything*; after this it means *student*. Every policy function must deny students explicitly rather than by accident.

**Files:**
- Modify: `src/lib/access-policy.ts:13` (the `Role` union) and the three functions
- Test: `src/lib/access-policy.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type Role = "admin" | "recruiter" | "student"`, consumed by Task 2

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/access-policy.test.ts`, after the existing actor constants at the top:

```typescript
const student: PolicyActor = { role: "student", companyIds: [] };
```

Then append this block at the end of the file:

```typescript
/**
 * A student is the default role for any signed-in account, so these are the
 * tests that stop a self-registered account from reading candidate PII.
 */
describe("students are denied everywhere", () => {
  test("a student may not act for any company", () => {
    expect(canActForCompany(student, 1)).toBe(false);
    expect(canActForCompany(student, 999)).toBe(false);
  });

  test("a student may not read any resume", () => {
    expect(canReadStudentResume(student, [])).toBe(false);
    expect(canReadStudentResume(student, [1])).toBe(false);
    expect(canReadStudentResume(student, [1, 2, 3])).toBe(false);
  });

  test("a student may not view any bundle, released or draft", () => {
    expect(canViewBundle(student, { companyId: 1, releasedAt: null })).toBe(false);
    expect(
      canViewBundle(student, { companyId: 1, releasedAt: new Date() }),
    ).toBe(false);
  });

  test("a student carrying a forged companyIds list is still denied", () => {
    const forged: PolicyActor = { role: "student", companyIds: [1, 2, 3] };
    expect(canActForCompany(forged, 1)).toBe(false);
    expect(canReadStudentResume(forged, [1])).toBe(false);
    expect(canViewBundle(forged, { companyId: 1, releasedAt: new Date() })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/access-policy.test.ts`
Expected: FAIL — TypeScript rejects `role: "student"` because it is not in the `Role` union.

- [ ] **Step 3: Add the role and the deny branches**

In `src/lib/access-policy.ts`, change line 13:

```typescript
export type Role = "admin" | "recruiter" | "student";
```

Add a deny as the first statement of each of the three functions. In `canActForCompany`:

```typescript
export function canActForCompany(
  actor: PolicyActor,
  companyId: number,
): boolean {
  // A student is the default role for any signed-in account. It grants nothing.
  if (actor.role === "student") return false;
  if (actor.role === "admin") return true;
  return actor.companyIds.includes(companyId);
}
```

In `canReadStudentResume`:

```typescript
export function canReadStudentResume(
  actor: PolicyActor,
  permittedCompanyIds: readonly number[],
): boolean {
  if (actor.role === "student") return false;
  if (actor.role === "admin") return true;
  if (actor.companyIds.length === 0) return false;
  return permittedCompanyIds.some((id) => actor.companyIds.includes(id));
}
```

In `canViewBundle`:

```typescript
export function canViewBundle(
  actor: PolicyActor,
  bundle: { companyId: number; releasedAt: Date | null },
): boolean {
  if (actor.role === "student") return false;
  if (actor.role === "admin") return true;
  if (!bundle.releasedAt) return false;
  return actor.companyIds.includes(bundle.companyId);
}
```

Also update the module docstring's first paragraph to name the third role:

```typescript
/**
 * Access policy — pure functions, no I/O.
 *
 * The recruiter-isolation rule is the single most important invariant in this
 * application: a recruiter must never be able to read a candidate belonging to
 * another company. Keeping the decision here, free of Clerk and the database,
 * means it can be tested exhaustively rather than reasoned about.
 *
 * There are three roles. `admin` and `recruiter` are granted by a human setting
 * Clerk `publicMetadata.role`. `student` is the DEFAULT for any signed-in
 * account with no granted role, because students self-serve and nobody
 * provisions them — so every function here must deny it explicitly. A missing
 * deny would hand candidate PII to anyone who signs in with Google.
 *
 * Callers supply the facts (who is asking, which companies the resource
 * belongs to); this module decides. It never fetches anything itself.
 */
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/access-policy.test.ts`
Expected: PASS, including all pre-existing admin and recruiter tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/access-policy.ts src/lib/access-policy.test.ts
git commit -m "feat: add student role, denied by every access policy"
```

---

### Task 2: Return a student actor instead of null

**Files:**
- Modify: `src/lib/auth.ts:54-72` (`getActor`), and add `requireStudent`

**Interfaces:**
- Consumes: `Role` from Task 1
- Produces: `requireStudent(): Promise<Actor>` and `getActor()` returning `Actor | null` where `null` now means *not signed in*, consumed by Tasks 3 and 5

- [ ] **Step 1: Read every call site before changing the contract**

Run: `grep -rn "getActor\|requireActor\|requireAdmin\|requireRecruiter" src/ --include=*.ts --include=*.tsx`

For each hit, confirm it does not treat `null` as "deny". `requireAdmin` and `requireRecruiter` compare `actor.role !== role`, so a student fails them — correct. `requireActor` accepts *any* actor, so after this change a student would pass it, and it guards `/api/resume/download`. That route additionally calls `canReadStudentResume`, which Task 1 makes deny students — so it fails closed. Record this reasoning in the commit.

- [ ] **Step 2: Change `parseRole` and `getActor`**

In `src/lib/auth.ts`, replace `parseRole` (line 46-48) and `getActor` (line 54-72):

```typescript
function parseGrantedRole(value: unknown): Role | null {
  return value === "admin" || value === "recruiter" ? value : null;
}

/**
 * The signed-in actor, or null when nobody is signed in. Cached per request so
 * a page that calls this from several components does not re-hit Clerk.
 *
 * A signed-in account with no granted role is a STUDENT, not a denial. That is
 * what lets students self-serve without an admin provisioning each one. Null
 * now means exactly one thing: no session.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const role = parseGrantedRole(user?.publicMetadata?.role) ?? "student";

  if (role === "admin") {
    return { userId, role, companyIds: [] };
  }

  if (role === "student") {
    return { userId, role, companyIds: [] };
  }

  const memberships = await db
    .select({ companyId: recruiterMemberships.companyId })
    .from(recruiterMemberships)
    .where(eq(recruiterMemberships.userId, userId));

  return { userId, role, companyIds: memberships.map((m) => m.companyId) };
});
```

- [ ] **Step 3: Add `requireStudent`**

Append to `src/lib/auth.ts`, after `requireRecruiter`:

```typescript
/**
 * Any signed-in account. Used to gate registration.
 *
 * Deliberately admits admins and recruiters too — an organiser testing the
 * registration flow should not be blocked by their own role.
 */
export async function requireStudent(): Promise<Actor> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  return actor;
}
```

- [ ] **Step 4: Verify nothing regressed**

Run: `npm run typecheck && npm test`
Expected: PASS, 85+ tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: treat a signed-in account with no granted role as a student"
```

---

### Task 3: Gate registration behind sign-in

**Files:**
- Modify: `src/proxy.ts:13-17`
- Modify: `src/app/register/page.tsx:22`
- Test: `e2e/registration-auth.spec.ts` (create)

**Interfaces:**
- Consumes: `requireStudent` from Task 2
- Produces: `/register` requires a session; the page has an `Actor` in scope for Task 5

- [ ] **Step 1: Write the failing E2E test**

Create `e2e/registration-auth.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

/**
 * Registration requires an account; browsing never does. The second half
 * matters as much as the first — forcing sign-in on a marketing page would
 * cost real applicants.
 */
test("an anonymous visitor is sent to sign-in from registration", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("an anonymous visitor can still browse the public site", async ({
  page,
}) => {
  for (const path of ["/", "/partners", "/alumni"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
  }
});
```

- [ ] **Step 2: Run it to verify the first test fails**

Run: `npx playwright test e2e/registration-auth.spec.ts`
Expected: the redirect test FAILS (`/register` still renders anonymously); the browsing test passes.

- [ ] **Step 3: Add `/register` to the protected matcher**

In `src/proxy.ts`, change the matcher (lines 13-17):

```typescript
const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/portal(.*)",
  "/api/resume/download(.*)",
  // Registration requires an identity so the email address is verified rather
  // than typed. Browsing stays anonymous — only this route is gated.
  "/register(.*)",
]);
```

- [ ] **Step 4: Gate the page itself**

Middleware is a first gate only (see the docstring in `src/proxy.ts`); the page must re-check. In `src/app/register/page.tsx`, change the component to be async and call the helper:

```typescript
import { requireStudent } from "@/lib/auth";

// ...

export default async function RegisterPage() {
  await requireStudent();

  return (
    // ...unchanged JSX
  );
}
```

Add the import at the top of the file alongside the existing imports.

- [ ] **Step 5: Run the E2E test to verify it passes**

Run: `npx playwright test e2e/registration-auth.spec.ts`
Expected: PASS, both tests.

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts src/app/register/page.tsx e2e/registration-auth.spec.ts
git commit -m "feat: require sign-in to reach registration"
```

---

### Task 4: Add `clerkUserId` to the students table

**Files:**
- Modify: `src/db/schema.ts` (the `students` table and its index list)

**Interfaces:**
- Consumes: nothing
- Produces: `students.clerkUserId` column and `students_clerk_user_idx` unique index, consumed by Task 5

- [ ] **Step 1: Add the column**

In `src/db/schema.ts`, inside the `students` table definition, immediately after the `refCode` line:

```typescript
    /**
     * The Clerk account that submitted this application.
     *
     * Nullable because rows created before accounts existed have none. Unique
     * so one account yields one application — this is the duplicate check,
     * replacing email, because an account id is stable and an email is typed.
     */
    clerkUserId: varchar("clerk_user_id", { length: 64 }),
```

- [ ] **Step 2: Add the unique index**

In the same file, in the index array at the bottom of the `students` definition, after `uniqueIndex("students_email_idx").on(table.email),`:

```typescript
    uniqueIndex("students_clerk_user_idx").on(table.clerkUserId),
```

Postgres unique indexes permit multiple NULLs, so the existing account-less rows do not collide.

- [ ] **Step 3: Check what the database holds before pushing**

Run:
```bash
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
sql\`select count(*)::int as rows from students\`.then(r => console.log(r));
"
```
Expected: a small number of test rows. If this shows real applicant data, stop and confirm before pushing.

- [ ] **Step 4: Push the schema**

Run: `npm run db:push -- --force`
Expected: `ALTER TABLE "students" ADD COLUMN "clerk_user_id" varchar(64);` plus the unique index, then `[✓] Changes applied`.

- [ ] **Step 5: Verify the column exists**

Run:
```bash
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
sql\`select column_name from information_schema.columns where table_name='students' and column_name='clerk_user_id'\`.then(r => console.log(r));
"
```
Expected: one row, `clerk_user_id`.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: link a student row to the Clerk account that created it"
```

---

### Task 5: Take identity from Clerk in the registration action

**Files:**
- Modify: `src/app/register/actions.ts`

**Interfaces:**
- Consumes: `students.clerkUserId` from Task 4
- Produces: `registerStudent` no longer reads `email` from the form; `SubmittedValues` loses its `email` field, consumed by Task 6

- [ ] **Step 1: Import Clerk's server helpers**

At the top of `src/app/register/actions.ts`, add to the existing imports:

```typescript
import { auth, currentUser } from "@clerk/nextjs/server";
```

- [ ] **Step 2: Drop `email` from the echoed-back values**

`SubmittedValues` exists so a validation error does not wipe the form. Email is no longer a form field, so remove it. In the type:

```typescript
export type SubmittedValues = {
  fullName: string;
  phone: string;
  cgpa: string;
  programme: string;
  branch: string;
  year: string;
  focusArea: string;
  skills: string;
  consent: boolean;
};
```

And in `submittedValuesFrom`, delete the `email` line.

- [ ] **Step 3: Resolve the identity at the top of the action**

Insert immediately after `const values = submittedValuesFrom(formData);` in `registerStudent`:

```typescript
  // Identity comes from the verified OAuth session, never from the form. This
  // is what makes a mistyped or non-existent address impossible. The page is
  // already gated; this re-check exists because a Server Action is reachable
  // independently of the page that renders it.
  const { userId } = await auth();
  if (!userId) {
    return {
      status: "error",
      message: "Your session has expired. Sign in again to submit your application.",
      values,
    };
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return {
      status: "error",
      message:
        "We could not read a verified email address from your account. Sign out and sign in again.",
      values,
    };
  }
```

- [ ] **Step 4: Feed the identity into validation and the insert**

In the `raw` object, replace the `email` line:

```typescript
    email,
```

(The Zod schema keeps validating it — the value's source changed, not the rule.)

In the `db.insert(students).values({...})` call, add after `refCode,`:

```typescript
        clerkUserId: userId,
```

- [ ] **Step 5: Handle the new duplicate constraint**

In the `catch` block, add this check **before** the existing `students_email_idx` check:

```typescript
      if (isUniqueViolation(error, "students_clerk_user_idx")) {
        return {
          status: "error",
          message:
            "This account already has an application on record. Contact the organising team if you need to change it.",
          values,
        };
      }
```

No `errors` object here: the form renders per-field errors next to inputs, and
this failure belongs to no field. It surfaces through the top-level `message`
banner, which the form already renders. Adding `errors: { form: ... }` would be
dead data — nothing reads that key.

Keep the `students_email_idx` branch: two different OAuth accounts can carry the same address, and one application per human address is still the intent.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS. Typecheck will flag `RegistrationForm.tsx` still passing `values.email` — Task 6 fixes that. If it does, proceed to Task 6 and commit them together.

- [ ] **Step 7: Commit**

```bash
git add src/app/register/actions.ts
git commit -m "feat: take the registration email from the verified OAuth identity"
```

---

### Task 6: Show the account email instead of asking for one

**Files:**
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/register/RegistrationForm.tsx`

**Interfaces:**
- Consumes: `SubmittedValues` without `email` from Task 5
- Produces: `RegistrationForm` takes `{ email: string; suggestedName: string }`

- [ ] **Step 1: Pass the identity from the page**

In `src/app/register/page.tsx`, read the Clerk user and hand its details to the form:

```typescript
import { currentUser } from "@clerk/nextjs/server";
import { requireStudent } from "@/lib/auth";

// ...

export default async function RegisterPage() {
  await requireStudent();
  const user = await currentUser();

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const suggestedName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ");
```

Then change the render site:

```typescript
            <RegistrationForm email={email} suggestedName={suggestedName} />
```

- [ ] **Step 2: Accept the props in the form**

In `src/app/register/RegistrationForm.tsx`, change the signature:

```typescript
export function RegistrationForm({
  email,
  suggestedName,
}: {
  email: string;
  suggestedName: string;
}) {
```

- [ ] **Step 3: Replace the email input with a read-only display**

Delete the whole `<Field label="Email" ...>` block and put this in its place:

```tsx
          <div>
            <span className="block text-sm font-semibold text-navy">
              Email
            </span>
            <p className="mt-1 text-xs text-muted">
              From the account you signed in with. Shortlist updates go here.
            </p>
            <p className="mt-2 rounded border border-hairline-strong bg-sunken px-3.5 py-2.5 text-slate">
              {email}
            </p>
          </div>
```

No `name` attribute anywhere in it — the value must reach the server from the session, not the form.

- [ ] **Step 4: Pre-fill the name**

In the "Full name" `<Input>`, change `defaultValue`:

```tsx
              defaultValue={values?.fullName ?? suggestedName}
```

An OAuth profile name is often informal or missing a surname, so it stays editable. `values?.fullName` still wins after a failed submit, so a correction is never undone.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/register/page.tsx src/app/register/RegistrationForm.tsx
git commit -m "feat: show the signed-in account's email instead of asking for one"
```

---

### Task 7: Correct the copy the change made false

Three places now assert something untrue. Leaving them is worse than a cosmetic problem — the README is the project's stated source of truth.

**Files:**
- Modify: `src/app/sign-in/[[...sign-in]]/page.tsx:10-16` and `:35-45`
- Modify: `src/app/no-access/page.tsx:10-17` and `:28-32`
- Modify: `README.md:36`

**Interfaces:**
- Consumes: nothing
- Produces: nothing

- [ ] **Step 1: Fix the sign-in page**

Replace the docstring (lines 10-16):

```typescript
/**
 * Sign-in for everyone: organisers, partner recruiters, and students.
 *
 * Students self-serve through Google or Microsoft — an account is how their
 * email address is verified rather than typed. Recruiters are still invited by
 * an admin; there is no self-registration path into the console.
 */
```

Replace the closing paragraph (lines 35-45) — it currently tells students they need no account:

```tsx
        <p className="mt-10 max-w-[44ch] text-center text-sm text-muted">
          Registering as a student? Sign in with Google or Microsoft above —{" "}
          <Link
            href="/register"
            className="font-semibold text-navy underline-offset-4 hover:underline"
          >
            then continue to registration
          </Link>
          .
        </p>
```

Update the `metadata.description` if one exists on the page; if not, leave it.

- [ ] **Step 2: Fix the no-access page**

A student reaching `/no-access` has hit `/admin` or `/portal`, not registration. Replace the body copy (lines 28-32):

```tsx
        <p className="mt-5 max-w-[48ch] text-slate">
          You are signed in, but this account cannot open the console. If you
          are a student, registration is where you want to be. If you are a
          partner recruiter, the organising team issues access once your
          company is onboarded.
        </p>
```

Add a link to registration in the button row, before the existing "Back to the site" link:

```tsx
          <Link
            href="/register"
            className="rounded border border-hairline-strong px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-navy hover:bg-raised"
          >
            Go to registration
          </Link>
```

- [ ] **Step 3: Fix the README**

`README.md` line 36 currently reads:

> **Students have no accounts.** Registration is a public form returning an on-screen reference code. This removes an auth surface and avoids per-student email volume, which would exceed Resend's 100/day free cap during a registration surge.

Replace it with:

```markdown
**Students sign in with Google or Microsoft.** Registration is gated on a verified
identity, so the email address on an application is one the applicant demonstrably
controls rather than one they typed. Browsing the site never requires an account —
only registering does. This reverses an earlier decision to have no student accounts,
which was made before registration collected a fee; see
`docs/superpowers/specs/2026-08-22-student-accounts-and-payment-design.md`. The Resend
100/day cap that partly motivated the original decision remains a live constraint on
confirmation and reminder volume.
```

- [ ] **Step 4: Check nothing else repeats the old claim**

Run: `grep -rn "no account\|have no accounts\|without an account" README.md src/ --include=*.ts --include=*.tsx --include=*.md`
Fix any further hits that now read as false. `src/app/register/page.tsx`'s `metadata.description` contains "no account needed" — change that phrase to "sign in with Google or Microsoft".

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run test:e2e`
Expected: PASS. The E2E suite asserts copy on the no-access page; if a selector breaks, update the test to match the new wording rather than reverting the copy.

- [ ] **Step 6: Commit**

```bash
git add README.md src/app/sign-in src/app/no-access src/app/register/page.tsx
git commit -m "docs: correct copy that said students have no accounts"
```

---

### Task 8: Verify the whole flow in a browser and deploy

**Files:** none — this is verification.

- [ ] **Step 1: Enable the OAuth providers in Clerk**

This is a dashboard step, not code, and nothing below works without it. In the Clerk dashboard for instance `example-clerk-instance`: **User & Authentication → Social Connections**, enable **Google** and **Microsoft**. Clerk's shared dev credentials are fine for the development instance; production needs your own OAuth app per provider.

- [ ] **Step 2: Run the full verification suite**

Run: `npm run typecheck && npm run lint && npm test && npm run test:e2e`
Expected: all PASS. Kill any stray dev server on port 3000 first — Playwright's `reuseExistingServer: true` will otherwise test against a dev server instead of a production build and fail confusingly.

- [ ] **Step 3: Walk the flow in a real browser**

Start `npm run dev`, then, signed out:

1. Visit `/` — loads anonymously, no sign-in prompt.
2. Visit `/register` — redirects to `/sign-in`.
3. Sign in with Google.
4. Land on `/register`. Confirm the email shown matches the account and is not editable, and the name is pre-filled.
5. Submit with a deliberately invalid CGPA (`99`). Confirm the error appears and every other field keeps its value.
6. Fix it and submit properly. Confirm the reference code screen and the confirmation email.
7. Submit again from the same account. Confirm "You have already submitted an application."

- [ ] **Step 4: Confirm the row carries the account id**

Run:
```bash
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
sql\`select id, ref_code, email, clerk_user_id from students order by id desc limit 3\`.then(r => console.log(r));
"
```
Expected: the newest row has a `clerk_user_id` and an email matching the Google account.

- [ ] **Step 5: Confirm a student cannot reach the console**

Still signed in as that student, visit `/admin` and `/portal`. Both must land on `/no-access`. This is the security property Task 1 protects; verify it by hand as well as by unit test.

- [ ] **Step 6: Commit and deploy**

```bash
git push origin main
```

Pushing to `main` auto-deploys to production. Then confirm against `https://aspire-quest.vercel.app`: `/register` redirects to sign-in, and Google sign-in completes. Production uses the same Clerk instance, so Step 1's provider setup carries over.

---

## Out of scope, deliberately

- Razorpay, fees, `paymentStatus`, `paymentOrders`, `paymentEvents` — Stage 2, blocked on the fee amount and the merchant-account decision.
- A student-facing "my application" page.
- Backfilling `clerkUserId` on the existing test rows; they stay null and the nullable column tolerates it.
