import Link from "next/link";
import { EmptyState, PageHeading, Pill } from "@/components/admin/Shell";
import { ButtonLink } from "@/components/ui/Button";
import { listOpeningsForCompanies } from "@/db/queries/openings";
import { requireRecruiter } from "@/lib/auth";
import { OPENING_FOCUS_AREAS } from "@/lib/content";

/**
 * Job openings dashboard — the recruiter's main loop.
 *
 * Counts and averages only; applicant identities live one level down, where
 * opening ownership is re-verified and the read is audited.
 */

export const dynamic = "force-dynamic";

const FOCUS_LABEL = Object.fromEntries(
  OPENING_FOCUS_AREAS.map((a) => [a.code, a.name]),
);

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const NOTES: Record<string, string> = {
  published: "Opening published — it is now visible to all eligible students.",
  draft: "Saved as draft. Students cannot see it until you publish.",
};

export default async function OpeningsPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const actor = await requireRecruiter();
  const [openings, { note }] = await Promise.all([
    listOpeningsForCompanies(actor.companyIds),
    searchParams,
  ]);

  const noteText = note ? NOTES[note] : undefined;

  return (
    <>
      <PageHeading
        title="Job openings"
        count={openings.length}
        description="Openings you post are visible to all registered students. Applications are scored by AI against your private screening prompt."
        actions={<ButtonLink href="/portal/openings/new">New opening</ButtonLink>}
      />

      {noteText ? (
        <p role="status" className="-mt-4 mb-6 text-sm font-semibold text-navy">
          {noteText}
        </p>
      ) : null}

      {actor.companyIds.length === 0 ? (
        <EmptyState
          title="Your account is not linked to a company yet"
          body="An Aspire Quest organiser needs to link your account to your company before you can post openings. If you were expecting access, reply to the email that invited you."
        />
      ) : openings.length === 0 ? (
        <EmptyState
          title="No openings yet"
          body="Post your first opening and it goes live to every registered student who meets your eligibility filters. Applications collect here, ranked by AI against your screening prompt."
          action={<ButtonLink href="/portal/openings/new">New opening</ButtonLink>}
        />
      ) : (
        <ul className="border-t border-hairline-strong">
          {openings.map((opening) => (
            <li key={opening.id} className="border-b border-hairline">
              <Link
                href={`/portal/openings/${opening.id}`}
                className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5 transition-colors hover:bg-raised"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-3 font-semibold text-navy underline-offset-4 group-hover:underline">
                    {opening.title}
                    {opening.status === "live" ? (
                      <Pill tone="positive">Live</Pill>
                    ) : opening.status === "draft" ? (
                      <Pill tone="muted">Draft</Pill>
                    ) : (
                      <Pill tone="neutral">Closed</Pill>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {FOCUS_LABEL[opening.focusArea] ?? opening.focusArea}
                    {opening.publishedAt
                      ? ` · posted ${DATE_FORMAT.format(opening.publishedAt)}`
                      : " · not yet published"}
                  </p>
                </div>

                <div className="flex items-baseline gap-8">
                  <p className="text-sm text-muted">
                    <span data-figure className="text-h3 font-semibold text-navy">
                      {opening.applicants}
                    </span>{" "}
                    applicant{opening.applicants === 1 ? "" : "s"}
                  </p>
                  <p className="min-w-[120px] text-sm text-muted">
                    <span data-figure className="font-semibold text-slate">
                      {opening.avgScore ?? "—"}
                    </span>{" "}
                    avg AI score
                  </p>
                  <span aria-hidden="true" className="text-hairline-strong">
                    ›
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 max-w-[68ch] text-xs text-muted">
        Your screening prompt is private to your hiring team and the AI scorer.
        Students see only the job description and eligibility criteria.
      </p>
    </>
  );
}
