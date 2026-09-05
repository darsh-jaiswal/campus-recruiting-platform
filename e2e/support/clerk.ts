import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";

/**
 * A signed-in student session for tests that need one.
 *
 * Registration is gated behind an account (see `src/proxy.ts`), so any test
 * that inspects the form itself has to authenticate first. Everything else in
 * this suite stays anonymous on purpose — browsing must never require a login.
 *
 * The address uses Clerk's `+clerk_test` convention, which makes the emailed
 * code a fixed value instead of a real inbox round-trip. The instance has
 * password disabled as a first factor (only `email_code` and Google), so this
 * is the one non-interactive strategy available to us.
 */
export const TEST_STUDENT_EMAIL = "aspire.quest.e2e+clerk_test@example.com";

/**
 * A second, separate account for the prefill suite. That suite seeds a
 * pending_payment row for its account before asserting the form restores it —
 * if it shared TEST_STUDENT_EMAIL, every blank-form assertion in the other
 * suites (which run in parallel workers) would race against the seeded row.
 */
export const TEST_PREFILL_STUDENT_EMAIL =
  "aspire.quest.e2e.prefill+clerk_test@example.com";

/**
 * A third account for suites that seed a PAID registration (dashboard,
 * resume library, withdrawal). Separate for the same parallel-worker
 * reason: the blank-form account must stay row-less, and the prefill
 * account's row must stay pending_payment.
 */
export const TEST_PAID_STUDENT_EMAIL =
  "aspire.quest.e2e.paid+clerk_test@example.com";

export async function signInAsStudent(
  page: Page,
  email: string = TEST_STUDENT_EMAIL,
): Promise<void> {
  await setupClerkTestingToken({ page });

  // ClerkJS is mounted per-route rather than in the root layout (see
  // `src/app/admin/layout.tsx` for why), so `window.Clerk` does not exist on
  // the marketing pages. `/no-access` is the only unprotected route that
  // loads Clerk without also mounting <SignIn/>, which would race this call.
  await page.goto("/no-access");
  await clerk.loaded({ page });

  await clerk.signIn({
    page,
    signInParams: {
      strategy: "email_code",
      identifier: email,
    },
  });
}
