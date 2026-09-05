"use client";

import { useActionState } from "react";
import { importCompanies, type ActionState } from "./actions";

const INITIAL: ActionState = { status: "idle" };

/**
 * CSV import for the Placement Cell recruiter list and alumni company lists.
 * Both arrive as hand-maintained spreadsheets, so header spelling is
 * normalised server-side rather than demanded of the file.
 */
export function ImportForm() {
  const [state, action, pending] = useActionState(importCompanies, INITIAL);

  return (
    <details className="rounded border border-hairline bg-raised">
      <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-semibold text-navy [&::-webkit-details-marker]:hidden">
        Import a company list from CSV
      </summary>

      <form action={action} className="border-t border-hairline px-5 py-5">
        <p className="max-w-[62ch] text-sm text-muted">
          Needs a <code className="text-navy">Company</code> column. Optional:{" "}
          <code className="text-navy">Website</code>,{" "}
          <code className="text-navy">Contact</code>,{" "}
          <code className="text-navy">Email</code>,{" "}
          <code className="text-navy">Phone</code>. Rows with no company name
          are skipped rather than failing the file.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label
              htmlFor="import-file"
              className="block text-xs font-semibold text-navy"
            >
              CSV file
            </label>
            <input
              id="import-file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="mt-1.5 block w-full cursor-pointer rounded border border-hairline-strong bg-surface text-sm text-slate file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-hairline-strong file:bg-raised file:px-3 file:py-2 file:text-sm file:font-semibold file:text-navy"
            />
          </div>

          <div>
            <label
              htmlFor="import-source"
              className="block text-xs font-semibold text-navy"
            >
              Source
            </label>
            <select
              id="import-source"
              name="source"
              defaultValue="placement_cell"
              className="mt-1.5 rounded border border-hairline-strong bg-surface px-3 py-2 text-sm text-slate"
            >
              <option value="placement_cell">Placement Cell</option>
              <option value="alumni_referral">Alumni network</option>
              <option value="research">Own research</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="rounded border border-navy bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-hover disabled:opacity-50"
          >
            {pending ? "Importing…" : "Import"}
          </button>
        </div>

        <div aria-live="polite">
          {state.status !== "idle" ? (
            <p
              className={`mt-4 rounded border px-4 py-2.5 text-sm ${
                state.status === "success"
                  ? "border-positive/30 bg-positive/5 text-positive"
                  : "border-critical/30 bg-critical/5 text-critical"
              }`}
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </details>
  );
}
