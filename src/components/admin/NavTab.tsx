"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Console tab. Client-side only because it needs the current pathname to mark
 * the active section — everything else in the shell stays a server component.
 *
 * `exact` is for section roots (/admin, /portal), which would otherwise match
 * every page beneath them and light up alongside the real active tab.
 */
export function NavTab({
  href,
  label,
  exact = false,
}: {
  href: string;
  label: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <li>
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={`inline-block border-b-2 px-0.5 pb-2.5 pt-1 text-sm transition-colors ${
          isActive
            ? "border-amber font-semibold text-navy"
            : "border-transparent text-muted hover:border-hairline-strong hover:text-navy"
        }`}
      >
        {label}
      </Link>
    </li>
  );
}
