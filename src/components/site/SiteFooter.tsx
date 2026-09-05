import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SITE } from "@/lib/content";

/**
 * Deliberately minimal — the earlier, heavier footer (social links, extra
 * columns) was removed sitewide for the professional redesign. This exists
 * for one reason: Razorpay's website verification looks for the legal
 * policy pages linked from the site, not just reachable by a guessed URL —
 * without a link somewhere, an automated crawl of the homepage finds
 * nothing to follow. Present on every public page for the same reason: the
 * primary URL submitted to Razorpay is the homepage specifically.
 */
const LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/shipping", label: "Shipping" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline bg-surface">
      <Container className="flex flex-col gap-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {SITE.name}, {SITE.institution}
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="underline-offset-4 hover:text-navy hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
