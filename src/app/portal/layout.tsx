import { ClerkProvider, SignOutButton, UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NavTab } from "@/components/admin/NavTab";
import { ConsoleShell } from "@/components/admin/Shell";
import { requireRecruiter } from "@/lib/auth";

/**
 * The recruiter portal.
 *
 * Mounted separately from /admin and gated by `requireRecruiter`, which rejects
 * admins as well as anonymous traffic. Keeping the two roles on two route
 * trees means a recruiter never loads a page whose data functions were written
 * assuming an admin caller.
 *
 * As in the admin console, ClerkProvider is mounted here rather than at the
 * root so the public marketing pages stay static and CDN-served.
 */

export const metadata: Metadata = {
  title: { default: "Portal", template: "%s · Aspire Quest Portal" },
  robots: { index: false, follow: false },
};

const SECTIONS = [
  { href: "/portal/openings", label: "Job openings" },
];

export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Re-checked here even though the proxy already gated /portal(.*).
  await requireRecruiter();

  // Always show who is signed in — the same courtesy every site owes its users.
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  return (
    <ClerkProvider>
      <ConsoleShell
        label="Portal"
        nav={SECTIONS.map((section) => (
          <NavTab key={section.href} {...section} />
        ))}
        user={
          <div className="flex items-center gap-4">
            <span
              className="hidden max-w-[20ch] truncate text-sm text-muted md:block"
              title={email ?? undefined}
            >
              {email}
            </span>
            <SignOutButton>
              <button className="text-sm text-muted transition-colors hover:text-navy">
                Sign out
              </button>
            </SignOutButton>
            <UserButton />
          </div>
        }
      >
        {children}
      </ConsoleShell>
    </ClerkProvider>
  );
}
