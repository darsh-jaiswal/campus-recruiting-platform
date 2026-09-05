import { ClerkProvider } from "@clerk/nextjs";
import { ButtonLink } from "@/components/ui/Button";
import { AccountBadge } from "./AccountBadge";
import { HeaderCta } from "./HeaderCta";
import { RecruiterCta } from "./RecruiterCta";

/**
 * The header's account-aware corner: the recruiter CTA, the primary CTA
 * (Register / My application / a console link), and the signed-in badge,
 * under one ClerkProvider scoped to this widget rather than the whole tree —
 * the root layout stays provider-free so the marketing pages keep their
 * static rendering, and clerk-js is a singleton, so this coexists with the
 * providers that /register, /dashboard, /admin and /portal mount for
 * themselves.
 *
 * "For recruiters" lives in here (not in the static header shell) because it
 * is the one button that must DISAPPEAR for accounts that already hold a
 * console — see RecruiterCta.
 *
 * On a deployment with no Clerk keys the corner falls back to the two static
 * audience links and the badge doesn't render — the public site's
 * survive-without-environment guarantee holds.
 *
 * `dark` threads through to every child: which of these renders the header's
 * glass buttons vs the site's normal ink-ramp buttons.
 */
const CLERK_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function HeaderAccount({ dark = false }: { dark?: boolean }) {
  if (!CLERK_CONFIGURED) {
    return (
      <>
        <div className="hidden sm:block">
          <ButtonLink
            href="/partners"
            variant={dark ? "outline-invert" : "gradient-soft"}
            className="px-4 py-2.5"
          >
            For recruiters
          </ButtonLink>
        </div>
        <ButtonLink
          href="/register"
          variant={dark ? "glass-invert" : "gradient"}
          className="px-4 py-2.5"
        >
          For students
        </ButtonLink>
      </>
    );
  }

  return (
    <ClerkProvider>
      <RecruiterCta dark={dark} />
      <HeaderCta dark={dark} />
      <AccountBadge />
    </ClerkProvider>
  );
}
