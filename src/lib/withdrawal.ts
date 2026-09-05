/**
 * Withdrawal rules, pure and testable.
 *
 * The load-bearing idea: an application's withdrawal is DERIVED from two
 * timestamps — its own withdrawnAt, or the student's registration-level
 * one. Registration withdrawal therefore needs no transactional fan-out
 * across application rows (Neon HTTP has none to give): setting
 * students.withdrawnAt alone already withdraws everything derivedly, and
 * the per-application backfill that follows it is cosmetic.
 */

export type WithdrawableApplication = {
  withdrawnAt: Date | null;
  resumeId: number | null;
};

export type WithdrawingStudent = {
  withdrawnAt: Date | null;
};

/** When (and whether) this application counts as withdrawn. */
export function applicationWithdrawnAt(
  application: { withdrawnAt: Date | null },
  student: WithdrawingStudent,
): Date | null {
  return application.withdrawnAt ?? student.withdrawnAt;
}

/**
 * Re-applying is only possible while the opening still accepts
 * applications, only for an application actually withdrawn, and never for
 * a student whose whole registration is withdrawn — that reversal is an
 * organiser action, not a self-service one.
 */
export function canReapply(
  openingStatus: "draft" | "live" | "closed",
  application: { withdrawnAt: Date | null },
  student: WithdrawingStudent,
): boolean {
  if (student.withdrawnAt !== null) return false;
  if (application.withdrawnAt === null) return false;
  return openingStatus === "live";
}

/**
 * Whether a re-apply must throw away the stored AI score: yes exactly when
 * the CV changes — the old score described the old document. The same CV
 * keeps its score (promptHash already invalidates it if the OPENING's text
 * changed).
 */
export function reapplyResetsScore(
  previousResumeId: number | null,
  nextResumeId: number,
): boolean {
  return previousResumeId !== nextResumeId;
}
