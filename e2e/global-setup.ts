import { clerkSetup } from "@clerk/testing/playwright";
import {
  TEST_PAID_STUDENT_EMAIL,
  TEST_PREFILL_STUDENT_EMAIL,
  TEST_STUDENT_EMAIL,
} from "./support/clerk";

/**
 * Runs once before the suite.
 *
 * Two jobs: obtain a Clerk testing token (which is what lets Playwright past
 * bot protection), and make sure the student account those tests sign in as
 * actually exists. The second is idempotent so a fresh clone, or a Clerk
 * instance that has been reset, still gets a green suite without anyone
 * clicking through a dashboard.
 */

const CLERK_API = "https://api.clerk.com/v1";

async function ensureTestStudent(
  secretKey: string,
  email: string,
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };

  const query = `${CLERK_API}/users?email_address=${encodeURIComponent(email)}`;
  const lookup = await fetch(query, { headers });
  if (!lookup.ok) {
    throw new Error(
      `Clerk user lookup failed (${lookup.status}): ${await lookup.text()}`,
    );
  }

  const existing = (await lookup.json()) as unknown[];
  if (Array.isArray(existing) && existing.length > 0) return;

  const created = await fetch(`${CLERK_API}/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email_address: [email],
      first_name: "Aspire",
      last_name: "Tester",
      // The instance has password disabled as a first factor, so the account
      // is deliberately passwordless — it signs in by emailed code only.
      skip_password_requirement: true,
    }),
  });

  if (!created.ok) {
    throw new Error(
      `Could not create the E2E student account (${created.status}): ${await created.text()}`,
    );
  }
}

export default async function globalSetup(): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "CLERK_SECRET_KEY is not set. The E2E suite signs in to inspect the " +
        "registration form; put the key in .env.local (see README § Getting started).",
    );
  }

  await ensureTestStudent(secretKey, TEST_STUDENT_EMAIL);
  await ensureTestStudent(secretKey, TEST_PREFILL_STUDENT_EMAIL);
  await ensureTestStudent(secretKey, TEST_PAID_STUDENT_EMAIL);
  await clerkSetup();
}
