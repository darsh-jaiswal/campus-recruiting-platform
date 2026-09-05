import { Eyebrow, Section } from "@/components/ui/Section";
import { PHASES } from "@/lib/content";

const AUDIENCE_LABEL: Record<string, string> = {
  recruiters: "Companies",
  students: "Students",
  both: "Everyone",
};

export function Process() {
  return (
    <Section id="process" labelledBy="process-heading" rhythm="loose">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <Eyebrow>How it runs</Eyebrow>
          <h2
            id="process-heading"
            className="mt-5 max-w-[14ch] text-h1 font-semibold"
          >
            Four phases, counted back from the fest.
          </h2>
          <p className="mt-6 max-w-[42ch] text-slate">
            Corporate onboarding closes long before registration opens. That
            ordering is deliberate — students apply against roles that already
            exist, not against a hope that companies turn up.
          </p>
        </div>

        <ol className="lg:col-span-8">
          {PHASES.map((phase) => (
            <li
              key={phase.number}
              className="grid gap-x-8 gap-y-3 border-t border-hairline py-8 sm:grid-cols-[7rem_1fr] last:border-b"
            >
              <div>
                <p
                  data-figure
                  className="text-h2 font-semibold leading-none text-navy/25"
                >
                  {String(phase.number).padStart(2, "0")}
                </p>
                <p className="mt-2 text-sm font-semibold text-amber">
                  {phase.window}
                </p>
              </div>

              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-h3 font-semibold">{phase.title}</h3>
                  <span className="rounded-sm border border-hairline px-2 py-0.5 text-[0.6875rem] text-muted">
                    {AUDIENCE_LABEL[phase.audience]}
                  </span>
                </div>
                <p className="mt-2.5 max-w-[58ch] text-slate">
                  {phase.summary}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
