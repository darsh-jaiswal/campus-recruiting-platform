import { ClerkProvider, SignOutButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "No access",
  robots: { index: false, follow: false },
};

/**
 * Where `requireAdmin` / `requireRecruiter` send a signed-in account that has
 * no role, or the wrong one.
 *
 * It says nothing about what exists on the other side of the boundary — a
 * recruiter who lands here should not learn that an admin console exists, only
 * that this account cannot go further.
 */
export default function NoAccessPage() {
  return (
    <ClerkProvider>
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-16 text-center">
        <p className="text-eyebrow font-semibold uppercase text-muted">
          Access
        </p>
        <h1 className="mt-5 text-h1 font-semibold">
          This account has no access.
        </h1>
        <p className="mt-5 max-w-[48ch] text-slate">
          You are signed in, but this account cannot open the console. If you
          are a student, registration is where you want to be. If you are a
          partner recruiter, the organising team issues access once your
          company is onboarded.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <SignOutButton>
            <button className="rounded border border-navy bg-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-hover">
              Sign out
            </button>
          </SignOutButton>
          <Link
            href="/register"
            className="rounded border border-hairline-strong px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-navy hover:bg-raised"
          >
            Go to registration
          </Link>
          <Link
            href="/"
            className="rounded border border-hairline-strong px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-navy hover:bg-raised"
          >
            Back to the site
          </Link>
        </div>
      </main>
    </ClerkProvider>
  );
}
