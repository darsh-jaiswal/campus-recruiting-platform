import { ClerkProvider, SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * Sign-in for everyone: organisers, partner recruiters, and students.
 *
 * Students self-serve through Google or Microsoft — an account is how their
 * email address is verified rather than typed. Recruiters are still invited by
 * an admin; there is no self-registration path into the console.
 */
export default function SignInPage() {
  return (
    <ClerkProvider>
      <main className="flex min-h-screen flex-col items-center justify-center bg-raised px-6 py-16">
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="text-[1.0625rem] font-semibold tracking-tight text-navy"
          >
            Aspire&nbsp;Quest
          </Link>
          <p className="mt-2 text-sm text-muted">
            Console access for organisers and partner recruiters.
          </p>
        </div>

        {/* A sign-in that began on a protected page carries its own
            redirect_url and still returns there; only the walk-in front-door
            sign-in falls through to the role-aware landing. */}
        <SignIn fallbackRedirectUrl="/after-sign-in" />

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
      </main>
    </ClerkProvider>
  );
}
