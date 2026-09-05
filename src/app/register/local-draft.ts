import type { SubmittedValues } from "./actions";
import type { SavedDraft } from "./saved-draft";

/**
 * Browser-side draft persistence for the registration form.
 *
 * The database only hears about a student when they press "Confirm & pay" —
 * that upsert is the invisible "save". Everything typed before that lived in
 * component state, so a sign-out, a reload, or a crash silently discarded
 * edits and the form reverted to the last SUBMITTED attempt. This keeps a
 * per-account draft in localStorage on every change, and the form restores
 * it on load. Deliberately browser-local (the chosen trade-off): edits
 * survive sign-out on the same device, not across devices.
 *
 * The resume needs one extra rule. A chosen file uploads to Blob storage
 * immediately, but the sweep-resumes cron deletes any blob older than 24h
 * that no student row references. A draft that outlives that grace period
 * would restore a pointer to a deleted file, so a draft resume expires at
 * 20h — unless it came from a submitted row (`fromRow`), which the sweep
 * never touches. Its `savedAt` is stamped once per key, not refreshed per
 * keystroke, so continued editing can't keep a dangling pointer alive.
 */

const VERSION = 1;
const KEY_PREFIX = "aq-register-draft:";
/** Safely inside the sweep's 24h grace period. */
export const RESUME_MAX_AGE_MS = 20 * 60 * 60 * 1000;

export type DraftResume = {
  key: string;
  name: string;
  bytes: number;
  /** True when this key is referenced by a submitted students row. */
  fromRow: boolean;
  /** When this key first entered the draft. */
  savedAt: number;
};

type StoredDraft = {
  v: number;
  values: SubmittedValues;
  resume: DraftResume | null;
};

function storageKey(email: string): string {
  return `${KEY_PREFIX}${email}`;
}

function isValues(candidate: unknown): candidate is SubmittedValues {
  if (typeof candidate !== "object" || candidate === null) return false;
  const v = candidate as Record<string, unknown>;
  const strings = [
    "fullName",
    "phone",
    "cgpa",
    "programme",
    "branch",
    "year",
    "focusArea",
    "skills",
  ];
  return (
    strings.every((field) => typeof v[field] === "string") &&
    typeof v.consent === "boolean"
  );
}

function isResume(candidate: unknown): candidate is DraftResume {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  return (
    typeof r.key === "string" &&
    r.key.length > 0 &&
    typeof r.name === "string" &&
    typeof r.bytes === "number" &&
    typeof r.fromRow === "boolean" &&
    typeof r.savedAt === "number"
  );
}

/**
 * Pure parse — exported for tests. Returns null for anything malformed
 * (garbage, an older version, hand-edited storage) rather than throwing.
 */
export function parseStoredDraft(
  raw: string | null,
  now: number,
): SavedDraft | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const draft = parsed as Partial<StoredDraft>;
  if (draft.v !== VERSION || !isValues(draft.values)) return null;

  const resume =
    isResume(draft.resume) &&
    (draft.resume.fromRow || now - draft.resume.savedAt < RESUME_MAX_AGE_MS)
      ? {
          key: draft.resume.key,
          name: draft.resume.name,
          bytes: draft.resume.bytes,
        }
      : null;

  return { values: draft.values, resume };
}

/**
 * Pure merge of resume metadata — exported for tests. The stamp survives
 * re-saves of the same key; a new key gets a fresh one.
 */
export function nextResumeMeta(
  previous: DraftResume | null,
  current: { key: string; name: string; bytes: number; fromRow: boolean } | null,
  now: number,
): DraftResume | null {
  if (!current) return null;
  if (previous && previous.key === current.key) {
    return { ...current, fromRow: previous.fromRow || current.fromRow, savedAt: previous.savedAt };
  }
  return { ...current, savedAt: now };
}

function readStored(email: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** Best-effort — a full or unavailable storage must never break the form. */
export function saveLocalDraft(
  email: string,
  values: SubmittedValues,
  resume: { key: string; name: string; bytes: number; fromRow: boolean } | null,
): void {
  if (typeof localStorage === "undefined" || !email) return;
  try {
    const previous = readStored(email);
    const stored: StoredDraft = {
      v: VERSION,
      values,
      resume: nextResumeMeta(
        previous && isResume(previous.resume) ? previous.resume : null,
        resume,
        Date.now(),
      ),
    };
    localStorage.setItem(storageKey(email), JSON.stringify(stored));
  } catch {
    // Quota, private mode, disabled storage — the draft is a courtesy.
  }
}

export function loadLocalDraft(email: string): SavedDraft | null {
  if (typeof localStorage === "undefined" || !email) return null;
  try {
    return parseStoredDraft(localStorage.getItem(storageKey(email)), Date.now());
  } catch {
    return null;
  }
}

/**
 * The draft as of the START of this page load, frozen so React sees one
 * stable value for the component's whole life. Built for
 * `useSyncExternalStore`, whose server snapshot is null — the server can't
 * see localStorage, so the first client render must agree with the server
 * HTML and pick the draft up immediately after hydration. Freezing also
 * means the keystroke-by-keystroke saves this page load makes never feed
 * back into the same render cycle (which would remount fields mid-typing).
 */
let pageLoadSnapshot: { email: string; draft: SavedDraft | null } | null = null;

export function getLocalDraftSnapshot(email: string): SavedDraft | null {
  if (!pageLoadSnapshot || pageLoadSnapshot.email !== email) {
    pageLoadSnapshot = { email, draft: loadLocalDraft(email) };
  }
  return pageLoadSnapshot.draft;
}

/** Registration is complete — the row is the record; stop holding PII here. */
export function clearLocalDraft(email: string): void {
  if (typeof localStorage === "undefined" || !email) return;
  try {
    localStorage.removeItem(storageKey(email));
  } catch {
    // Same posture as save.
  }
}
