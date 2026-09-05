import type { Metadata, Viewport } from "next";
import { Anton, Inter, Geist } from "next/font/google";
import { DESCRIPTION, SITE, TAGLINE } from "@/lib/content";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


/* Two text weights — hierarchy comes from scale and tracking, not a weight
   ladder. See globals.css § Type. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

/* Loaded solely for the masthead wordmark, where the letterforms are the
   artwork rather than a heading — a single-weight condensed display face
   reads as intentional in a way that just bumping Inter to 800 does not.
   Not available to body copy by convention. */
const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${TAGLINE}`,
    template: `%s · ${SITE.name}`,
  },
  description: DESCRIPTION,
  applicationName: SITE.name,
  openGraph: {
    title: `${SITE.name} — ${TAGLINE}`,
    description: DESCRIPTION,
    url: SITE.url,
    siteName: SITE.name,
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${TAGLINE}`,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

/**
 * Every palette here — the light default AND the `.aq-noir` dark scope — is
 * hand-painted CSS, never `prefers-color-scheme`. Without this, a browser
 * or OS "force dark" feature (on by default on many Android/Chrome builds
 * for pages that don't declare a scheme) tries to auto-repaint the page,
 * fighting the custom palette — text colors compute wrong (near-invisible
 * on their own background) while other elements render fine, exactly the
 * "half the page went unreadable" bug this fixes. `light` tells the
 * browser this page is fully painted for light presentation and to leave
 * it alone, including on the noir-scoped pages, which opt into dark via an
 * explicit class rather than this signal.
 */
export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // data-scroll-behavior tells Next to suspend the CSS smooth-scroll during
    // route transitions — without it, the router's scroll-to-top becomes an
    // interruptible animation and navigations (sign-out included) land
    // mid-page or at the footer. Smooth scrolling stays for anchor links.
    <html
      lang="en-IN"
      data-scroll-behavior="smooth"
      className={cn("h-full", inter.variable, anton.variable, "font-sans", geist.variable)}
    >
      <body className="flex min-h-full flex-col bg-surface text-slate">
        {children}
      </body>
    </html>
  );
}
