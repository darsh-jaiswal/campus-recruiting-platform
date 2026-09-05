import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeading, Pill } from "@/components/admin/Shell";
import {
  getOpeningForCompanies,
  listApplicantsForOpening,
} from "@/db/queries/openings";
import { recordBulkAudit } from "@/lib/audit";
import { requireRecruiter } from "@/lib/auth";
import { OPENING_FOCUS_AREAS } from "@/lib/content";
import { scoringPromptHash } from "@/lib/openings";
import { applicationWithdrawnAt } from "@/lib/withdrawal";
import { setOpeningStatus } from "../actions";
import { ApplicantRow } from "./ApplicantRow";
import { RescoreBar } from "./RescoreBar";

/**
 * One opening's applicant list, ranked by AI score.
 *
 * `getOpeningForCompanies` carries the company filter into the query, so an
 * id belonging to another company falls through to notFound() — the same
 * response as an id that does not exist.
 *
 * Reading this list is a read of student PII: one bulk audit row per page
 * view.
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

export default async function OpeningApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRecruiter();
  const { id } = await params;

  const openingId = Number(id);
  if (!Number.isInteger(openingId) || openingId <= 0) notFound();

  const opening = await getOpeningForCompanies(openingId, actor.companyIds);
  if (!opening) notFound();

  const applicants = await listApplicantsForOpening(openingId);

  if (applicants.length > 0) {
    await recordBulkAudit(
      actor,
      "view_student",
      applicants.length,
      `Portal · opening #${openingId} applicants · ${opening.companyName}`,
    );
  }

  const currentHash = scoringPromptHash(
    opening.description,
    opening.screeningPrompt,
    opening.jdBlobKey,
  );
  const interestedCount = applicants.filter((a) => a.interested === true).length;

  const filters = [
    opening.minCgpa ? `CGPA ≥ ${opening.minCgpa}` : null,
    opening.eligibleBranches.length > 0
      ? opening.eligibleBranches.join(", ")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Link
        href="/portal/openings"
        className="mb-6 inline-block text-sm text-muted underline-offset-4 hover:text-navy hover:underline"
      >
        ← All openings
      </Link>

      <PageHeading
        title={opening.title}
        count={applicants.length}
        description={`${FOCUS_LABEL[opening.focusArea] ?? opening.focusArea}${
          opening.publishedAt
            ? ` · posted ${DATE_FORMAT.format(opening.publishedAt)}`
            : " · not yet published"
        }${filters ? ` · Filters: ${filters}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {opening.status === "draft" ? <Pill tone="muted">Draft</Pill> : null}
            {opening.status === "closed" ? (
              <Pill tone="neutral">Closed</Pill>
            ) : null}
            {interestedCount > 0 ? (
              <Pill tone="positive">{interestedCount} marked interested</Pill>
            ) : null}
            <Link
              href={`/portal/openings/${opening.id}/edit`}
              className="rounded border border-hairline-strong px-3.5 py-2 text-sm font-semibold text-navy transition-colors hover:border-navy"
            >
              Edit
            </Link>
            <form action={setOpeningStatus}>
              <input type="hidden" name="openingId" value={opening.id} />
              {opening.status === "draft" ? (
                <button
                  type="submit"
                  name="transition"
                  value="publish"
                  className="rounded border border-navy bg-navy px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-hover"
                >
                  Publish
                </button>
              ) : opening.status === "live" ? (
                <button
                  type="submit"
                  name="transition"
                  value="close"
                  className="rounded border border-hairline-strong px-3.5 py-2 text-sm font-semibold text-slate transition-colors hover:border-critical hover:text-critical"
                >
                  Close opening
                </button>
              ) : (
                <button
                  type="submit"
                  name="transition"
                  value="reopen"
                  className="rounded border border-hairline-strong px-3.5 py-2 text-sm font-semibold text-navy transition-colors hover:border-navy"
                >
                  Reopen
                </button>
              )}
            </form>
          </div>
        }
      />

      {opening.jdFilename ? (
        <p className="-mt-4 mb-6 text-sm text-muted">
          JD document:{" "}
          <a
            href={`/api/openings/jd/download?openingId=${opening.id}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-navy underline-offset-4 hover:underline"
          >
            {opening.jdFilename}
          </a>{" "}
          · read by the AI scorer alongside the description
        </p>
      ) : null}

      {applicants.length === 0 ? (
        <EmptyState
          title="No applications yet"
          body={
            opening.status === "live"
              ? "The opening is live. Applications appear here as students apply, and each one is scored against your screening prompt."
              : "This opening is not published, so students cannot see it yet. Publish it to start collecting applications."
          }
        />
      ) : (
        <>
          <RescoreBar openingId={openingId} />
          <ul className="border-t border-hairline-strong">
            {applicants.map((applicant, index) => (
              <ApplicantRow
                key={applicant.studentId}
                openingId={openingId}
                studentId={applicant.studentId}
                rank={index + 1}
                refCode={applicant.refCode}
                fullName={applicant.fullName}
                branch={applicant.branch}
                programme={applicant.programme}
                year={applicant.year}
                cgpa={applicant.cgpa}
                skills={applicant.skills}
                hasResume={applicant.hasResume}
                interested={applicant.interested}
                score={applicant.score}
                scoreRationale={applicant.scoreRationale}
                scoreStale={
                  applicant.score !== null &&
                  applicant.promptHash !== currentHash
                }
                withdrawnAt={applicationWithdrawnAt(applicant, {
                  withdrawnAt: applicant.studentWithdrawnAt,
                })}
              />
            ))}
          </ul>
        </>
      )}

      <p className="mt-10 max-w-[68ch] text-xs text-muted">
        Candidate details and resumes are shared under the students&rsquo;
        explicit consent for Aspire Quest recruitment. Every resume you open is
        logged. AI scores and your screening prompt are never shown to
        students.
      </p>
    </>
  );
}
