"use client";

import { useActionState } from "react";
import { applyToOpening, type ApplyState } from "../actions";

/**
 * The apply form. Rendered only when the server has already judged the
 * viewer eligible — every state that can't apply gets static markup from the
 * page instead. The action re-checks everything anyway.
 *
 * With one CV in the library this stays the original one-click apply; with
 * more it grows a picker, defaulting to the primary (first in the list —
 * the server orders primary-first).
 */

const INITIAL: ApplyState = { status: "idle" };

export type ApplyResumeOption = {
  id: number;
  filename: string;
  isPrimary: boolean;
};

export function ApplyForm({
  openingId,
  resumes,
}: {
  openingId: number;
  resumes: ApplyResumeOption[];
}) {
  const [state, action, pending] = useActionState(applyToOpening, INITIAL);

  if (state.status === "applied") {
    return (
      <div className="rounded border border-positive/30 bg-positive/5 px-4 py-3.5">
        <p className="text-sm font-semibold text-positive">
          Application submitted.
        </p>
        <p className="mt-1 text-sm text-slate">
          The company sees your registration profile and the resume you chose.
          Shortlist news comes from the Aspire Quest team — there is nothing
          else you need to do here.
        </p>
      </div>
    );
  }

  const defaultResume = resumes[0];

  return (
    <form action={action}>
      <input type="hidden" name="openingId" value={openingId} />

      {resumes.length > 1 ? (
        <fieldset className="mb-4">
          <legend className="text-sm font-semibold text-navy">
            Apply with
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
        className="inline-flex items-center rounded border border-navy bg-navy px-6 py-3 text-sm font-semibold tracking-tight text-white transition-colors hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Applying…" : "Apply with my registration"}
      </button>
      <p className="mt-2 text-xs text-muted">
        {resumes.length > 1
          ? "Your registered profile plus the resume you pick above."
          : defaultResume
            ? `One click — your registered profile and ${defaultResume.filename} are the application.`
            : "No resume on file — add one from your application page first."}
      </p>
      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-critical">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
