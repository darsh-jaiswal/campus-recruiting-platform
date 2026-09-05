import { neon } from "@neondatabase/serverless";

/**
 * Shared plumbing for suites that seed their own database rows (see
 * registration-prefill and dashboard). Each such suite MUST use its own
 * dedicated Clerk account — the suites run in parallel workers.
 */

export async function clerkUserIdFor(email: string): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set.");

  const res = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  );
  if (!res.ok) {
    throw new Error(`Clerk user lookup failed (${res.status}): ${await res.text()}`);
  }
  const users = (await res.json()) as { id: string }[];
  if (!users[0]) {
    throw new Error(
      `No Clerk user for ${email} — global-setup should have created it.`,
    );
  }
  return users[0].id;
}

export function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return neon(url);
}
