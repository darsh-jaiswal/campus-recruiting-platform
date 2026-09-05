"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Pill } from "@/components/admin/Shell";
import { FOCUS_AREAS } from "@/lib/content";
import { updateStatuses, type BulkState } from "./actions";

type Row = {
  id: number;
  /** Null for an unpaid row — issued only once payment confirms. */
  refCode: string | null;
  fullName: string;
  email: string;
  branch: string;
  programme: string;
  year: string;
  cgpa: string;
  focusArea: string;
  skills: string[];
  status: string;
  paymentStatus: string;
};

const INITIAL: BulkState = { status: "idle" };

const FOCUS_LABEL = Object.fromEntries(
  FOCUS_AREAS.map((a) => [a.code, a.name]),
) as Record<string, string>;

const STATUS_TONE: Record<
  string,
  "neutral" | "active" | "positive" | "critical" | "muted"
> = {
  registered: "muted",
  screened: "neutral",
  shortlisted: "active",
  interviewed: "active",
  selected: "positive",
  rejected: "critical",
};

export function ScreeningTable({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [statusState, statusAction, statusPending] = useActionState(
    updateStatuses,
    INITIAL,
  );

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  const feedback = statusState.status !== "idle" ? statusState : null;

  return (
    <div>
      {/* Bulk bar. Appears only with a selection, so it never competes with the
          table for attention when there is nothing to act on. */}
      {selected.size > 0 ? (
        <div className="sticky top-[6.5rem] z-30 mb-4 flex flex-wrap items-center gap-4 rounded border border-navy bg-navy px-4 py-3 text-white">
          <p className="text-sm font-semibold">
            <span data-figure>{selected.size}</span> selected
          </p>

          <form action={statusAction} className="flex items-center gap-2">
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="studentIds" value={id} />
            ))}
            <label htmlFor="bulk-status" className="sr-only">
              Set status
            </label>
            <select
              id="bulk-status"
              name="status"
              defaultValue="shortlisted"
              className="rounded border border-white/25 bg-navy px-2.5 py-1.5 text-sm text-white"
            >
              <option value="screened">Screened</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interviewed">Interviewed</option>
              <option value="selected">Selected</option>
              <option value="rejected">Not progressed</option>
            </select>
            <button
              type="submit"
              disabled={statusPending}
              className="rounded border border-white/25 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {statusPending ? "Applying…" : "Apply"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-sm text-white/70 underline-offset-4 hover:text-white hover:underline"
          >
            Clear
          </button>
        </div>
      ) : null}

      <div aria-live="polite">
        {feedback ? (
          <p
            className={`mb-4 rounded border px-4 py-2.5 text-sm ${
              feedback.status === "success"
                ? "border-positive/30 bg-positive/5 text-positive"
                : "border-critical/30 bg-critical/5 text-critical"
            }`}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded border border-hairline">
        <table className="w-full min-w-[62rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Registered candidates matching the current filters
          </caption>
          <thead>
            <tr className="border-b border-hairline-strong bg-raised">
              <th scope="col" className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all candidates on this page"
                  className="size-4 accent-[var(--color-navy)]"
                />
              </th>
              {[
                "Ref",
                "Name",
                "Branch",
                "Year",
                "CGPA",
                "Focus area",
                "Status",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={`px-3 py-2.5 text-eyebrow font-semibold uppercase text-muted ${
                    heading === "CGPA" ? "text-right" : ""
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = selected.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={`border-b border-hairline transition-colors last:border-0 ${
                    isSelected ? "bg-amber-wash" : "hover:bg-raised"
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.fullName}`}
                      className="size-4 accent-[var(--color-navy)]"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="tabular text-xs text-muted">
                      {row.refCode ?? "Unpaid"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/students/${row.id}`}
                      className="font-semibold text-navy underline-offset-4 hover:underline"
                    >
                      {row.fullName}
                    </Link>
                    <span className="block text-xs text-muted">
                      {row.email}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate">
                    {row.branch}
                    <span className="block text-xs text-muted">
                      {row.programme}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate">{row.year}</td>
                  <td
                    data-figure
                    className="px-3 py-2.5 text-right font-semibold text-navy"
                  >
                    {row.cgpa}
                  </td>
                  <td className="px-3 py-2.5 text-slate">
                    {FOCUS_LABEL[row.focusArea] ?? row.focusArea}
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone={STATUS_TONE[row.status] ?? "neutral"}>
                      {row.status}
                    </Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
