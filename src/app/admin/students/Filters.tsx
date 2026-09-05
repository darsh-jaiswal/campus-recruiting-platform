import Link from "next/link";
import { BRANCHES, FOCUS_AREAS, REGISTRATION } from "@/lib/content";

/**
 * A plain GET form.
 *
 * Filter state lives in the URL, so a screening view is shareable with the
 * Placement Cell, survives a refresh, and needs no client JavaScript. The
 * export button below reuses the same query string.
 */

const STATUSES = [
  ["", "Any status"],
  ["registered", "Registered"],
  ["screened", "Screened"],
  ["shortlisted", "Shortlisted"],
  ["interviewed", "Interviewed"],
  ["selected", "Selected"],
  ["rejected", "Not progressed"],
] as const;

const PAYMENT_FILTERS = [
  ["paid", "Paid (default)"],
  ["unpaid", "Unpaid only"],
  ["all", "All"],
] as const;

const SORTS = [
  ["cgpa_desc", "CGPA, high to low"],
  ["cgpa_asc", "CGPA, low to high"],
  ["newest", "Most recent"],
  ["name", "Name"],
] as const;

const CONTROL =
  "w-full rounded border border-hairline-strong bg-surface px-3 py-2 text-sm text-slate hover:border-muted focus:border-navy";

export function Filters({
  current,
  exportHref,
}: {
  current: {
    minCgpa?: string;
    branch?: string;
    focusArea?: string;
    status?: string;
    q?: string;
    sort?: string;
    payment?: string;
  };
  exportHref: string;
}) {
  return (
    <form
      method="GET"
      className="rounded border border-hairline bg-raised p-5"
      aria-label="Filter candidates"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-2">
          <label
            htmlFor="q"
            className="block text-xs font-semibold text-navy"
          >
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Name, email or AQ-code"
            className={`${CONTROL} mt-1.5`}
          />
        </div>

        <div>
          <label
            htmlFor="minCgpa"
            className="block text-xs font-semibold text-navy"
          >
            Min CGPA
          </label>
          <input
            id="minCgpa"
            name="minCgpa"
            inputMode="decimal"
            defaultValue={current.minCgpa ?? ""}
            placeholder={String(REGISTRATION.defaultCgpaThreshold.toFixed(1))}
            className={`${CONTROL} mt-1.5 tabular`}
          />
        </div>

        <div>
          <label
            htmlFor="branch"
            className="block text-xs font-semibold text-navy"
          >
            Branch
          </label>
          <select
            id="branch"
            name="branch"
            defaultValue={current.branch ?? ""}
            className={`${CONTROL} mt-1.5`}
          >
            <option value="">Any branch</option>
            {BRANCHES.map((branch) => (
              <option key={branch.code} value={branch.code}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="focusArea"
            className="block text-xs font-semibold text-navy"
          >
            Focus area
          </label>
          <select
            id="focusArea"
            name="focusArea"
            defaultValue={current.focusArea ?? ""}
            className={`${CONTROL} mt-1.5`}
          >
            <option value="">Any focus area</option>
            {FOCUS_AREAS.map((area) => (
              <option key={area.code} value={area.code}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-xs font-semibold text-navy"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={current.status ?? ""}
            className={`${CONTROL} mt-1.5`}
          >
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="payment"
            className="block text-xs font-semibold text-navy"
          >
            Payment
          </label>
          <select
            id="payment"
            name="payment"
            defaultValue={current.payment ?? "paid"}
            className={`${CONTROL} mt-1.5`}
          >
            {PAYMENT_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="w-full sm:w-56">
          <label
            htmlFor="sort"
            className="block text-xs font-semibold text-navy"
          >
            Sort
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={current.sort ?? "cgpa_desc"}
            className={`${CONTROL} mt-1.5`}
          >
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/students"
            className="text-sm text-muted underline-offset-4 hover:text-navy hover:underline"
          >
            Reset
          </Link>
          <a
            href={exportHref}
            className="rounded border border-hairline-strong px-4 py-2 text-sm font-semibold text-navy transition-colors hover:border-navy hover:bg-surface"
          >
            Export CSV
          </a>
          <button
            type="submit"
            className="rounded border border-navy bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-hover"
          >
            Apply filters
          </button>
        </div>
      </div>
    </form>
  );
}
