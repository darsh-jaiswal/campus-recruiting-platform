"use client";

import { useActionState, useState } from "react";
import { BRANCHES, OPENING_FOCUS_AREAS, REGISTRATION } from "@/lib/content";
import { JD_UPLOAD } from "@/lib/openings";
import {
  createOpening,
  updateOpening,
  type OpeningActionState,
} from "./actions";

/**
 * The new-opening form.
 *
 * Two-column: role content on the left, eligibility filters and the private
 * AI screening prompt on the right. Branch chips are real checkboxes styled
 * as chips and submit natively via formData.getAll; their checked state is
 * controlled only so the "All departments" chip can clear them (empty
 * selection = every branch eligible, same contract as validation.ts).
 *
 * Two submit paths share one action: the clicked button contributes `intent`.
 */

const INITIAL: OpeningActionState = { status: "idle" };

const INPUT =
  "mt-2 w-full rounded border border-hairline-strong bg-surface px-3.5 py-2.5 text-slate transition-colors hover:border-muted focus:border-navy focus:outline-none";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-sm text-critical">{message}</p>;
}

type JdFile =
  | { phase: "idle" }
  | { phase: "uploading"; name: string }
  | { phase: "done"; key: string; name: string; bytes: number; contentType: string }
  | { phase: "error"; message: string };

/** Serializable slice of an opening the edit page passes down. */
export type EditableOpening = {
  id: number;
  title: string;
  focusArea: string;
  description: string;
  screeningPrompt: string | null;
  minCgpa: string | null;
  eligibleBranches: string[];
  skills: string[];
  jdBlobKey: string | null;
  jdFilename: string | null;
  jdBytes: number | null;
  jdContentType: string | null;
};

