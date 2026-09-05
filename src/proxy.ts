import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

/**
 * First gate only. (Next 16 renamed this convention from `middleware` to
 * `proxy`; the behaviour is unchanged.)
 *
 * This keeps anonymous traffic off the console, but it is NOT the
 * authorization boundary — it knows nothing about roles or company
 * membership. Every protected page and Server Action re-checks via
 * `src/lib/auth.ts`. If a route is added here and nowhere else, it is unsafe.
 */
const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/portal(.*)",
  "/api/resume/download(.*)",
  // Registration requires an identity so the email address is verified rather
  // than typed. Browsing stays anonymous — only this route is gated.
  "/register(.*)",
  // The student's own application — nothing to show without an identity.
  "/dashboard(.*)",
]);

/**
 * Whether Clerk can run at all.
 *
 * The matcher below deliberately covers every route, so an unconfigured Clerk
 * would throw `Missing publishableKey` on EVERY request — including the public
 * marketing pages, which are supposed to be servable with no environment at
 * all. In development Clerk tolerates absent keys and this never shows up; in
 * production it throws, which took the whole public site down on the first
 * deploy of a fresh project.
 *
 * Skipping Clerk here when it is unconfigured is NOT a weakened gate. The
 * console pages call `requireAdmin` / `requireRecruiter`, which reach Clerk
 * directly and fail — so /admin and /portal still refuse to render, which is
 * the documented and intended failure direction. There is no session to forge
 * when Clerk is absent, because there is no Clerk.
 */
const IS_CLERK_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const withClerk = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // Public pages must survive a missing auth provider. Protected pages still
  // fail closed downstream — see the note above.
  if (!IS_CLERK_CONFIGURED) return NextResponse.next();
  return withClerk(request, event);
}

export const config = {
  matcher: [
    // Everything except Next internals and static files, unless it has a query.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
