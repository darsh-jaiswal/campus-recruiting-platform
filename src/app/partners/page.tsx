import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Section";
import {
  BRANCHES,
  CONTACT,
  LAST_EDITION,
  PLACEMENT_STATS,
} from "@/lib/content";
import { PartnerForm } from "./PartnerForm";

export const metadata: Metadata = {
  title: "Recruit From Campus",
  description:
    "Partner with Aspire Quest to interview and hire students on campus during the recruiting event.",
};

/** Overrides the root layout's `light` for this dark-scoped page — see the
 * same note on the home page's viewport export. */
export const viewport: Viewport = {
  colorScheme: "dark",
};

export default function PartnersPage() {
  const bTech2024 = PLACEMENT_STATS.find(
    (stat) => stat.programme === "B.Tech" && stat.year === "2024",
  );

  return (
    // One of the three pages that opted into the dark "noir" scope by
    // explicit request — see `.aq-noir` in globals.css. Every other page
    // stays the original light default.
    <div className="aq-noir flex min-h-screen flex-col bg-surface text-slate">
      <SiteHeader dark />

      <main id="main">
        <Container className="grid gap-14 py-16 md:py-24 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <Eyebrow>Companies</Eyebrow>
              <h1 className="mt-5 text-h1 font-semibold">
                Recruit From Campus.
              </h1>
              <p className="mt-5 text-lede text-slate">
                Tell us the roles and the problem you want candidates assessed
                against. Post your openings and screened, focus-area
                candidates apply to you directly.
              </p>

              <dl className="mt-10 border-t border-hairline">
                <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3.5">
                  <dt className="text-sm text-muted">Last edition</dt>
                  <dd data-figure className="text-sm font-semibold text-navy">
                    {LAST_EDITION.participants} participants
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3.5">
                  <dt className="text-sm text-muted">Branches</dt>
                  <dd data-figure className="text-sm font-semibold text-navy">
                    {BRANCHES.length}
                  </dd>
                </div>
                {bTech2024 ? (
                  <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3.5">
                    <dt className="text-sm text-muted">
                      B.Tech highest, 2024
                    </dt>
                    <dd data-figure className="text-sm font-semibold text-navy">
                      {bTech2024.highest.toFixed(2)} LPA
                    </dd>
                  </div>
                ) : null}
              </dl>

              <p className="mt-8 text-sm text-muted">
                Prefer to talk first? Contact{" "}
                <a
                  href={`mailto:${CONTACT.placementCell.email}`}
                  className="font-semibold text-navy underline-offset-4 hover:underline"
                >
                  {CONTACT.placementCell.name}
                </a>{" "}
                at the Placement Cell.
              </p>
            </div>
          </div>

          <div className="lg:col-span-8">
            <PartnerForm />
          </div>
        </Container>
      </main>

      <SiteFooter />
    </div>
  );
}
