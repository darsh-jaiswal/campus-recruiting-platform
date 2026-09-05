import { createHash } from "node:crypto";

/**
 * Job-opening scoring semantics — the pure half.
 *
 * Shaped like interest.ts: no I/O, so the band boundaries and staleness rule
 * are testable without a database or an API call, and the scorer, the Server
 * Action and the UI all read the same definitions instead of each hardcoding
 * "80" somewhere.
 */

export type ScoreBand = "strong" | "possible" | "weak";

/** Band boundaries shown to recruiters. A score is a starting point, not a decision. */
export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "strong";
  if (score >= 60) return "possible";
  return "weak";
}

export const BAND_LABELS: Record<ScoreBand, string> = {
  strong: "Strong match",
  possible: "Possible",
  weak: "Weak match",
};

/** JD uploads: PDF is read natively by the scorer; .docx via text extraction. */
export const JD_UPLOAD = {
  maxBytes: 5 * 1024 * 1024,
  maxLabel: "5 MB",
  acceptedTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  acceptedLabel: "PDF or Word (.docx)",
} as const;

/**
 * Fingerprint of everything the scorer read besides the resume itself.
 *
 * Stored on each application at scoring time; a stored hash that no longer
 * matches the opening's current inputs marks that score as stale, so editing
 * the screening prompt — or swapping the uploaded JD file — invalidates
 * exactly the scores it should and no others.
 *
 * "\0" separates the fields because it cannot occur in the text itself, so
 * ("ab", null) can never collide with ("a", "b").
 */
export function scoringPromptHash(
  description: string,
  screeningPrompt: string | null,
  jdBlobKey: string | null = null,
): string {
  return createHash("sha256")
    .update(description)
    .update("\0")
    .update(screeningPrompt ?? "")
    .update("\0")
    .update(jdBlobKey ?? "")
    .digest("hex");
}

/**
 * Student eligibility for an opening — the same rule the Apply button
 * displays and the Server Action enforces, defined once so they can't drift.
 *
 * CGPA values are fixed-2 strings end to end (see validation.ts); Number()
 * on those is exact at this precision.
 */
export type Eligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

export function checkEligibility(
  opening: { minCgpa: string | null; eligibleBranches: readonly string[] },
  student: { cgpa: string; branch: string },
): Eligibility {
  if (opening.minCgpa !== null && Number(student.cgpa) < Number(opening.minCgpa)) {
    return {
      eligible: false,
      reason: `This opening requires a CGPA of ${opening.minCgpa} or above.`,
    };
  }
  if (
    opening.eligibleBranches.length > 0 &&
    !opening.eligibleBranches.includes(student.branch)
  ) {
    return {
      eligible: false,
      reason: `This opening is limited to ${opening.eligibleBranches.join(", ")} students.`,
    };
  }
  return { eligible: true };
}

/**
 * Average of the scores that exist, rendered for the dashboard.
 * "—" when nothing has been scored yet — never 0, which would read as a
 * terrible candidate pool rather than an unscored one.
 */
export function averageScoreLabel(
  scores: readonly (number | null)[],
): string {
  const present = scores.filter((s): s is number => s !== null);
  if (present.length === 0) return "—";
  return String(Math.round(present.reduce((a, b) => a + b, 0) / present.length));
}
