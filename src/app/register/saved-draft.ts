import type { SubmittedValues } from "./actions";

/**
 * A returning student's saved-but-unpaid application, rehydrated into the
 * shape the form fields take as defaults.
 *
 * The server action has always saved a `pending_payment` row before payment
 * (see actions.ts — that is what lets an abandoned attempt be resubmitted),
 * but the form never read it back: every default came from in-memory React
 * state, so a reload or a fresh sign-in showed a blank form over a fully
 * saved row. This is the read-back half.
 */
export type SavedDraft = {
  values: SubmittedValues;
  /** The stored resume, resubmittable as-is — no re-upload needed. */
  resume: { key: string; name: string; bytes: number } | null;
};

/** The columns of a `students` row this mapping needs. */
export type SavedDraftRow = {
  fullName: string;
  phone: string;
  /** Drizzle returns numeric(4,2) as a fixed-2 string — already form-ready. */
  cgpa: string;
  programme: string;
  branch: string;
  year: string;
  focusArea: string;
  skills: string[];
  resumeBlobKey: string | null;
  resumeFilename: string | null;
  resumeBytes: number | null;
};

export function savedDraftFrom(row: SavedDraftRow): SavedDraft {
  return {
    values: {
      fullName: row.fullName,
      phone: row.phone,
      cgpa: row.cgpa,
      programme: row.programme,
      branch: row.branch,
      year: row.year,
      focusArea: row.focusArea,
      skills: row.skills.join(", "),
      // A row only exists after an explicit, timestamped consent (consentAt
      // is NOT NULL), so restoring it checked reflects what was agreed to.
      consent: true,
    },
    // Bytes are validated positive on the way in, so a key without them is a
    // row this schema never wrote — force a fresh upload rather than submit
    // values that validation would reject.
    resume:
      row.resumeBlobKey && row.resumeBytes && row.resumeBytes > 0
        ? {
            key: row.resumeBlobKey,
            name: row.resumeFilename ?? "resume.pdf",
            bytes: row.resumeBytes,
          }
        : null,
  };
}
