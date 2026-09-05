import { REGISTRATION } from "@/lib/content";
import type { SubmittedValues } from "./actions";

/**
 * Client-side mirror of the registration rules in src/lib/validation.ts.
 *
 * The server schema stays the enforcement — this exists because its verdict
 * used to be the FIRST feedback a student got, arriving only after they had
 * walked through review and pressed "Confirm & pay". A mistyped CGPA
 * ("8;23") sailed through "Continue to review" untouched, and the eventual
 * rejection read as the button doing nothing. These checks run before the
 * review screen and put the message under the field it belongs to.
 *
 * Messages are copied verbatim from the zod schema so a student who does
 * reach the server path sees identical wording, not a second dialect.
 */
/**
 * Keystroke-level shape for the CGPA box: digits with at most one dot, at
 * most two digits on either side of it ("10.00" is the widest legal value).
 * This makes junk untypeable rather than merely flagged — a stray ";" never
 * lands, "3.33333" stops at "3.33". What it can't decide (a trailing dot,
 * a value over 10) is still worded by validateForReview below.
 */
export function sanitizeCgpa(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned.slice(0, 2);
  const int = cleaned.slice(0, firstDot).slice(0, 2);
  const dec = cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  return `${int}.${dec}`;
}

export function validateForReview(
  values: SubmittedValues,
  resumeAttached: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const fullName = values.fullName.trim();
  if (fullName.length < 2) errors.fullName = "Enter your full name.";
  else if (fullName.length > 120) errors.fullName = "That name is too long.";

  // Same normalisation as the server: strip spaces, dashes and parentheses,
  // then allow an optional +91 / 0 prefix on a 10-digit mobile.
  const phone = values.phone.trim().replace(/[\s\-()]/g, "");
  if (!/^(?:\+?91|0)?[6-9]\d{9}$/.test(phone)) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }

  const cgpa = values.cgpa.trim();
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(cgpa)) {
    errors.cgpa = "Enter CGPA as a number, e.g. 7.85.";
  } else {
    const parsed = Number(cgpa);
    if (parsed < REGISTRATION.minCgpa || parsed > REGISTRATION.maxCgpa) {
      errors.cgpa = `CGPA must be between ${REGISTRATION.minCgpa} and ${REGISTRATION.maxCgpa}.`;
    }
  }

  if (!values.programme) errors.programme = "Select your programme.";
  // An invalid programme/branch pair is unpickable in the UI (the branch list
  // is filtered), so emptiness is the only branch failure left to catch here.
  if (!values.branch) errors.branch = "Select your branch.";
  if (!values.year) errors.year = "Select your year of study.";
  if (!values.focusArea) errors.focusArea = "Select one focus area.";

  const skills = values.skills.split(",").map((s) => s.trim()).filter(Boolean);
  if (skills.length > 12) errors.skills = "List at most 12 skills.";
  else if (skills.some((s) => s.length > 40)) {
    errors.skills = "Keep each skill under 40 characters.";
  }

  if (!resumeAttached) errors.resumeBlobKey = "Upload your resume as a PDF.";

  if (!values.consent) {
    errors.consent = "You must agree before we can process your application.";
  }

  return errors;
}
