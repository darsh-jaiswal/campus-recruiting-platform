"use client";

import Script from "next/script";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/Button";
import {
  Checkbox,
  Field,
  Honeypot,
  Input,
  Select,
  Textarea,
  describedBy,
} from "@/components/ui/Field";
import { BRANCHES, FOCUS_AREAS, REGISTRATION, REGISTRATION_FEE } from "@/lib/content";
import { submitRegistration, type RegisterState, type SubmittedValues } from "./actions";
import { sanitizeCgpa, validateForReview } from "./client-validation";
import {
  clearLocalDraft,
  getLocalDraftSnapshot,
  saveLocalDraft,
} from "./local-draft";
import type { SavedDraft } from "./saved-draft";

/** The draft snapshot never notifies — it is frozen per page load. */
const subscribeToNothing = () => () => {};

type UploadState =
  | { phase: "empty" }
  | { phase: "uploading"; percent: number; name: string }
  /** `restored`: rehydrated from a saved pending row rather than picked in this session. */
  | { phase: "done"; key: string; name: string; bytes: number; restored?: boolean }
  | { phase: "error"; message: string };

/**
 * Form → Review → (payment, if a fee is set) → Success. A review screen
 * rather than a confirmation checkbox: a checkbox gets ticked reflexively,
 * while a displayed "CGPA: 7.00" makes a wrong value visible while it is
 * still free to fix. See the design spec, Part 3.
 */
type Phase = "editing" | "review" | "confirming" | "confirming_timeout" | "paid";

const INITIAL: RegisterState = { status: "idle" };
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 45; // 90s

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme?: { color: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayOptions,
    ) => { open: () => void; close: () => void };
  }
}

// Bytes go browser -> this function -> Blob, since a private Blob store
// doesn't support the direct-to-Blob client-token flow (its CORS preflight
// rejects the token PUT). fetch() has no upload-progress event, so this uses
// XHR to keep the progress bar real.
function uploadResume(
  file: File,
  onProgress: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.set("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/resume/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Upload response was not valid JSON."));
        return;
      }

      const parsed = body as { key?: string; error?: string };
      if (xhr.status >= 200 && xhr.status < 300 && parsed.key) {
        resolve(parsed.key);
      } else {
        reject(new Error(parsed.error ?? "Upload failed."));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));

    xhr.send(body);
  });
}

function readFormValues(form: HTMLFormElement): SubmittedValues {
  const data = new FormData(form);
  return {
    fullName: String(data.get("fullName") ?? ""),
    phone: String(data.get("phone") ?? ""),
    cgpa: String(data.get("cgpa") ?? ""),
    programme: String(data.get("programme") ?? ""),
    branch: String(data.get("branch") ?? ""),
    year: String(data.get("year") ?? ""),
    focusArea: String(data.get("focusArea") ?? ""),
    skills: String(data.get("skills") ?? ""),
    consent: data.get("consent") === "on",
  };
}

