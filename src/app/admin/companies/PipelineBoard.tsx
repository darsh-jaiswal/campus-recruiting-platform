"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Pill } from "@/components/admin/Shell";
import {
  COMPANY_SOURCE_LABEL,
  COMPANY_STATUSES,
  COMPANY_STATUS_LABEL,
  type CompanyStatus,
} from "@/lib/pipeline";
import { setCompanyStatus, type ActionState } from "./actions";

type Company = {
  id: number;
  name: string;
  status: CompanyStatus;
  source: string;
  contactName: string | null;
  contactEmail: string | null;
  stipendMin: number | null;
  ppoTrack: boolean;
};

const INITIAL: ActionState = { status: "idle" };

/** Only these two stages get a column on the board; the rest stay reachable
 * via the per-card move-to select without cluttering the layout. */
const BOARD_STATUSES: readonly CompanyStatus[] = ["interested", "onboarded"];

const TONE: Record<CompanyStatus, "muted" | "neutral" | "active" | "positive"> =
  {
    lead: "muted",
    contacted: "neutral",
    interested: "active",
    committed: "active",
    onboarded: "positive",
  };

export function PipelineBoard({ companies }: { companies: Company[] }) {
  const [state, action] = useActionState(setCompanyStatus, INITIAL);

  return (
    <div>
      <div aria-live="polite">
        {state.status !== "idle" ? (
          <p
            className={`mb-4 rounded border px-4 py-2.5 text-sm ${
              state.status === "success"
                ? "border-positive/30 bg-positive/5 text-positive"
                : "border-critical/30 bg-critical/5 text-critical"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>

      {/* Columns, but built from rules rather than draggable cards — the stage
          is changed with a select, which keeps it keyboard-operable. */}
      <div className="grid gap-px overflow-hidden rounded border border-hairline bg-hairline md:grid-cols-2">
        {BOARD_STATUSES.map((status) => {
          const inStage = companies.filter((c) => c.status === status);
          return (
            <section
              key={status}
              aria-labelledby={`stage-${status}`}
              className="bg-surface p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2
                  id={`stage-${status}`}
                  className="text-eyebrow font-semibold uppercase text-muted"
                >
                  {COMPANY_STATUS_LABEL[status]}
                </h2>
                <span data-figure className="text-xs font-semibold text-navy">
                  {inStage.length}
                </span>
              </div>

              <ul className="mt-4 space-y-3">
                {inStage.map((company) => (
                  <li
                    key={company.id}
                    className="rounded border border-hairline p-3 transition-colors hover:border-hairline-strong"
                  >
                    <Link
                      href={`/admin/companies/${company.id}`}
                      className="text-sm font-semibold text-navy underline-offset-4 hover:underline"
                    >
                      {company.name}
                    </Link>

                    <p className="mt-1 text-xs text-muted">
                      {COMPANY_SOURCE_LABEL[company.source] ?? company.source}
                    </p>

                    {company.stipendMin ? (
                      <p
                        data-figure
                        className="mt-1.5 text-xs font-semibold text-slate"
                      >
                        ₹{company.stipendMin.toLocaleString("en-IN")}/mo
                        {company.ppoTrack ? " · PPO" : ""}
                      </p>
                    ) : null}

                    <form action={action} className="mt-3">
                      <input
                        type="hidden"
                        name="companyId"
                        value={company.id}
                      />
                      <label
                        htmlFor={`move-${company.id}`}
                        className="sr-only"
                      >
                        Move {company.name} to another stage
                      </label>
                      <select
                        id={`move-${company.id}`}
                        name="status"
                        defaultValue={company.status}
                        onChange={(event) => event.currentTarget.form?.requestSubmit()}
                        className="w-full rounded-sm border border-hairline bg-raised px-2 py-1 text-xs text-slate hover:border-muted"
                      >
                        {COMPANY_STATUSES.map((option) => (
                          <option key={option} value={option}>
                            {COMPANY_STATUS_LABEL[option]}
                          </option>
                        ))}
                      </select>
                      <noscript>
                        <button
                          type="submit"
                          className="mt-1 w-full rounded-sm border border-hairline px-2 py-1 text-xs"
                        >
                          Move
                        </button>
                      </noscript>
                    </form>
                  </li>
                ))}

                {inStage.length === 0 ? (
                  <li className="rounded border border-dashed border-hairline px-3 py-6 text-center text-xs text-muted">
                    Empty
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {BOARD_STATUSES.map((status) => (
          <Pill key={status} tone={TONE[status]}>
            {COMPANY_STATUS_LABEL[status]}
          </Pill>
        ))}
      </div>
    </div>
  );
}
