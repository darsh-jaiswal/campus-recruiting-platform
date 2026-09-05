import LineSidebar from "@/components/LineSidebar";
import { Eyebrow, Section } from "@/components/ui/Section";
import { LAST_EDITION } from "@/lib/content";

const DISTINCTIONS = [
  {
    title: "It is a hiring channel, not an event",
    body: "Partner companies onboard eight to ten weeks ahead, submit the problem statements their interviews are built around, and leave with candidates. Competitions elsewhere in the fest award prizes; this one awards offers.",
  },
  {
    title: "Candidates are screened before anyone meets them",
    body: "Applications are filtered on CGPA, branch and declared focus area. Partners see the candidates who applied to the roles they are actually hiring for, not a spreadsheet of everyone who signed up.",
  },
  {
    title: "The Placement Cell is in the loop",
    body: "Outcomes are recorded with the campus Placement Cell so an Aspire Quest offer sits alongside the formal placement record rather than beside it.",
  },
];

export function About() {
  return (
    <Section id="about" labelledBy="about-heading" rhythm="loose">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Eyebrow>What it is</Eyebrow>
          <h1
            id="about-heading"
            className="mt-5 max-w-[14ch] text-h1 font-semibold"
          >
            A recruitment drive inside a technical fest.
          </h1>
          <p className="mt-6 max-w-[46ch] text-lede text-slate">
            {LAST_EDITION.label} ran {LAST_EDITION.days} days across{" "}
            {LAST_EDITION.dateLabel} and drew{" "}
            <span data-figure className="font-semibold text-navy">
              {LAST_EDITION.participants}
            </span>{" "}
            participants across a dozen events. Aspire Quest is the track inside
            it that changes what a student does after graduation.
          </p>
        </div>

        <div className="lg:col-span-7">
          {/* LineSidebar's proximity/marker mechanic, carrying a title +
              full paragraph per item instead of just a label. */}
          <LineSidebar
            items={DISTINCTIONS.map((item) => ({
              label: item.title,
              body: item.body,
            }))}
            accentColor="#ec4899"
            textColor="#f2f2ef"
            markerColor="#3a3a3a"
            showIndex
            boldLabel
            showMarker
            proximityRadius={130}
            maxShift={20}
            markerLength={48}
            itemGap={36}
            fontSize={1.3}
          />
        </div>
      </div>
    </Section>
  );
}
