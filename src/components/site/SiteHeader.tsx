import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SITE } from "@/lib/content";
import { HeaderAccount } from "./HeaderAccount";

/**
 * Two entirely different headers behind one component, chosen by `dark`.
 *
 * `dark` is only ever passed by the three pages that opted into the noir
 * treatment (home, /register, /partners) — every other route gets the
 * original: a plain in-flow bar, painted from the (light, default) tokens,
 * scrolling away with the page like normal chrome. `overlay` (dark-only)
 * lets a page opt out of the fixed header's clearance spacer when its first
 * section already reserves that space itself — the homepage's Masthead is
 * bottom-anchored for exactly this.
 *
 * The dark branch is fixed, translucent, and always the floating
 * rounded-rectangle bar — matching React Bits' navbar treatment rather than
 * the site's usual monochrome-in-flow chrome. Its fill is `bg-ink`, a fixed
 * pole rather than a flippable token, since this branch only ever renders on
 * pages already wrapped in the dark scope.
 */
export function SiteHeader({
  overlay = false,
  dark = false,
}: {
  overlay?: boolean;
  dark?: boolean;
}) {
  if (!dark) {
    return (
      <header className="bg-surface">
        <Container className="flex h-[4.5rem] items-center justify-between gap-6">
          <Link
            href="/"
            className="group flex items-center gap-3"
            aria-label={`${SITE.name} — home`}
          >
            <span className="flex flex-col leading-none">
              <span className="text-[1.0625rem] font-semibold tracking-tight text-navy">
                Aspire&nbsp;Quest
              </span>
              <span className="mt-1 text-[0.6875rem] tracking-wide text-muted">
                {SITE.institution}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden text-sm font-semibold text-slate underline-offset-4 transition-colors hover:text-navy hover:underline sm:block"
            >
              Home
            </Link>
            <Link
              href="/jobs"
              className="mr-1 hidden text-sm font-semibold text-slate underline-offset-4 transition-colors hover:text-navy hover:underline sm:block"
            >
              Openings
            </Link>
            {/* "For recruiters" renders inside HeaderAccount: it must hide for
                accounts that already hold a console, so it is Clerk-aware. */}
            <HeaderAccount />
          </div>
        </Container>
      </header>
    );
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-6">
        <header className="w-full max-w-5xl rounded-2xl border border-white/8 bg-ink/45 backdrop-blur-2xl">
          <Container className="flex h-14 items-center justify-between gap-6">
            <Link
              href="/"
              className="group flex items-center gap-3"
              aria-label={`${SITE.name} — home`}
            >
              <span className="flex flex-col leading-none">
                <span className="text-[1.0625rem] font-semibold tracking-tight text-white">
                  Aspire&nbsp;Quest
                </span>
                <span className="mt-1 text-[0.6875rem] tracking-wide text-white/40">
                  {SITE.institution}
                </span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="hidden text-sm font-semibold text-white/70 transition-colors hover:text-white sm:block"
              >
                Home
              </Link>
              <Link
                href="/jobs"
                className="mr-1 hidden text-sm font-semibold text-white/70 transition-colors hover:text-white sm:block"
              >
                Openings
              </Link>
              {/* "For recruiters" renders inside HeaderAccount: it must hide
                  for accounts that already hold a console, so it is
                  Clerk-aware. */}
              <HeaderAccount dark />
            </div>
          </Container>
        </header>
      </div>
      {overlay ? null : <div aria-hidden="true" className="h-[4.25rem]" />}
    </>
  );
}
