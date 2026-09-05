"use client";

import { useUser } from "@clerk/nextjs";
import { ButtonLink } from "@/components/ui/Button";
import { consoleDestination } from "@/lib/console-destination";

/**
 * "For recruiters" — shown to everyone EXCEPT accounts that already hold a
 * console (organisers and recruiters), for whom the partner-interest form is
 * noise next to their own console link.
 *
 * Visible is the loading state, so the signed-out majority on the static
 * marketing pages never sees it pop in; it only ever disappears, and only
 * for the handful of console accounts.
 */
export function RecruiterCta({ dark = false }: { dark?: boolean }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const hasConsole =
    isLoaded && isSignedIn && consoleDestination(user.publicMetadata?.role) !== null;

  if (hasConsole) return null;

  return (
    // Wrapped rather than hidden directly on the link: ButtonLink's own base
    // class always carries an unconditional `inline-flex`, which fights
    // `hidden` at equal CSS specificity — Tailwind resolves that by
    // generation order, not by which one is more specific, so it isn't
    // reliable. A plain wrapper has no competing display utility to fight.
    <div className="hidden sm:block">
      <ButtonLink
        href="/partners"
        variant={dark ? "outline-invert" : "gradient-soft"}
        className="px-4 py-2.5"
      >
        For recruiters
      </ButtonLink>
    </div>
  );
}
