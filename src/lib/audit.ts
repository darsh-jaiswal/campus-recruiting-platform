import "server-only";

import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { Actor } from "./auth";

/**
 * Audit logging.
 *
 * Under the DPDP Act, CGPA and phone number are personal data. Every read of
 * student PII by an admin or recruiter is recorded, so that if a student asks
 * "who has seen my application?" there is an answer.
 *
 * Writes here are best-effort and never block the read that triggered them: a
 * failure to log must not become a failure to serve. It is logged loudly
 * instead, because a silently broken audit trail is worse than a noisy one.
 */

type AuditAction = "view_student" | "view_resume" | "export_csv" | "view_bundle";

type AuditInput = {
  actor: Actor;
  action: AuditAction;
  studentId?: number;
  companyId?: number;
  detail?: string;
};

export async function recordAudit({
  actor,
  action,
  studentId,
  companyId,
  detail,
}: AuditInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actor: actor.userId,
      actorRole: actor.role,
      action,
      studentId,
      companyId,
      detail,
    });
  } catch (error) {
    console.error("[audit] FAILED to record access", {
      actor: actor.userId,
      action,
      studentId,
      companyId,
      error,
    });
  }
}

/**
 * Record a bulk read in one row rather than N.
 *
 * A screening page listing 400 candidates is one act of access by one person,
 * not 400. Writing a row per student would make the trail unreadable and cost
 * a round trip per candidate.
 */
export async function recordBulkAudit(
  actor: Actor,
  action: AuditAction,
  count: number,
  detail: string,
): Promise<void> {
  await recordAudit({
    actor,
    action,
    detail: `${detail} · ${count} record${count === 1 ? "" : "s"}`,
  });
}