export function OpeningForm({ opening }: { opening?: EditableOpening }) {
  const isEdit = opening !== undefined;
  const [state, action, pending] = useActionState(
    isEdit ? updateOpening : createOpening,
    INITIAL,
  );
  const fields = state.status === "error" ? (state.fields ?? {}) : {};
  // React 19 resets every field after a form action returns, so a failed
  // submit re-fills the form from the echoed values instead of wiping it.
  const values = state.status === "error" ? state.values : undefined;

  // Controlled ONLY so the "All departments" chip can clear the selection;
  // the checkboxes still submit natively. Empty = every branch eligible.
  const [branches, setBranches] = useState<string[]>(
    () => values?.eligibleBranches ?? opening?.eligibleBranches ?? [],
  );

  // Client state, so an uploaded JD survives a failed submit — the hidden
  // inputs below are controlled and immune to the post-action form reset.
  // In edit mode it starts as the opening's existing file; "Remove" drops it
  // back to idle, which submits no key and clears the attachment on save.
  const [jd, setJd] = useState<JdFile>(
    opening?.jdBlobKey
      ? {
          phase: "done",
          key: opening.jdBlobKey,
          name: opening.jdFilename ?? "JD document",
          bytes: opening.jdBytes ?? 0,
          contentType: opening.jdContentType ?? "application/pdf",
        }
      : { phase: "idle" },
  );

  async function handleJdPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!(JD_UPLOAD.acceptedTypes as readonly string[]).includes(file.type)) {
      setJd({ phase: "error", message: `The JD must be ${JD_UPLOAD.acceptedLabel}.` });
      return;
    }
    if (file.size > JD_UPLOAD.maxBytes) {
      setJd({ phase: "error", message: `That file is over the ${JD_UPLOAD.maxLabel} limit.` });
      return;
    }

    setJd({ phase: "uploading", name: file.name });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/openings/jd/upload", { method: "POST", body });
      const data = (await res.json()) as { key?: string; error?: string };
      if (!res.ok || !data.key) {
        setJd({ phase: "error", message: data.error ?? "Upload failed. Try again." });
        return;
      }
      setJd({
        phase: "done",
        key: data.key,
        name: file.name,
        bytes: file.size,
        contentType: file.type,
      });
    } catch {
      setJd({
        phase: "error",
        message: "That upload did not complete. Check your connection and try again.",
      });
    }
  }

  return (
    <form action={action} className="grid gap-x-16 gap-y-10 lg:grid-cols-2">
      {/* ------------------------------------------------ Role (left) */}
      <div className="flex flex-col gap-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          Role
        </p>

        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-navy">
            Job title <span aria-hidden="true">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            defaultValue={values?.title ?? opening?.title}
            required
            placeholder="e.g. Software Development Engineer — Intern"
            className={INPUT}
          />
          <FieldError message={fields.title} />
        </div>

        <div>
          <label
            htmlFor="focusArea"
            className="block text-sm font-semibold text-navy"
          >
            Focus area <span aria-hidden="true">*</span>
          </label>
          <p className="mt-1 text-xs text-muted">
            Drives which candidate pool the opening is matched against.
          </p>
          <select
            id="focusArea"
            name="focusArea"
            required
            defaultValue={values?.focusArea ?? opening?.focusArea}
            className={INPUT}
          >
            {OPENING_FOCUS_AREAS.map((area) => (
              <option key={area.code} value={area.code}>
                {area.name}
              </option>
            ))}
          </select>
          <FieldError message={fields.focusArea} />
        </div>

        <div className="flex flex-1 flex-col">
          <label
            htmlFor="description"
            className="block text-sm font-semibold text-navy"
          >
            Job description <span aria-hidden="true">*</span>
          </label>
          <p className="mt-1 text-xs text-muted">
            Visible to all students. Role, responsibilities, stipend, location.
          </p>
          <textarea
            id="description"
            name="description"
            rows={9}
            defaultValue={values?.description ?? opening?.description}
            required
            className={`${INPUT} min-h-[200px] flex-1 resize-y leading-relaxed`}
          />
          <FieldError message={fields.description} />
        </div>

        <div>
          <label htmlFor="jdFile" className="block text-sm font-semibold text-navy">
            JD document{" "}
            <span className="ml-1 text-xs font-normal text-muted">optional</span>
          </label>
          <p className="mt-1 text-xs text-muted">
            {JD_UPLOAD.acceptedLabel}, under {JD_UPLOAD.maxLabel}. Attached to the
            opening and read by the AI when scoring applicants.
          </p>
          <input
            id="jdFile"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleJdPick}
            disabled={jd.phase === "uploading"}
            className="mt-2 block w-full cursor-pointer rounded border border-hairline-strong bg-surface text-sm text-slate file:mr-4 file:cursor-pointer file:border-0 file:border-r file:border-hairline-strong file:bg-raised file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-navy hover:file:bg-sunken"
          />
          {jd.phase === "uploading" ? (
            <p className="mt-1.5 text-sm text-muted">Uploading {jd.name}…</p>
          ) : jd.phase === "done" ? (
            <p className="mt-1.5 flex items-center gap-3 text-sm text-slate">
              <span>
                <span className="font-semibold text-navy">{jd.name}</span>{" "}
                attached.
              </span>
              <button
                type="button"
                onClick={() => setJd({ phase: "idle" })}
                className="text-muted underline-offset-4 hover:text-critical hover:underline"
              >
                Remove
              </button>
            </p>
          ) : null}
          <FieldError
            message={jd.phase === "error" ? jd.message : fields.jdBlobKey}
          />
          {/* Controlled hidden fields: survive the post-action form reset. */}
          {jd.phase === "done" ? (
            <>
              <input type="hidden" name="jdBlobKey" value={jd.key} />
              <input type="hidden" name="jdFilename" value={jd.name} />
              <input type="hidden" name="jdBytes" value={jd.bytes} />
              <input type="hidden" name="jdContentType" value={jd.contentType} />
            </>
          ) : null}
        </div>
      </div>

      {/* ------------------------------------- Filters + prompt (right) */}
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Eligibility filters
          </p>

          <div>
            <label
              htmlFor="minCgpa"
              className="block text-sm font-semibold text-navy"
            >
              Minimum CGPA{" "}
              <span className="ml-1 text-xs font-normal text-muted">optional</span>
            </label>
            <p className="mt-1 text-xs text-muted">
              Students below this cannot apply.
            </p>
            <input
              id="minCgpa"
              name="minCgpa"
              type="number"
              defaultValue={values?.minCgpa ?? opening?.minCgpa ?? undefined}
              step="0.1"
              min={REGISTRATION.minCgpa}
              max={REGISTRATION.maxCgpa}
              placeholder="7.0"
              data-figure
              className={`${INPUT} w-36`}
            />
            <FieldError message={fields.minCgpa} />
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-navy">
              Eligible branches
            </legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setBranches([])}
                aria-pressed={branches.length === 0}
                className={`rounded border px-3 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy ${
                  branches.length === 0
                    ? "border-navy bg-navy font-semibold text-white"
                    : "border-hairline-strong text-slate hover:border-navy"
                }`}
              >
                All departments
              </button>
              {BRANCHES.map((branch) => (
                <label key={branch.code} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="eligibleBranches"
                    value={branch.code}
                    checked={branches.includes(branch.code)}
                    onChange={(event) =>
                      setBranches((current) =>
                        event.target.checked
                          ? [...current, branch.code]
                          : current.filter((code) => code !== branch.code),
                      )
                    }
                    className="peer sr-only"
                  />
                  <span className="inline-block rounded border border-hairline-strong px-3 py-1.5 text-sm text-slate transition-colors hover:border-navy peer-checked:border-navy peer-checked:bg-navy peer-checked:font-semibold peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-navy">
                    {branch.code} · {branch.programme}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="skills"
              className="block text-sm font-semibold text-navy"
            >
              Required skills{" "}
              <span className="ml-1 text-xs font-normal text-muted">optional</span>
            </label>
            <p className="mt-1 text-xs text-muted">
              Comma-separated. Shown to students on the posting.
            </p>
            <input
              id="skills"
              name="skills"
              type="text"
              defaultValue={values?.skills ?? opening?.skills.join(", ")}
              placeholder="e.g. Java, Spring Boot, SQL"
              className={INPUT}
            />
            <FieldError message={fields.skills} />
          </div>
        </div>

        <div className="rounded border border-hairline-strong p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-navy">
              AI candidate screening
            </p>
            <span className="rounded-sm bg-navy px-2 py-0.5 text-xs font-semibold text-white">
              Private — never shown to students
            </span>
          </div>
          <p className="mt-3 max-w-[60ch] text-sm text-slate">
            Describe the candidate you actually want. Claude scores every
            application against this prompt and the job description, and ranks
            the applicant list for you.
          </p>
          <label
            htmlFor="screeningPrompt"
            className="mt-4 block text-sm font-semibold text-navy"
          >
            Screening prompt
          </label>
          <textarea
            id="screeningPrompt"
            name="screeningPrompt"
            rows={5}
            defaultValue={values?.screeningPrompt ?? opening?.screeningPrompt ?? undefined}
            placeholder="e.g. Prioritise candidates with at least one shipped backend project — Go or Node preferred over coursework Java. Weigh project evidence over CGPA once CGPA is above 8."
            className={`${INPUT} min-h-[112px] resize-y leading-relaxed`}
          />
          <p className="mt-2 text-xs text-muted">
            Visible only to your hiring team. You can edit it and re-run scoring
            after the opening is live.
          </p>
          <FieldError message={fields.screeningPrompt} />
        </div>
      </div>

      {/* ------------------------------------------------------ Submit */}
      <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-6 lg:col-span-2">
        {isEdit ? (
          <>
            <input type="hidden" name="openingId" value={opening.id} />
            <button
              type="submit"
              disabled={pending || jd.phase === "uploading"}
              className="inline-flex items-center rounded border border-navy bg-navy px-5 py-3 text-sm font-semibold tracking-tight text-white transition-colors hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            <p className="text-xs text-muted">
              Changing the description, screening prompt or JD marks existing
              AI scores stale — re-run scoring afterwards.
            </p>
          </>
        ) : (
          <>
            <button
              type="submit"
              name="intent"
              value="publish"
              disabled={pending || jd.phase === "uploading"}
              className="inline-flex items-center rounded border border-navy bg-navy px-5 py-3 text-sm font-semibold tracking-tight text-white transition-colors hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Saving…" : "Publish opening"}
            </button>
            <button
              type="submit"
              name="intent"
              value="draft"
              disabled={pending || jd.phase === "uploading"}
              className="inline-flex items-center rounded border border-hairline-strong bg-transparent px-5 py-3 text-sm font-semibold tracking-tight text-navy transition-colors hover:border-navy hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save draft
            </button>
            <p className="text-xs text-muted">
              Publishing makes the opening visible to all eligible students
              immediately.
            </p>
          </>
        )}
        {state.status === "error" ? (
          <p role="alert" className="w-full text-sm font-semibold text-critical">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
