import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow, Section } from "@/components/ui/Section";
import { CONTACT } from "@/lib/content";

const PATHWAYS = [
  {
    audience: "Students",
    heading: "Register for Aspire Quest",
    body: "Sign in with Google or Microsoft, then submit one form with a PDF resume for a reference code on screen. No password to remember.",
    href: "/register",
    cta: "Start registration",
    variant: "accent" as const,
  },
  {
    audience: "Companies",
    heading: "Recruit From Campus",
    body: "Tell us the roles, the stipend range and the problem you want candidates assessed against. Onboarding runs eight to ten weeks out.",
    href: "/partners",
    cta: "Become a partner",
    variant: "primary" as const,
  },
];

export function Pathways() {
  return (
    <Section labelledBy="pathways-heading" rhythm="loose">
      <div className="max-w-[44ch]">
        <Eyebrow>Take part</Eyebrow>
        <h2 id="pathways-heading" className="mt-5 text-h1 font-semibold">
          Two ways in.
        </h2>
      </div>

      <div className="mt-14 grid gap-px overflow-hidden rounded border border-hairline bg-hairline md:grid-cols-2">
        {PATHWAYS.map((path) => (
          <article
            key={path.audience}
            className="flex flex-col bg-surface p-8 transition-colors hover:bg-raised md:p-10"
          >
            <p className="text-eyebrow font-semibold uppercase text-muted">
              {path.audience}
            </p>
            <h3 className="mt-5 text-h3 font-semibold">{path.heading}</h3>
            <p className="mt-3 flex-1 text-slate">{path.body}</p>
            <ButtonLink
              href={path.href}
              variant={path.variant}
              className="mt-8 self-start"
            >
              {path.cta}
            </ButtonLink>
          </article>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted">
        Recruiting queries can also go directly to the Placement Cell —{" "}
        <a
          href={`mailto:${CONTACT.placementCell.email}`}
          className="font-semibold text-navy underline-offset-4 hover:underline"
        >
          {CONTACT.placementCell.name}, {CONTACT.placementCell.email}
        </a>
        .
      </p>
    </Section>
  );
}
