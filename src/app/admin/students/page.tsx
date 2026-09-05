import { EmptyState, PageHeading } from "@/components/admin/Shell";
import {
  countStudents,
  listStudents,
  type ScreeningFilters,
} from "@/db/queries/students";
import { recordBulkAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { Filters } from "./Filters";
import { ScreeningTable } from "./ScreeningTable";

export const metadata = { title: "Students" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/** Only accept values we recognise — never pass raw query strings to the DB. */
function parseFilters(
  params: Record<string, string | string[] | undefined>,
): ScreeningFilters {
  const focusArea = first(params.focusArea);
  const status = first(params.status);
  const sort = first(params.sort);
  const minCgpa = first(params.minCgpa);
  const payment = first(params.payment);

  return {
    paymentFilter:
      payment === "unpaid" || payment === "all" ? payment : "paid",
    // Coerced to a fixed-2 decimal string; anything unparseable is dropped.
    minCgpa:
      minCgpa && /^\d{1,2}(\.\d{1,2})?$/.test(minCgpa)
        ? Number(minCgpa).toFixed(2)
        : undefined,
    branch: first(params.branch),
    focusArea:
      focusArea === "core_dev" ||
      focusArea === "aiml" ||
      focusArea === "robotics" ||
      focusArea === "other"
        ? focusArea
        : undefined,
    status:
      status === "registered" ||
      status === "screened" ||
      status === "shortlisted" ||
      status === "interviewed" ||
      status === "selected" ||
      status === "rejected"
        ? status
        : undefined,
    query: first(params.q),
    sort:
      sort === "cgpa_asc" || sort === "newest" || sort === "name"
        ? sort
        : "cgpa_desc",
  };
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const filters = parseFilters(params);

  const [rows, total] = await Promise.all([
    listStudents(filters, PAGE_SIZE),
    countStudents(filters),
  ]);

  // One row for the whole screening view, not one per candidate. See audit.ts.
  if (rows.length > 0) {
    await recordBulkAudit(
      actor,
      "view_student",
      rows.length,
      `Screening view · ${new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v) as [string, string][],
      ).toString()}`,
    );
  }

  const exportQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = first(value);
    if (single) exportQuery.set(key, single);
  }

  return (
    <>
      <PageHeading
        title="Students"
        count={total}
        description="Screen registrations by CGPA, branch and focus area, and move candidates through the pipeline."
      />

      <Filters
        current={{
          minCgpa: first(params.minCgpa),
          branch: first(params.branch),
          focusArea: first(params.focusArea),
          status: first(params.status),
          q: first(params.q),
          sort: first(params.sort),
          payment: filters.paymentFilter,
        }}
        exportHref={`/admin/students/export?${exportQuery.toString()}`}
      />

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="No candidates match these filters"
            body="Widen the CGPA floor or clear the branch and focus-area filters. If registration has not opened yet, there will be nothing here at all."
          />
        ) : (
          <>
            <ScreeningTable
              rows={rows.map((row) => ({
                ...row,
                skills: [...row.skills],
              }))}
            />
            {total > rows.length ? (
              <p className="mt-4 text-sm text-muted">
                Showing the first{" "}
                <span data-figure className="font-semibold text-navy">
                  {rows.length}
                </span>{" "}
                of{" "}
                <span data-figure className="font-semibold text-navy">
                  {total}
                </span>{" "}
                matches. Narrow the filters, or export the full set to CSV.
              </p>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
