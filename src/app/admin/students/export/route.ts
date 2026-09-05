import {
  listStudentsForExport,
  type ScreeningFilters,
} from "@/db/queries/students";
import { recordBulkAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { toCsv, type CsvColumn } from "@/lib/csv";

/**
 * CSV export of the current screening view.
 *
 * Authorization is re-checked here even though middleware gates /admin — a
 * route handler is exactly the kind of surface that gets forgotten.
 *
 * Phone number IS included: this export is what the organising team works
 * from to contact shortlisted candidates. That is precisely why every export
 * writes an audit row.
 */

const EXPORT_LIMIT = 5000;

type Row = Awaited<ReturnType<typeof listStudentsForExport>>[number];

const COLUMNS: CsvColumn<Row>[] = [
  { header: "Reference", value: (r) => r.refCode },
  { header: "Name", value: (r) => r.fullName },
  { header: "Email", value: (r) => r.email },
  { header: "Phone", value: (r) => r.phone },
  { header: "Programme", value: (r) => r.programme },
  { header: "Branch", value: (r) => r.branch },
  { header: "Year", value: (r) => r.year },
  { header: "CGPA", value: (r) => r.cgpa },
  { header: "Focus area", value: (r) => r.focusArea },
  { header: "Skills", value: (r) => r.skills },
  { header: "Status", value: (r) => r.status },
  { header: "Payment", value: (r) => r.paymentStatus },
  { header: "Registered", value: (r) => r.createdAt.toISOString() },
];

function parseFilters(url: URL): ScreeningFilters {
  const get = (key: string) => url.searchParams.get(key)?.trim() || undefined;

  const minCgpa = get("minCgpa");
  const focusArea = get("focusArea");
  const status = get("status");
  const payment = get("payment");

  return {
    paymentFilter:
      payment === "unpaid" || payment === "all" ? payment : "paid",
    minCgpa:
      minCgpa && /^\d{1,2}(\.\d{1,2})?$/.test(minCgpa)
        ? Number(minCgpa).toFixed(2)
        : undefined,
    branch: get("branch"),
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
    query: get("q"),
    sort: "cgpa_desc",
  };
}

export async function GET(request: Request): Promise<Response> {
  const actor = await requireAdmin();

  const url = new URL(request.url);
  const filters = parseFilters(url);
  const rows = await listStudentsForExport(filters, EXPORT_LIMIT);

  await recordBulkAudit(
    actor,
    "export_csv",
    rows.length,
    `Student export · ${url.searchParams.toString() || "no filters"}`,
  );

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(toCsv(rows, COLUMNS), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aspire-quest-candidates-${stamp}.csv"`,
      // Never let a CDN or browser hold a copy of a PII export.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
