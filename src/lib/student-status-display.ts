/**
 * What a student is told about their own screening status.
 *
 * The pipeline's internal stages (screened, interviewed) are process detail —
 * a student seeing "screened" reads it as news when it is bookkeeping. Only
 * decisions are surfaced: everything before a decision is "Under review".
 * Pure and exhaustive so the mapping is testable and a new enum value fails
 * the build here instead of leaking an internal label to a student.
 */

export type StudentStatus =
  | "registered"
  | "screened"
  | "shortlisted"
  | "interviewed"
  | "selected"
  | "rejected";

export type StatusTone = "neutral" | "positive" | "critical";

export type StudentVisibleStatus = {
  label: string;
  tone: StatusTone;
  /** One sentence of what the label means for the student. */
  detail: string;
};

export function studentVisibleStatus(status: StudentStatus): StudentVisibleStatus {
  switch (status) {
    case "registered":
    case "screened":
    case "interviewed":
      return {
        label: "Under review",
        tone: "neutral",
        detail:
          "Your application is with the organising team. Shortlist decisions arrive by email.",
      };
    case "shortlisted":
      return {
        label: "Shortlisted",
        tone: "positive",
        detail:
          "Partner companies have shortlisted your profile. Interview details follow by email.",
      };
    case "selected":
      return {
        label: "Selected",
        tone: "positive",
        detail: "Congratulations — a partner company has selected you.",
      };
    case "rejected":
      return {
        label: "Not selected",
        tone: "critical",
        detail:
          "Your application was not selected this time. Openings on the jobs board remain open to you.",
      };
  }
}
