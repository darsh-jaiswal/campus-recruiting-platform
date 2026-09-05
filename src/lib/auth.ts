import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { recruiterMemberships } from "@/db/schema";
import { canActForCompany, type Role } from "./access-policy";

/**
 * Authorization.
 *
 * Middleware is a first gate and nothing more. Every page, Server Action and
 * route handler that touches student data calls one of the `require*` helpers
 * below — if a route is ever added without being added to the middleware
 * matcher, it must still fail closed.
 *
 * Roles live in Clerk `publicMetadata.role`. Company membership does NOT: it
 * lives in `recruiter_memberships` in our own database, because it decides
 * which students a recruiter can see, and that decision should not be
 * editable from an identity provider's dashboard.
 *
 * These use plain `redirect()` rather than Next's `forbidden()`/`unauthorized()`,
 * which are experimental and require `experimental.authInterrupts`. The
 * authorization path should not depend on an experimental flag.
 */

export type { Role };

export type Actor = {
  userId: string;
  role: Role;
  /** Companies this actor may act for. Always empty for admins. */
  companyIds: readonly number[];
};

/** Thrown by the assert helpers used inside Server Actions, which cannot redirect mid-mutation. */
export class AuthorizationError extends Error {
  constructor(message = "You do not have access to that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

function parseGrantedRole(value: unknown): Role | null {
  return value === "admin" || value === "recruiter" ? value : null;
}

/**
 * The signed-in actor, or null when nobody is signed in. Cached per request so
 * a page that calls this from several components does not re-hit Clerk.
 *
 * A signed-in account with no granted role is a STUDENT, not a denial. That is
 * what lets students self-serve without an admin provisioning each one. Null
 * now means exactly one thing: no session.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  // Fast path: when the Clerk session token is customised to carry
  // public metadata (Dashboard → Sessions → Customize session token,
  // `{"metadata": "{{user.public_metadata}}"}`), the role is already in the
  // JWT and the per-request Clerk API round-trip disappears. Without that
  // customisation the claim is absent and we fall back to currentUser() —
  // never weaker, only slower.
  const claims = sessionClaims as
    | { metadata?: { role?: unknown }; publicMetadata?: { role?: unknown } }
    | null;
  const claimedRole =
    parseGrantedRole(claims?.metadata?.role) ??
    parseGrantedRole(claims?.publicMetadata?.role);

  let role: Role;
  if (claimedRole) {
    role = claimedRole;
  } else if (claims?.metadata || claims?.publicMetadata) {
    // The claim exists and holds no granted role — that IS the answer.
    role = "student";
  } else {
    const user = await currentUser();
    role = parseGrantedRole(user?.publicMetadata?.role) ?? "student";
  }

  if (role === "admin") {
    return { userId, role, companyIds: [] };
  }

  if (role === "student") {
    return { userId, role, companyIds: [] };
  }

  const memberships = await db
    .select({ companyId: recruiterMemberships.companyId })
    .from(recruiterMemberships)
    .where(eq(recruiterMemberships.userId, userId));

  return { userId, role, companyIds: memberships.map((m) => m.companyId) };
});

async function requireRole(role: Role): Promise<Actor> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const actor = await getActor();
  // Signed in, but no role assigned or the wrong one.
  if (!actor || actor.role !== role) redirect("/no-access");

  return actor;
}

export function requireAdmin(): Promise<Actor> {
  return requireRole("admin");
}

export function requireRecruiter(): Promise<Actor> {
  return requireRole("recruiter");
}

/**
 * Any signed-in account. Used to gate registration.
 *
 * Deliberately admits admins and recruiters too — an organiser testing the
 * registration flow should not be blocked by their own role.
 */
export async function requireStudent(): Promise<Actor> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  return actor;
}

/** Either role — for surfaces both can reach, such as a resume download. */
export async function requireActor(): Promise<Actor> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const actor = await getActor();
  if (!actor) redirect("/no-access");
  return actor;
}

/**
 * Assert an actor may act for a given company.
 *
 * Call this before any query keyed by a `companyId` that came from user input.
 * Admins pass for every company; recruiters only for their own.
 */
export function assertCompanyAccess(actor: Actor, companyId: number): void {
  if (!canActForCompany(actor, companyId)) {
    throw new AuthorizationError("That company is not yours to view.");
  }
}
