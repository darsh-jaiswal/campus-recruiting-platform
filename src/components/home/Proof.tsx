import StarBorder from "@/components/StarBorder";
import { Container } from "@/components/ui/Container";
import { Eyebrow, Section } from "@/components/ui/Section";
import { PLACEMENTS, PLACEMENT_STATS, RECRUITERS } from "@/lib/content";

/**
 * The credibility section. Every number here is sourced — this is the part of
 * the page a recruiter reads before deciding whether to reply to an email.
 */
export function Proof() {
  return (
    <div id="proof">
      {/* No longer an inverted band — the whole site is one flat black now,
          so a light band here would be the one section that breaks that,
          not a highlight. Same dark tokens as everywhere else. */}
      <section aria-labelledby="outcomes-heading" className="py-16 md:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="text-eyebrow font-semibold uppercase text-muted">
                Last edition
              </p>
              <h2
                id="outcomes-heading"
                className="mt-5 text-h2 font-semibold text-navy"
              >
                Aspire Quest&nbsp;’26 ended in offers.
              </h2>
              <p className="mt-4 max-w-[42ch] text-slate">
                Two third-year students were hired by Example Robotics Co.
                on a paid internship with a Pre-Placement Offer track.
              </p>
            </div>

            <ul className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
              {PLACEMENTS.map((placement) => (
                <StarBorder
                  key={placement.name}
                  as="li"
                  color="#7C3AED"
                  speed="4s"
                  thickness={5}
                  className="rounded-2xl"
                  innerClassName="rounded-[11px] border border-hairline bg-surface p-7"
                >
                  <p className="text-h3 font-semibold text-navy">
                    {placement.name}
                  </p>
                  <p className="mt-1.5 text-sm text-slate">
                    {placement.programme} · {placement.year}
                  </p>

                  <dl className="mt-6 space-y-3 border-t border-hairline pt-5 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Company</dt>
                      <dd className="text-right font-semibold text-navy">
                        {placement.company}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Stipend</dt>
                      <dd data-figure className="font-semibold text-navy">
                        {placement.stipend}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">PPO track</dt>
                      <dd className="font-semibold text-navy">
                        {placement.ppo ? "Eligible" : "—"}
                      </dd>
                    </div>
                  </dl>
                </StarBorder>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* Placement data as a designed ruled table — never a card grid. */}
      <Section labelledBy="placements-heading" rhythm="tight">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <Eyebrow>Campus placement record</Eyebrow>
            <h2
              id="placements-heading"
              className="mt-5 text-h2 font-semibold"
            >
              The pool these candidates come from.
            </h2>
            <p className="mt-4 max-w-[40ch] text-slate">
              Published placement outcomes for the program. Figures are
              annual packages in lakhs per annum.
            </p>
          </div>

          {/* min-w-0 is load-bearing: a grid item defaults to min-width:auto,
              so without it this column refuses to shrink below the table's
              34rem minimum and pushes the whole page into horizontal scroll on
              a phone. The overflow-x-auto below can only scroll once its
              parent is allowed to be narrower than its content. */}
          <div className="min-w-0 lg:col-span-8">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left">
                <caption className="sr-only">
                  Highest and average placement packages by programme and year,
                  in lakhs per annum
                </caption>
                <thead>
                  <tr className="border-y border-hairline-strong">
                    <th
                      scope="col"
                      className="py-3 pr-4 text-eyebrow font-semibold uppercase text-muted"
                    >
                      Programme
                    </th>
                    <th
                      scope="col"
                      className="py-3 pr-4 text-eyebrow font-semibold uppercase text-muted"
                    >
                      Year
                    </th>
                    <th
                      scope="col"
                      className="py-3 pr-4 text-right text-eyebrow font-semibold uppercase text-muted"
                    >
                      Highest
                    </th>
                    <th
                      scope="col"
                      className="py-3 text-right text-eyebrow font-semibold uppercase text-muted"
                    >
                      Average
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PLACEMENT_STATS.map((stat) => (
                    <tr
                      key={`${stat.programme}-${stat.year}`}
                      className="border-b border-hairline transition-colors hover:bg-raised"
                    >
                      <th
                        scope="row"
                        className="py-4 pr-4 font-semibold text-navy"
                      >
                        {stat.programme}
                      </th>
                      <td className="py-4 pr-4 text-slate">{stat.year}</td>
                      <td className="py-4 pr-4 text-right font-semibold text-navy">
                        {stat.highest.toFixed(2)}
                      </td>
                      <td className="py-4 text-right text-slate">
                        {stat.average.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-10">
              <Eyebrow>Recruiters on campus</Eyebrow>
              {/* Real trademarked logos, used only to identify each company
                  as a recruiting partner — flattened to a single tone via
                  brightness-0 + invert (works regardless of each logo's
                  original colors) so a decorative "trusted by" row doesn't
                  break the site's black-and-white system the way ten
                  differently-colored brand marks would. */}
              <ul className="mt-5 flex flex-wrap items-center gap-x-10 gap-y-6">
                {RECRUITERS.map((recruiter) => (
                  <li key={recruiter.name} className="flex items-center">
                    <img
                      src={recruiter.logo}
                      alt={recruiter.name}
                      className="h-8 w-auto max-w-[120px] object-contain brightness-0 invert opacity-70 transition-opacity hover:opacity-100"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
