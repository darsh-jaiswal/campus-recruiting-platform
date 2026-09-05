import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, Pill } from "@/components/admin/Shell";
import { getOpeningForCompanies } from "@/db/queries/openings";
import { requireRecruiter } from "@/lib/auth";
import { OpeningForm } from "../../OpeningForm";

/**
 * Edit an opening. Same company-scoped fetch as the detail page: another
 * company's id 404s identically to a nonexistent one.
 */

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit opening" };

export default async function EditOpeningPage({
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

  return (
    <>
      <Link
        href={`/portal/openings/${opening.id}`}
        className="mb-6 inline-block text-sm text-muted underline-offset-4 hover:text-navy hover:underline"
      >
        ← Back to applicants
      </Link>

      <PageHeading
        title={`Edit: ${opening.title}`}
        description={
          opening.status === "live"
            ? "This opening is live — students see saved changes immediately."
            : undefined
        }
        actions={
          opening.status === "draft" ? (
            <Pill tone="muted">Draft</Pill>
          ) : opening.status === "closed" ? (
            <Pill tone="neutral">Closed</Pill>
          ) : (
            <Pill tone="positive">Live</Pill>
          )
        }
      />

      <OpeningForm
        opening={{
          id: opening.id,
          title: opening.title,
          focusArea: opening.focusArea,
          description: opening.description,
          screeningPrompt: opening.screeningPrompt,
          minCgpa: opening.minCgpa,
          eligibleBranches: opening.eligibleBranches,
          skills: opening.skills,
          jdBlobKey: opening.jdBlobKey,
          jdFilename: opening.jdFilename,
          jdBytes: opening.jdBytes,
          jdContentType: opening.jdContentType,
        }}
      />
    </>
  );
}
