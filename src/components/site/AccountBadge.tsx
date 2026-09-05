"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { consoleDestination } from "@/lib/console-destination";

/**
 * The signed-in indicator for the public site.
 *
 * Auth state resolves CLIENT-side after hydration, which is the whole trick:
 * the page itself stays static and CDN-served, and this badge fills in a
 * moment later — "Sign in" for visitors, an avatar for everyone else. Same
 * pattern every large site uses on its cacheable pages.
 *
 * The avatar is a button opening a small account menu (name, email, link to
 * the application, sign out) — the conventional header pattern, instead of
 * spelling the email and a sign-out link across the bar.
 */
export function AccountBadge() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape, only while open.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Reserve the space while Clerk loads so the header doesn't jump.
  if (!isLoaded) return <span className="hidden h-5 w-16 sm:block" />;

  if (!isSignedIn) {
    return (
      <Link
        href="/sign-in"
        className="hidden text-sm font-semibold text-slate underline-offset-4 transition-colors hover:text-navy hover:underline sm:block"
      >
        Sign in
      </Link>
    );
  }

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  // Organisers and recruiters get their console here instead of a student
  // dashboard they have no row in.
  const destination = consoleDestination(user.publicMetadata?.role) ?? {
    href: "/dashboard",
    label: "My application",
  };
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const initials =
    (user.firstName?.[0] ?? email[0] ?? "?").toUpperCase() +
    (user.lastName?.[0] ?? "").toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        title={email}
        className="flex items-center gap-1.5"
      >
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-navy text-[0.6875rem] font-semibold text-on-navy transition-shadow hover:shadow"
        >
          {initials}
        </span>
        <span
          aria-hidden="true"
          className={`text-[0.5625rem] text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded border border-hairline-strong bg-surface py-1.5 shadow-lg"
        >
          <div className="border-b border-hairline px-4 py-2.5">
            {fullName ? (
              <p className="truncate text-sm font-semibold text-navy">
                {fullName}
              </p>
            ) : null}
            <p className="truncate text-xs text-muted" title={email}>
              {email}
            </p>
          </div>

          <Link
            href={destination.href}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-slate transition-colors hover:bg-raised hover:text-navy"
          >
            {destination.label}
          </Link>

          <SignOutButton>
            <button
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left text-sm text-slate transition-colors hover:bg-raised hover:text-navy"
            >
              Sign out
            </button>
          </SignOutButton>
        </div>
      ) : null}
    </div>
  );
}
