import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { consoleDestination } from "@/lib/console-destination";

export const metadata: Metadata = {
  title: "Signing you in",
  robots: { index: false, follow: false },
};

/** Pure per-request routing — never cache it. */
export const dynamic = "force-dynamic";

/**
 * Role-aware landing after a sign-in that had no destination of its own.
 *
 * The sign-in page points its `fallbackRedirectUrl` here, so a sign-in that
 * BEGAN somewhere (a protected page's redirect carrying `redirect_url`) still
 * returns there — this page only decides for the person who walked in the
 * front door: organisers land in the console, recruiters in the portal,
 * everyone else on their application.
 *
 * Not in the proxy's protected matcher, deliberately: it holds no data, and
 * it fails closed by itself.
 */
export default async function AfterSignInPage() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");

  redirect(consoleDestination(actor.role)?.href ?? "/dashboard");
}
