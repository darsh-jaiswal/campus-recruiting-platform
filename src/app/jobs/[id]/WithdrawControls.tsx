"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  reapplyToOpening,
  withdrawApplication,
  type ApplyState,
  type WithdrawState,
} from "../actions";
import type { ApplyResumeOption } from "./ApplyForm";

/**
 * The applied and withdrawn states of the apply area. Withdrawing is
 * deliberately a two-step confirm — it tells the recruiter you pulled out —
 * and re-applying re-runs the full CV choice, because the revived
 * application may deserve a different document than the original did.
 */

const WITHDRAW_INITIAL: WithdrawState = { status: "idle" };
const REAPPLY_INITIAL: ApplyState = { status: "idle" };

export function AppliedPanel({
  openingId,
  appliedOn,
}: {
  openingId: number;
  appliedOn: string;
}) {
  const [state, action, pending] = useActionState(
    withdrawApplication,
    WITHDRAW_INITIAL,
  );
  const [armed, setArmed] = useState(false);

  if (state.status === "withdrawn") {
    return (
      <div className="rounded border border-hairline bg-raised px-4 py-3.5">
        <p className="text-sm font-semibold text-navy">Application withdrawn.</p>
        <p className="mt-1 text-sm text-slate">
          The company sees that you withdrew. While the opening is live you
          can re-apply from this page.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded border border-positive/30 bg-positive/5 px-4 py-3.5">
      <p className="text-sm font-semibold text-positive">Applied on {appliedOn}</p>
      <p className="mt-1 text-sm text-slate">
        Shortlist news comes from the Aspire Quest team.
      </p>

      <div className="mt-3">
        {armed ? (
          <form action={action} className="flex flex-wrap items-baseline gap-3">
            <input type="hidden" name="openingId" value={openingId} />
            <span className="text-sm text-slate">
              The company will see you withdrew.
            </span>
            <button
              type="submit"
              disabled={pending}
              className="text-sm font-semibold text-critical underline-offset-4 hover:underline disabled:opacity-50"
            >
              {pending ? "Withdrawing…" : "Confirm withdrawal"}
            </button>
            <button
              type="button"
              onClick={() => setArmed(false)}
              className="text-sm text-muted underline-offset-4 hover:underline"
            >
              Keep my application
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="text-sm font-semibold text-slate underline-offset-4 hover:text-critical hover:underline"
          >
            Withdraw application
          </button>
        )}
      </div>
      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-critical">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function ReapplyPanel({
  openingId,
  canReapply,
  resumes,
}: {
  openingId: number;
  canReapply: boolean;
  resumes: ApplyResumeOption[];
}) {
  const [state, action, pending] = useActionState(
    reapplyToOpening,
    REAPPLY_INITIAL,
  );

  if (state.status === "applied") {
    return (
      <div className="rounded border border-positive/30 bg-positive/5 px-4 py-3.5">
        <p className="text-sm font-semibold text-positive">
          Application revived.
        </p>
        <p className="mt-1 text-sm text-slate">
          The company sees your application again, with the resume you just
          chose.
        </p>
      </div>
    );
  }

  const defaultResume = resumes[0];

  return (
    <div className="rounded border border-hairline bg-raised px-4 py-3.5">
      <p className="text-sm font-semibold text-navy">You withdrew from this opening</p>
      {!canReapply ? (
        <p className="mt-1 text-sm text-slate">
          The application stays withdrawn — this opening is no longer
          accepting applications.
        </p>
      ) : (
        <form action={action} className="mt-3">
          <input type="hidden" name="openingId" value={openingId} />

          {resumes.length > 1 ? (
            <fieldset className="mb-3">
              <legend className="text-sm font-semibold text-navy">
                Re-apply with
              </legend>
              <div className="mt-2 space-y-1.5">
                {resumes.map((resume) => (
                  <label
                    key={resume.id}
                    className="flex cursor-pointer items-baseline gap-2.5 rounded border border-hairline bg-surface px-3 py-2 text-sm has-checked:border-navy"
                  >
                    <input
                      type="radio"
                      name="resumeId"
                      value={resume.id}
                      defaultChecked={resume.id === defaultResume?.id}
                      className="translate-y-px"
                    />
                    <span className="min-w-0 [overflow-wrap:anywhere] text-slate">
                      {resume.filename}
                      {resume.isPrimary ? (
                        <span className="ml-2 text-xs text-muted">Primary</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : defaultResume ? (
            <input type="hidden" name="resumeId" value={defaultResume.id} />
          ) : null}

          <button
            type="submit"
            disabled={pending || !defaultResume}
            className="inline-flex items-center rounded border border-navy bg-navy px-5 py-2.5 text-sm font-semibold tracking-tight text-white transition-colors hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Re-applying…" : "Re-apply"}
          </button>
          <p className="mt-2 text-xs text-muted">
            Pick a different resume and the company reviews the new document
            from scratch.
          </p>
          {state.status === "error" ? (
            <p role="alert" className="mt-2 text-sm font-semibold text-critical">
              {state.message}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
