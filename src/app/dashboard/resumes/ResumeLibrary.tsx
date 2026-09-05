"use client";

import { useState } from "react";
import { useActionState } from "react";
import type { ResumeRow } from "@/db/queries/resumes";
import { MAX_ACTIVE_RESUMES } from "@/lib/resume-library";
import {
  addResumeAction,
  deleteResumeAction,
  replaceResumeAction,
  setPrimaryResumeAction,
  type LibraryActionState,
} from "./actions";

/**
 * The dashboard's resume manager. Uploads go through the same
 * /api/resume/upload endpoint the registration form uses (blob first, row
 * second), then a Server Action turns the returned key into a library
 * entry. Every rule shown here — the cap, primary-can't-be-deleted — is
 * enforced again server-side; this UI only explains it.
 */

const INITIAL: LibraryActionState = { status: "idle" };

const SIZE_FORMAT = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${SIZE_FORMAT.format(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${SIZE_FORMAT.format(bytes / 1024)} KB`;
  return `${bytes} B`;
}

type Upload =
  | { phase: "idle" }
  | { phase: "uploading"; name: string }
  | { phase: "done"; key: string; name: string; bytes: number }
  | { phase: "error"; message: string };

/** Shared by AddResume and ReplaceResume — same endpoint, same states. */
function useResumeUpload() {
  const [upload, setUpload] = useState<Upload>({ phase: "idle" });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUpload({ phase: "uploading", name: file.name });
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/resume/upload", { method: "POST", body });
      const parsed = (await response.json()) as { key?: string; error?: string };
      if (!response.ok || !parsed.key) {
        setUpload({ phase: "error", message: parsed.error ?? "Upload failed." });
        return;
      }
      setUpload({ phase: "done", key: parsed.key, name: file.name, bytes: file.size });
    } catch {
      setUpload({ phase: "error", message: "Upload failed. Please try again." });
    }
  }

  return { upload, setUpload, handleFileChange };
}

export function ResumeLibrary({
  resumes,
}: {
  resumes: Array<
    Pick<ResumeRow, "id" | "filename" | "bytes" | "isPrimary"> & {
      createdAt: string;
    }
  >;
}) {
  const canAdd = resumes.length < MAX_ACTIVE_RESUMES;

  return (
    <section aria-labelledby="resume-library" className="mt-14">
      <h2
        id="resume-library"
        className="flex items-baseline gap-3 text-eyebrow font-semibold uppercase text-muted"
      >
        Your resumes
        <span data-figure className="font-normal normal-case">
          {resumes.length}/{MAX_ACTIVE_RESUMES}
        </span>
      </h2>
      <p className="mt-3 max-w-[62ch] text-sm text-muted">
        The primary resume is what the organising team sees by default; when
        you apply to an opening you choose which one goes with that
        application, and that choice is permanent for the application — later
        changes here never rewrite what a company already received.
      </p>

      <ul className="mt-4 border-t border-hairline-strong">
        {resumes.map((resume) => (
          <ResumeEntry key={resume.id} resume={resume} />
        ))}
      </ul>

      {canAdd ? (
        <AddResume />
      ) : (
        <p className="mt-4 text-sm text-muted">
          Library full — delete a resume to add a different one.
        </p>
      )}
    </section>
  );
}

function ResumeEntry({
  resume,
}: {
  resume: Pick<ResumeRow, "id" | "filename" | "bytes" | "isPrimary"> & {
    createdAt: string;
  };
}) {
  const [primaryState, primaryAction, primaryPending] = useActionState(
    setPrimaryResumeAction,
    INITIAL,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteResumeAction,
    INITIAL,
  );
  const [armed, setArmed] = useState(false);

  const error =
    deleteState.status === "error"
      ? deleteState.message
      : primaryState.status === "error"
        ? primaryState.message
        : null;

  return (
    <li className="border-b border-hairline py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="min-w-0 text-sm [overflow-wrap:anywhere]">
          <span className="font-semibold text-navy">{resume.filename}</span>{" "}
          <span className="text-muted">· {formatBytes(resume.bytes)}</span>
          {resume.isPrimary ? (
            <span className="ml-2 rounded-sm border border-hairline bg-raised px-1.5 py-0.5 text-xs font-semibold text-slate">
              Primary
            </span>
          ) : null}
        </p>

        {!resume.isPrimary ? (
          <span className="flex items-center gap-4">
            <form action={primaryAction}>
              <input type="hidden" name="resumeId" value={resume.id} />
              <button
                type="submit"
                disabled={primaryPending}
                className="text-sm font-semibold text-slate underline-offset-4 hover:text-navy hover:underline disabled:opacity-50"
              >
                {primaryPending ? "Saving…" : "Make primary"}
              </button>
            </form>
            {armed ? (
              <form action={deleteAction}>
                <input type="hidden" name="resumeId" value={resume.id} />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="text-sm font-semibold text-critical underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {deletePending ? "Deleting…" : "Confirm delete"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setArmed(true)}
                className="text-sm font-semibold text-slate underline-offset-4 hover:text-critical hover:underline"
              >
                Delete
              </button>
            )}
          </span>
        ) : (
          <ReplaceResume resume={resume} />
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-sm font-semibold text-critical">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Lets the student swap the primary resume for a different file in one
 * step, instead of the add → make primary → delete dance the individual
 * actions would otherwise require — the actual gap this closes: with a
 * single resume in the library, Delete is unreachable (the primary can't
 * be deleted with nothing to fall back to) and "Upload another" only grows
 * the library, so there was previously no way to just swap it out.
 */
function ReplaceResume({
  resume,
}: {
  resume: Pick<ResumeRow, "id" | "filename" | "bytes" | "isPrimary">;
}) {
  const [state, formAction, pending] = useActionState(replaceResumeAction, INITIAL);
  const { upload, setUpload, handleFileChange } = useResumeUpload();

  const [handled, setHandled] = useState<LibraryActionState>(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === "success") setUpload({ phase: "idle" });
  }

  if (upload.phase === "done") {
    return (
      <form action={formAction} className="flex flex-wrap items-baseline gap-3">
        <input type="hidden" name="resumeId" value={resume.id} />
        <input type="hidden" name="resumeBlobKey" value={upload.key} />
        <input type="hidden" name="resumeFilename" value={upload.name} />
        <input type="hidden" name="resumeBytes" value={upload.bytes} />
        <span className="min-w-0 text-sm text-slate [overflow-wrap:anywhere]">
          {upload.name} · {formatBytes(upload.bytes)}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="text-sm font-semibold text-navy underline-offset-4 hover:underline disabled:opacity-50"
        >
          {pending ? "Replacing…" : `Replace ${resume.filename}`}
        </button>
        <button
          type="button"
          onClick={() => setUpload({ phase: "idle" })}
          className="text-sm font-semibold text-muted underline-offset-4 hover:text-slate hover:underline"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <span>
      <label className="inline-block cursor-pointer text-sm font-semibold text-slate underline-offset-4 hover:text-navy hover:underline">
        {upload.phase === "uploading" ? `Uploading ${upload.name}…` : "Replace"}
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          onClick={(event) => {
            event.currentTarget.value = "";
          }}
          disabled={upload.phase === "uploading"}
          className="sr-only"
        />
      </label>
      {upload.phase === "error" ? (
        <p role="alert" className="mt-1 text-sm font-semibold text-critical">
          {upload.message}
        </p>
      ) : null}
    </span>
  );
}

function AddResume() {
  const [state, formAction, pending] = useActionState(addResumeAction, INITIAL);
  const { upload, setUpload, handleFileChange } = useResumeUpload();

  // Adjust-state-during-render (guarded): once an add succeeds, the panel
  // resets for the next file. No effect needed — the guard is the state
  // object's identity, which useActionState replaces per completed action.
  const [handled, setHandled] = useState<LibraryActionState>(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === "success") setUpload({ phase: "idle" });
  }

  return (
    <div className="mt-5">
      <label className="inline-block cursor-pointer text-sm font-semibold text-slate underline-offset-4 hover:text-navy hover:underline">
        {upload.phase === "uploading"
          ? `Uploading ${upload.name}…`
          : "Upload another resume (PDF)"}
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          // Clearing on open lets the same file be re-picked after an error.
          onClick={(event) => {
            event.currentTarget.value = "";
          }}
          disabled={upload.phase === "uploading"}
          className="sr-only"
        />
      </label>

      {upload.phase === "done" ? (
        <form action={formAction} className="mt-2 flex flex-wrap items-baseline gap-3">
          <input type="hidden" name="resumeBlobKey" value={upload.key} />
          <input type="hidden" name="resumeFilename" value={upload.name} />
          <input type="hidden" name="resumeBytes" value={upload.bytes} />
          <span className="min-w-0 text-sm text-slate [overflow-wrap:anywhere]">
            {upload.name} · {formatBytes(upload.bytes)}
          </span>
          <button
            type="submit"
            disabled={pending}
            className="rounded border border-navy bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-hover disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add to library"}
          </button>
        </form>
      ) : null}

      {upload.phase === "error" ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-critical">
          {upload.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-critical">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
