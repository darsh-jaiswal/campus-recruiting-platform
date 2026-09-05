/**
 * Which screening-status changes email the student, pure and testable.
 *
 * Only decisions notify: shortlisted, selected, rejected. Internal stages
 * (registered/screened/interviewed) stay silent — the dashboard shows them
 * all as "Under review" (src/lib/student-status-display.ts) and an email
 * saying "you moved to an internal stage" is noise wearing news' clothing.
 * A withdrawn registration never gets decision mail.
 */

import type { StudentStatus } from "./student-status-display";

export const DECISION_STATUSES = ["shortlisted", "selected", "rejected"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export function isDecisionStatus(status: StudentStatus): status is DecisionStatus {
  return (DECISION_STATUSES as readonly string[]).includes(status);
}

export function shouldEmailStatus(
  status: StudentStatus,
  withdrawnAt: Date | null,
): status is DecisionStatus {
  if (withdrawnAt !== null) return false;
  return isDecisionStatus(status);
}

/**
 * Resend idempotency key: one email per (decision, student), so a retried
 * or re-run bulk action cannot double-send. The A→B→A edge (same decision
 * re-applied within Resend's idempotency window) is suppressed too — an
 * accepted trade, noted here on purpose.
 */
export function statusEmailIdempotencyKey(
  status: DecisionStatus,
  refCode: string,
): string {
  return `status-${status}/${refCode}`;
}

export function statusEmailSubject(status: DecisionStatus): string {
  switch (status) {
    case "shortlisted":
      return "You've been shortlisted — Aspire Quest";
    case "selected":
      return "Congratulations — you've been selected · Aspire Quest";
    case "rejected":
      return "An update on your Aspire Quest application";
  }
}
