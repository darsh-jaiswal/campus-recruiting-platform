import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Container } from "@/components/ui/Container";

/**
 * Route-transition skeletons for `loading.tsx` files.
 *
 * Every authed page here is force-dynamic and renders on the server, so a
 * click otherwise shows NOTHING until the full response lands — from a
 * distant client that reads as seconds of dead air. A loading boundary
 * makes the transition instant and lets Next prefetch dynamic routes'
 * shells on hover.
 */

export function SkeletonBars() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="h-3 w-24 rounded bg-sunken" />
      <div className="mt-6 h-10 w-72 max-w-full rounded bg-sunken" />
      <div className="mt-8 h-4 w-full max-w-[38rem] rounded bg-sunken" />
      <div className="mt-3 h-4 w-3/4 max-w-[30rem] rounded bg-sunken" />
      <div className="mt-12 h-40 w-full max-w-[44rem] rounded border border-hairline bg-raised" />
    </div>
  );
}

/** Full public-page skeleton: real header and footer, pulsing content. */
export function PublicPageSkeleton({ dark = false }: { dark?: boolean }) {
  const body = (
    <>
      <SiteHeader dark={dark} />
      <main id="main">
        <Container className="py-16 md:py-24">
          <p className="sr-only" role="status">
            Loading
          </p>
          <SkeletonBars />
        </Container>
      </main>
      <SiteFooter />
    </>
  );

  if (!dark) return body;

  return (
    <div className="aq-noir flex min-h-screen flex-col bg-surface text-slate">
      {body}
    </div>
  );
}

/** Console skeleton: renders inside the admin/portal shell layouts. */
export function ConsoleSkeleton() {
  return (
    <div>
      <p className="sr-only" role="status">
        Loading
      </p>
      <SkeletonBars />
    </div>
  );
}
