"use client";

import { useUser } from "@clerk/nextjs";
import { ButtonLink } from "@/components/ui/Button";
import { consoleDestination } from "@/lib/console-destination";

/**
 * The header's primary call to action, resolved client-side like the
 * account badge: the page stays static and CDN-served, and after Clerk
 * hydrates the CTA follows the session — a registered student's
 * "For students" becomes "My application", and an organiser's or
 * recruiter's becomes a link to their console, because the person
 * running the event should never be told to register for it.
 *
 * "For students" mirrors "For recruiters" beside it — the signed-out
 * header addresses its two audiences in parallel. It is also the loading
 * state, so signed-out visitors (the majority on marketing pages) see no
 * flicker at all.
 */
export function HeaderCta({ dark = false }: { dark?: boolean }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const signedIn = isLoaded && isSignedIn;
  const console = signedIn ? consoleDestination(user.publicMetadata?.role) : null;

  return (
    <ButtonLink
      href={console?.href ?? (signedIn ? "/dashboard" : "/register")}
      variant={dark ? "glass-invert" : "gradient"}
      className="px-4 py-2.5"
    >
      {console?.label ?? (signedIn ? "My application" : "For students")}
    </ButtonLink>
  );
}
