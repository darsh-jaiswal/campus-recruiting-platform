import { EmptyState, PageHeading } from "@/components/admin/Shell";
import { listCompanies } from "@/db/queries/companies";
import { requireAdmin } from "@/lib/auth";
import { ImportForm } from "./ImportForm";
import { PipelineBoard } from "./PipelineBoard";

export const metadata = { title: "Companies" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  await requireAdmin();
  const companies = await listCompanies();

  return (
    <>
      <PageHeading
        title="Companies"
        count={companies.length}
        description="Phase 1 of the playbook. Onboarding closes eight to ten weeks before the fest, so this pipeline has to be worked before student screening opens."
      />

      <ImportForm />

      <div className="mt-6">
        {companies.length === 0 ? (
          <EmptyState
            title="No companies yet"
            body="Import the Placement Cell recruiter list to seed the pipeline, or wait for partner submissions to arrive through the public form."
          />
        ) : (
          <PipelineBoard
            companies={companies.map((company) => ({
              id: company.id,
              name: company.name,
              status: company.status,
              source: company.source,
              contactName: company.contactName,
              contactEmail: company.contactEmail,
              stipendMin: company.stipendMin,
              ppoTrack: company.ppoTrack,
            }))}
          />
        )}
      </div>
    </>
  );
}
