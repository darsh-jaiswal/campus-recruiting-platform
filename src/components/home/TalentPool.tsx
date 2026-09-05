import { Eyebrow, Section } from "@/components/ui/Section";
import { BRANCHES, FOCUS_AREAS } from "@/lib/content";

export function TalentPool() {
  const byProgramme = [
    { programme: "B.Tech" as const, label: "B.Tech" },
    { programme: "MBA.Tech" as const, label: "MBA.Tech" },
  ];

  return (
    <Section
      id="talent"
      labelledBy="talent-heading"
      rhythm="loose"
      className="border-t border-hairline bg-raised"
    >
      <div className="max-w-[46ch]">
        <Eyebrow>Who you meet</Eyebrow>
        <h2 id="talent-heading" className="mt-5 text-h1 font-semibold">
          Screened by focus area, not by CV pile.
        </h2>
        <p className="mt-6 text-lede text-slate">
          Every registration declares one focus area. That is how candidates
          are screened for a partner company&rsquo;s openings, alongside a CGPA
          floor and branch filter set per role.
        </p>
      </div>

      <div className="mt-14 grid gap-px overflow-hidden rounded border border-hairline bg-hairline md:grid-cols-2">
        {FOCUS_AREAS.map((area) => (
          <article key={area.code} className="bg-surface p-8">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-h3 font-semibold">{area.name}</h3>
              <code className="rounded-sm bg-sunken px-2 py-1 text-[0.6875rem] tracking-wide text-muted">
                {area.code}
              </code>
            </div>
            <p className="mt-3.5 max-w-[52ch] text-slate">{area.summary}</p>
          </article>
        ))}
      </div>

      <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:gap-16">
        {byProgramme.map((group) => {
          const branches = BRANCHES.filter(
            (branch) => branch.programme === group.programme,
          );
          return (
            <div key={group.programme}>
              <h3 className="text-eyebrow font-semibold uppercase text-muted">
                {group.label}
              </h3>
              <ul className="mt-4 border-t border-hairline-strong">
                {branches.map((branch) => (
                  <li
                    key={branch.code}
                    className="flex items-baseline justify-between gap-4 border-b border-hairline py-3.5"
                  >
                    <span className="font-semibold text-navy">
                      {branch.name}
                    </span>
                    <span className="text-sm text-muted">{branch.code}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
