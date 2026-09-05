import type { Viewport } from "next";
import { About } from "@/components/home/About";
import { Faq } from "@/components/home/Faq";
import { Masthead } from "@/components/home/Masthead";
import { Pathways } from "@/components/home/Pathways";
import { Process } from "@/components/home/Process";
import { Proof } from "@/components/home/Proof";
import { TalentPool } from "@/components/home/TalentPool";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

/** Fully static — the public site is CDN-served and costs no compute. */
export const dynamic = "force-static";

/** Overrides the root layout's `light` for this one dark-scoped page, so
 * native browser UI (scrollbar, form controls) renders dark to match the
 * `.aq-noir` palette instead of the sitewide light default. */
export const viewport: Viewport = {
  colorScheme: "dark",
};

/**
 * The home page opted into the dark "noir" scope by explicit request — see
 * the `.aq-noir` class in globals.css. It's the only theme change that
 * applies here: /register and /partners are the other two pages that opted
 * in, and every other route stays the original light "Institutional
 * Monochrome" default, unchanged.
 */
export default function HomePage() {
  return (
    <div className="aq-noir flex min-h-screen flex-col bg-surface text-slate">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-navy focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>

      {/* The masthead is ink, and the header floats over it transparently. */}
      <SiteHeader overlay dark />

      <main id="main">
        <Masthead />
        <About />
        <Proof />
        <TalentPool />
        <Process />
        <Pathways />
        <Faq />
      </main>

      <SiteFooter />
    </div>
  );
}
