"use client";

import { useActionState } from "react";
import { rescoreOpening, type OpeningActionState } from "../actions";

/**
 * The "ranked by AI" banner with the re-run control.
 *
 * Scoring runs synchronously inside the action (a posting's applicant pool is
 * small); the pending state is the honest progress indicator.
 */

const INITIAL: OpeningActionState = { status: "idle" };

export function RescoreBar({ openingId }: { openingId: number }) {
  const [state, action, pending] = useActionState(rescoreOpening, INITIAL);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded border border-hairline bg-raised px-4 py-3.5">
      <p className="max-w-[72ch] text-sm text-slate">
        <span className="font-semibold text-navy">Ranked by AI</span> against
        your screening prompt and the job description. Scores are a starting
        point, not a decision — every rank shows its reasoning.
      </p>
      <div className="flex items-center gap-3">
        {state.status !== "idle" ? (
          <p
            role="status"
            className={`text-sm ${state.status === "error" ? "font-semibold text-critical" : "text-muted"}`}
          >
            {state.message}
          </p>
        ) : null}
        <form action={action}>
          <input type="hidden" name="openingId" value={openingId} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center whitespace-nowrap rounded border border-hairline-strong bg-transparent px-3.5 py-2 text-sm font-semibold text-navy transition-colors hover:border-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Scoring…" : "Re-run scoring"}
          </button>
        </form>
      </div>
    </div>
  );
}