export function RegistrationForm({
  email,
  suggestedName,
  savedDraft,
}: {
  email: string;
  suggestedName: string;
  /** A saved-but-unpaid earlier attempt to restore, if the account has one. */
  savedDraft?: SavedDraft | null;
}) {
  const [state, formAction, pending] = useActionState(submitRegistration, INITIAL);
  const [pickedFile, setFile] = useState<UploadState>(() =>
    savedDraft?.resume
      ? {
          phase: "done",
          key: savedDraft.resume.key,
          name: savedDraft.resume.name,
          bytes: savedDraft.resume.bytes,
          restored: true,
        }
      : { phase: "empty" },
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();

  const [phase, setPhase] = useState<Phase>("editing");
  const [reviewValues, setReviewValues] = useState<SubmittedValues | null>(null);
  const [finalRefCode, setFinalRefCode] = useState<string | null>(null);
  const [checkoutReady, setCheckoutReady] = useState(false);
  /** Set by "Continue to review" when fields fail the client-side mirror of the server rules. */
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  /**
   * Unsubmitted edits from a previous visit on THIS device. The store
   * snapshot is frozen per page load (see local-draft.ts) and the server
   * snapshot is null, so the first client render agrees with the server
   * HTML and the draft applies right after hydration.
   */
  const localDraft = useSyncExternalStore(
    subscribeToNothing,
    () => getLocalDraftSnapshot(email),
    () => null,
  );

  // The draft's resume wins over one restored from the submitted row (it may
  // be a newer upload) — but never over a file the student picked THIS
  // session, which is what the `restored` flag distinguishes.
  const draftResume = localDraft?.resume ?? null;
  const file: UploadState =
    draftResume &&
    (pickedFile.phase === "empty" ||
      (pickedFile.phase === "done" && pickedFile.restored))
      ? { phase: "done", ...draftResume, restored: true }
      : pickedFile;

  // Registration is complete — the database row is the record now.
  const finished = state.status === "success" || phase === "paid";
  useEffect(() => {
    if (finished) clearLocalDraft(email);
  }, [finished, email]);

  /**
   * Snapshot the form into the draft. Runs on every change event — writing
   * a small JSON blob per keystroke is cheap, and "the draft is whatever
   * the form says right now" leaves no state to reconcile.
   */
  function persistDraft(resumeOverride?: { key: string; name: string; bytes: number }) {
    const form = formRef.current;
    if (!form) return;
    const current =
      resumeOverride ??
      (file.phase === "done"
        ? { key: file.key, name: file.name, bytes: file.bytes }
        : null);
    saveLocalDraft(
      email,
      readFormValues(form),
      current
        ? { ...current, fromRow: savedDraft?.resume?.key === current.key }
        : null,
    );
  }

  const hasClientErrors = Object.keys(clientErrors).length > 0;
  const errors = hasClientErrors
    ? clientErrors
    : state.status === "error"
      ? (state.errors ?? {})
      : {};
  // What the fields default to: the error echo (what the student just typed)
  // wins over unsubmitted edits from this device, which win over the last
  // submitted attempt, which wins over blank.
  const values =
    state.status === "error"
      ? state.values
      : (localDraft?.values ?? savedDraft?.values);
  const fid = (name: string) => `${id}-${name}`;

  // Forces the uncontrolled fields below to remount with fresh `defaultValue`s
  // on every new error — otherwise React drops what the student typed the
  // moment a `<form action>` submission completes, success or failure. The
  // local-draft case needs the same remount: the draft loads AFTER hydration,
  // so its defaults only take effect if the fields are recreated.
  const formKey =
    state.status === "error"
      ? JSON.stringify(state)
      : localDraft
        ? "local-draft"
        : "initial";

  // A fee is configured and the row is saved — open Razorpay Checkout. The
  // browser's role stops here: `handler` only moves the UI to "confirming".
  // The webhook, not this callback, is what actually completes registration.
  useEffect(() => {
    if (state.status !== "awaiting_payment") return;
    if (!checkoutReady || !window.Razorpay) return;

    const checkout = new window.Razorpay({
      key: state.keyId,
      amount: state.amountPaise,
      currency: "INR",
      order_id: state.razorpayOrderId,
      name: "Aspire Quest",
      description: "Registration fee",
      prefill: { name: state.fullName, email: state.email, contact: state.phone },
      theme: { color: "#0d0d0d" },
      handler: () => setPhase("confirming"),
      modal: {
        // A hard reload rather than a client-side state reset: Razorpay's
        // Checkout.js can leave a dismissed popup's overlay in a state that
        // silently blocks a fresh instance from reopening later in the same
        // page session (see the .close() cleanup above, which helps but
        // isn't a guarantee). A real reload clears every bit of that client
        // state — the student's row is already saved server-side from this
        // submit, and the reloaded page restores it as `savedDraft`, so
        // nothing is lost at all.
        ondismiss: () => {
          // A real browser navigation on purpose, not router.push() — a soft
          // SPA transition wouldn't reload the page at all here (same
          // route), so it would leave Razorpay's script state exactly as
          // stale as before. This needs an actual reload.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/register";
        },
      },
    });

    checkout.open();

    // Razorpay can leave the previous popup's overlay in a state that
    // silently blocks a fresh .open() call if a new instance is created
    // without ever closing the last one — we only ever called .open(),
    // never .close(). Closing on cleanup covers both a resubmit after a
    // dismissed payment (this effect reruns with a new order) and leaving
    // the page while the popup is still open.
    return () => {
      checkout.close();
    };
  }, [state, checkoutReady]);

  // Polls for the webhook's result. Display-only — see /api/payments/status.
  useEffect(() => {
    if (phase !== "confirming") return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;

      try {
        const res = await fetch("/api/payments/status", { cache: "no-store" });
        const data = (await res.json()) as {
          found: boolean;
          paymentStatus?: string;
          refCode?: string | null;
        };
        if (data.found && data.paymentStatus === "paid" && data.refCode) {
          if (!cancelled) {
            setFinalRefCode(data.refCode);
            setPhase("paid");
          }
          return;
        }
      } catch {
        // Network hiccup — keep polling rather than failing the student out.
      }

      if (cancelled) return;
      if (attempts >= POLL_MAX_ATTEMPTS) {
        setPhase("confirming_timeout");
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return setFile({ phase: "empty" });

    // Client-side checks are a courtesy; the upload token enforces both again.
    if (selected.type !== "application/pdf") {
      setFile({ phase: "error", message: "Your resume must be a PDF." });
      return;
    }
    if (selected.size > REGISTRATION.resumeMaxBytes) {
      setFile({
        phase: "error",
        message: `That file is ${(selected.size / 1024 / 1024).toFixed(1)} MB. The limit is ${REGISTRATION.resumeMaxLabel}.`,
      });
      return;
    }

    setFile({ phase: "uploading", percent: 0, name: selected.name });

    try {
      const key = await uploadResume(selected, (percent) =>
        setFile({ phase: "uploading", percent, name: selected.name }),
      );

      setFile({
        phase: "done",
        key,
        name: selected.name,
        bytes: selected.size,
      });
      // The form's onChange fired while the upload was still in flight, so
      // the draft doesn't know the key yet — snapshot again now that it does.
      persistDraft({ key, name: selected.name, bytes: selected.size });
    } catch (error) {
      console.error("[register] resume upload failed:", error);
      setFile({
        phase: "error",
        message:
          "That upload did not complete. Check your connection and try again.",
      });
    }
  }

  function handleContinueToReview() {
    const form = formRef.current;
    if (!form) return;

    // Inline messages under each field, not the browser's one-at-a-time
    // native bubble (which this replaces): a student sees every problem at
    // once, in place. The server schema remains the real enforcement — this
    // mirrors it so the FIRST feedback no longer arrives only after
    // "Confirm & pay", where a rejection read as the button doing nothing.
    const candidate = readFormValues(form);
    const problems = validateForReview(candidate, file.phase === "done");
    setClientErrors(problems);

    const [firstProblem] = Object.keys(problems);
    if (firstProblem) {
      // Validator order matches page order, so this is the topmost one.
      const anchor = firstProblem === "resumeBlobKey" ? "resume" : firstProblem;
      document
        .getElementById(fid(anchor))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setReviewValues(candidate);
    setPhase("review");
  }

  // Free-flow path: no fee is configured (EDITION-style TBA), so the action
  // completes registration directly with no payment step at all.
  if (state.status === "success") {
    return <SuccessPanel refCode={state.refCode} />;
  }

  if (phase === "paid" && finalRefCode) {
    return <SuccessPanel refCode={finalRefCode} />;
  }

  if (phase === "confirming" || phase === "confirming_timeout") {
    return (
      <ConfirmingPanel timedOut={phase === "confirming_timeout"} email={email} />
    );
  }

  const uploadBusy = file.phase === "uploading";
  const resumeError =
    file.phase === "error" ? file.message : errors.resumeBlobKey;
  const canContinue = !pending && !uploadBusy && file.phase === "done";
  const feeSet = REGISTRATION_FEE.amountPaise !== null;
  // A server-side error (validation failure, save failure, already-registered)
  // falls back to the editable form with the message visible, even if the
  // student was on the review screen when they submitted.
  const inReview = phase === "review" && state.status !== "error";

  return (
    <>
      {feeSet ? (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
          // onLoad only ever fires the first time this script loads in the
          // browser tab (Next.js's Script dedupes by src across mounts). A
          // student who dismisses Checkout, leaves /register, and comes back
          // remounts this component with checkoutReady reset to false, but
          // the script is already cached — onLoad never refires, so Pay
          // silently does nothing. onReady fires on that case too.
          onReady={() => setCheckoutReady(true)}
        />
      ) : null}

      <form
        ref={formRef}
        action={formAction}
        className="relative"
        noValidate
        // Change events from every field bubble here — each one snapshots
        // the whole form into the device-local draft.
        onChange={() => persistDraft()}
      >
        <Honeypot name="website" />

        {state.status === "error" ? (
          <div
            ref={(node) => {
              // The submit button sits at the bottom of a long page; without
              // this, a refusal renders above the fold and reads as "nothing
              // happened".
              node?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            role="alert"
            className="mb-8 rounded border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical"
          >
            {state.message}
          </div>
        ) : null}

        {(localDraft || savedDraft) && state.status === "idle" && !inReview ? (
          <p className="mb-8 rounded border border-hairline-strong bg-amber-wash px-4 py-3 text-sm text-slate">
            <span className="font-semibold text-navy">Welcome back.</span> The
            details you entered earlier are filled in below. Check them and
            continue when you&rsquo;re ready.
          </p>
        ) : null}

        {inReview ? (
          <ReviewSummary
            values={reviewValues}
            email={email}
            resumeName={file.phase === "done" ? file.name : undefined}
          />
        ) : null}

        <div className={inReview ? "hidden" : undefined}>
          <fieldset className="border-0 p-0">
            <legend className="text-eyebrow font-semibold uppercase text-muted">
              About you
            </legend>

            <div key={`${formKey}-about`} className="mt-6 grid gap-6 sm:grid-cols-2">
              <Field
                label="Full name"
                htmlFor={fid("fullName")}
                error={errors.fullName}
                required
              >
                <Input
                  id={fid("fullName")}
                  name="fullName"
                  autoComplete="name"
                  required
                  defaultValue={values?.fullName ?? suggestedName}
                  aria-invalid={errors.fullName ? true : undefined}
                  aria-describedby={describedBy(fid("fullName"), undefined, errors.fullName)}
                />
              </Field>

              {/* min-w-0: a grid child won't shrink below its content, and an
                  email is one unbreakable token — without it a long address
                  drags the whole column wide and misaligns the form (same
                  trap as the screening table). The box keeps ONE line: an
                  RTL-direction wrapper puts the ellipsis at the START, so a
                  too-long address hides its beginning and keeps the readable
                  tail; the inner span isolates the address back to LTR so the
                  characters render in order. Full address on hover (title). */}
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-navy">
                  Email
                </span>
                <p className="mt-1 text-xs text-muted">
                  From the account you signed in with. Shortlist updates go here.
                </p>
                <p
                  title={email}
                  className="mt-2 truncate rounded border border-hairline-strong bg-sunken px-3.5 py-2.5 text-left text-slate [direction:rtl]"
                >
                  <span className="[direction:ltr] [unicode-bidi:isolate]">
                    {email}
                  </span>
                </p>
              </div>

              <Field
                label="Mobile number"
                htmlFor={fid("phone")}
                error={errors.phone}
                hint="10 digits, Indian mobile."
                required
              >
                <Input
                  id={fid("phone")}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className="tabular"
                  defaultValue={values?.phone}
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={describedBy(fid("phone"), "hint", errors.phone)}
                />
              </Field>

              <Field
                label="CGPA"
                htmlFor={fid("cgpa")}
                error={errors.cgpa}
                hint="Current cumulative, e.g. 7.85."
                required
              >
                <Input
                  id={fid("cgpa")}
                  name="cgpa"
                  inputMode="decimal"
                  placeholder="7.85"
                  required
                  className="tabular"
                  defaultValue={values?.cgpa}
                  // Guarded only when the value actually changes: rewriting
                  // an uncontrolled input's value throws the cursor to the
                  // end, which is fine on a rejected keystroke but would
                  // fight anyone editing mid-value otherwise.
                  onInput={(event) => {
                    const input = event.currentTarget;
                    const next = sanitizeCgpa(input.value);
                    if (next !== input.value) input.value = next;
                  }}
                  aria-invalid={errors.cgpa ? true : undefined}
                  aria-describedby={describedBy(fid("cgpa"), "hint", errors.cgpa)}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="mt-12 border-0 p-0">
            <legend className="text-eyebrow font-semibold uppercase text-muted">
              Your programme
            </legend>

            <div key={`${formKey}-programme`} className="mt-6 grid gap-6 sm:grid-cols-3">
              <ProgrammeAndBranchFields
                defaultProgramme={values?.programme}
                defaultBranch={values?.branch}
                programmeError={errors.programme}
                branchError={errors.branch}
                fid={fid}
              />

              <Field label="Year" htmlFor={fid("year")} error={errors.year} required>
                <Select
                  id={fid("year")}
                  name="year"
                  required
                  defaultValue={values?.year ?? ""}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {REGISTRATION.years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </fieldset>

          <fieldset key={`${formKey}-focus`} className="mt-12 border-0 p-0">
            <legend className="text-eyebrow font-semibold uppercase text-muted">
              What you want to be considered for
            </legend>

            <p className="mt-3 text-sm text-muted">
              Pick one. Partner openings are screened against it.
            </p>

            <div
              id={fid("focusArea")}
              role="radiogroup"
              aria-label="Focus area"
              className="mt-5 grid gap-px overflow-hidden rounded border border-hairline bg-hairline sm:grid-cols-2"
            >
              {FOCUS_AREAS.map((area) => (
                <label
                  key={area.code}
                  className="group flex cursor-pointer gap-3.5 bg-surface p-5 transition-colors hover:bg-raised has-[:checked]:bg-amber-wash"
                >
                  <input
                    type="radio"
                    name="focusArea"
                    value={area.code}
                    required
                    defaultChecked={values?.focusArea === area.code}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-navy)]"
                  />
                  <span>
                    <span className="block font-semibold text-navy">
                      {area.name}
                    </span>
                    <span className="mt-1 block text-sm text-slate">
                      {area.summary}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {errors.focusArea ? (
              <p className="mt-2 text-sm text-critical" role="alert">
                {errors.focusArea}
              </p>
            ) : null}

            <Field
              label="Skills"
              htmlFor={fid("skills")}
              error={errors.skills}
              hint="Comma separated, up to 12. e.g. Python, ROS, PCB design"
              className="mt-8"
            >
              <Textarea
                id={fid("skills")}
                name="skills"
                rows={2}
                className="min-h-0"
                defaultValue={values?.skills}
                aria-describedby={describedBy(fid("skills"), "hint", errors.skills)}
              />
            </Field>
          </fieldset>

          <fieldset className="mt-12 border-0 p-0">
            <legend className="text-eyebrow font-semibold uppercase text-muted">
              Resume
            </legend>

            <Field
              label="Resume"
              htmlFor={fid("resume")}
              error={resumeError}
              hint={`${REGISTRATION.resumeAcceptedLabel}, up to ${REGISTRATION.resumeMaxLabel}.`}
              required
              className="mt-6"
            >
              <input
                ref={fileInputRef}
                id={fid("resume")}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                aria-invalid={resumeError ? true : undefined}
                aria-describedby={describedBy(fid("resume"), "hint", resumeError)}
                className="block w-full cursor-pointer rounded border border-hairline-strong bg-surface text-sm text-slate file:mr-4 file:cursor-pointer file:border-0 file:border-r file:border-hairline-strong file:bg-raised file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-navy hover:file:bg-sunken"
              />

              <div aria-live="polite" className="mt-3 text-sm">
                {file.phase === "uploading" ? (
                  <p className="text-muted">
                    Uploading {file.name} —{" "}
                    <span data-figure className="font-semibold text-navy">
                      {file.percent}%
                    </span>
                  </p>
                ) : null}
                {file.phase === "done" ? (
                  <p className="font-semibold text-positive">
                    {file.restored
                      ? `${file.name} is already on file — choose a file only to replace it.`
                      : `${file.name} uploaded.`}
                  </p>
                ) : null}
              </div>
            </Field>

            {file.phase === "done" ? (
              <>
                <input type="hidden" name="resumeBlobKey" value={file.key} />
                <input type="hidden" name="resumeFilename" value={file.name} />
                <input type="hidden" name="resumeBytes" value={file.bytes} />
              </>
            ) : null}
          </fieldset>

          <div key={`${formKey}-consent`} className="mt-12 rounded border border-hairline bg-raised p-6">
            <Checkbox
              id={fid("consent")}
              name="consent"
              required
              defaultChecked={values?.consent}
              error={errors.consent}
              label={
                <>
                  I agree that the organizing institution may store the details and resume I have
                  submitted, and share them with the partner companies shortlisting
                  for Aspire Quest. I understand my resume is kept in private
                  storage, that every access to it is logged, and that my records
                  are deleted after the stated retention period.
                </>
              }
            />
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="accent"
              disabled={!canContinue}
              onClick={handleContinueToReview}
            >
              Continue to review
            </Button>
            {hasClientErrors ? (
              // The Continue button sits at the bottom of a long form, so the
              // click needs an answer HERE too, not only at the fields above.
              <p role="alert" className="text-sm font-semibold text-critical">
                Some fields need fixing — they&rsquo;re marked in red above.
              </p>
            ) : (
              <p className="text-sm text-muted">
                {file.phase === "done"
                  ? "Check your details on the next screen before it's final."
                  : "Upload your resume to continue."}
              </p>
            )}
          </div>
        </div>

        {inReview ? (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" onClick={() => setPhase("editing")}>
              Edit
            </Button>
            <Button type="submit" variant="accent" disabled={pending}>
              {pending
                ? "Saving…"
                : feeSet
                  ? `Confirm & pay ${REGISTRATION_FEE.label}`
                  : "Confirm & submit"}
            </Button>
          </div>
        ) : null}
      </form>
    </>
  );
}

/**
 * Branch options are filtered to whatever the currently selected programme
 * allows, so an invalid pair can't be picked in the first place — the
 * combination used to only get caught by server validation after submit,
 * which put the burden on the student to already know which branches belong
 * to which programme.
 */
function ProgrammeAndBranchFields({
  defaultProgramme,
  defaultBranch,
  programmeError,
  branchError,
  fid,
}: {
  defaultProgramme: string | undefined;
  defaultBranch: string | undefined;
  programmeError: string | undefined;
  branchError: string | undefined;
  fid: (name: string) => string;
}) {
  const [programme, setProgramme] = useState(defaultProgramme ?? "");
  const eligibleBranches = BRANCHES.filter((b) => b.programme === programme);
  const branchStillValid = eligibleBranches.some((b) => b.code === defaultBranch);

  return (
    <>
      <Field
        label="Programme"
        htmlFor={fid("programme")}
        error={programmeError}
        required
      >
        <Select
          id={fid("programme")}
          name="programme"
          required
          value={programme}
          onChange={(event) => setProgramme(event.target.value)}
        >
          <option value="" disabled>
            Select
          </option>
          <option value="B.Tech">B.Tech</option>
          <option value="MBA.Tech">MBA.Tech</option>
        </Select>
      </Field>

      <Field
        label="Branch"
        htmlFor={fid("branch")}
        error={branchError}
        hint={programme ? undefined : "Select a programme first."}
        required
      >
        <Select
          id={fid("branch")}
          name="branch"
          required
          disabled={!programme}
          // Remounts (resetting to unselected) whenever the programme
          // changes, since a branch chosen under the old programme is no
          // longer a valid option.
          key={programme}
          defaultValue={branchStillValid ? defaultBranch : ""}
        >
          <option value="" disabled>
            Select
          </option>
          {eligibleBranches.map((branch) => (
            <option key={branch.code} value={branch.code}>
              {branch.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

function ReviewSummary({
  values,
  email,
  resumeName,
}: {
  values: SubmittedValues | null;
  email: string;
  resumeName: string | undefined;
}) {
  if (!values) return null;

  const branch = BRANCHES.find((b) => b.code === values.branch);
  const focusArea = FOCUS_AREAS.find((f) => f.code === values.focusArea);

  const rows: { label: string; value: string }[] = [
    { label: "Full name", value: values.fullName },
    { label: "Email", value: email },
    { label: "Mobile", value: values.phone },
    { label: "CGPA", value: values.cgpa },
    { label: "Programme", value: values.programme },
    { label: "Branch", value: branch ? `${branch.name} (${branch.code})` : values.branch },
    { label: "Year", value: values.year },
    { label: "Focus area", value: focusArea?.name ?? values.focusArea },
    { label: "Skills", value: values.skills || "—" },
    { label: "Resume", value: resumeName ?? "—" },
  ];

  return (
    <div className="mb-10 rounded border border-hairline bg-raised p-6 md:p-8">
      <p className="text-eyebrow font-semibold uppercase text-muted">
        Review before you pay
      </p>
      <h2 className="mt-3 text-h3 font-semibold text-navy">
        Check every field. This is the last point it&rsquo;s free to fix.
      </h2>

      <dl className="mt-6 border-t border-hairline">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[10rem_1fr] gap-4 border-b border-hairline py-3"
          >
            <dt className="text-sm font-semibold text-slate">{row.label}</dt>
            <dd className="text-sm text-navy">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex items-baseline justify-between rounded border border-hairline-strong bg-surface px-5 py-4">
        <span className="text-sm font-semibold text-slate">
          {REGISTRATION_FEE.amountPaise !== null ? "Registration fee" : "Registration"}
        </span>
        <span data-figure className="text-h3 font-semibold text-navy">
          {REGISTRATION_FEE.amountPaise !== null ? REGISTRATION_FEE.label : "Free"}
        </span>
      </div>
    </div>
  );
}

function ConfirmingPanel({ timedOut, email }: { timedOut: boolean; email: string }) {
  return (
    <div className="rounded border border-hairline bg-raised p-8 md:p-12">
      <p className="text-eyebrow font-semibold uppercase text-muted">
        {timedOut ? "Still confirming" : "Confirming your payment"}
      </p>
      <h2 className="mt-5 text-h2 font-semibold">
        {timedOut ? "This is taking a while." : "Almost there…"}
      </h2>
      {timedOut ? (
        <p className="mt-4 max-w-[52ch] text-slate">
          Your payment is still being confirmed. This does not mean it failed —
          confirmation runs independently of this page. Your reference code
          will arrive at <span className="font-semibold text-navy">{email}</span>{" "}
          as soon as it&rsquo;s through; there is no need to pay again or resubmit.
        </p>
      ) : (
        <>
          <span className="loader mt-6 block text-navy" aria-hidden="true" />
          <p className="mt-6 max-w-[52ch] text-slate">
            Do not close this tab. We&rsquo;re waiting for Razorpay to confirm your
            payment — this usually takes a few seconds.
          </p>
        </>
      )}
    </div>
  );
}

function SuccessPanel({ refCode }: { refCode: string }) {
  return (
    <div className="rounded border border-hairline bg-raised p-8 md:p-12">
      <p className="text-eyebrow font-semibold uppercase text-positive">
        Application received
      </p>
      <h2 className="mt-5 text-h2 font-semibold">Save this reference code.</h2>
      <p className="mt-4 max-w-[52ch] text-slate">
        This code is how the organising team identifies your application. It
        stays available on{" "}
        <a
          href="/dashboard"
          className="font-semibold text-navy underline underline-offset-4"
        >
          your application page
        </a>
        , along with your status and everything you submitted.
      </p>

      <p
        data-figure
        className="mt-8 inline-block rounded border-2 border-navy bg-surface px-7 py-5 text-h1 font-semibold tracking-tight text-navy"
      >
        {refCode}
      </p>

      <p className="mt-8 max-w-[52ch] text-sm text-muted">
        Shortlisted candidates are contacted by email once partner companies
        have reviewed the applications to their openings.
      </p>
    </div>
  );
}
