"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setStudentStatus } from "@/db/queries/students";
import { StatusUpdateEmail } from "@/emails/StatusUpdate";
import { requireAdmin } from "@/lib/auth";
import { recordBulkAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import {
  isDecisionStatus,
  statusEmailIdempotencyKey,
  statusEmailSubject,
} from "@/lib/status-emails";

export type BulkState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const idList = z
  .array(z.coerce.number().int().positive())
  .min(1, "Select at least one candidate.")
  .max(500, "Select fewer than 500 candidates at a time.");

const statusSchema = z.enum([
  "registered",
  "screened",
  "shortlisted",
  "interviewed",
  "selected",
  "rejected",
]);

/** Bulk status change from the screening table. */
export async function updateStatuses(
  _prev: BulkState,
  formData: FormData,
): Promise<BulkState> {
  const actor = await requireAdmin();

  const parsedIds = idList.safeParse(formData.getAll("studentIds"));
  if (!parsedIds.success) {
    return { status: "error", message: parsedIds.error.issues[0]!.message };
  }

  const parsedStatus = statusSchema.safeParse(formData.get("status"));
  if (!parsedStatus.success) {
    return { status: "error", message: "Pick a status to apply." };
  }

  try {
    // Only rows whose status actually changed come back (and never
    // withdrawn ones) — re-running the same bulk action updates nothing
    // and therefore emails nothing.
    const changed = await setStudentStatus(parsedIds.data, parsedStatus.data);
    const count = changed.length;
    await recordBulkAudit(
      actor,
      "view_student",
      count,
      `Set status to ${parsedStatus.data}`,
    );

    revalidatePath("/admin/students");
    revalidatePath("/admin");

    let emailNote = "";
    if (isDecisionStatus(parsedStatus.data) && count > 0) {
      const decision = parsedStatus.data;
      // Awaited (not waitUntil) so the success message can report the real
      // sent/failed split — a silent drop against Resend's 100/day free
      // tier would read as "everyone was told" when they weren't.
      // sendEmail never throws; it returns false on failure.
      const results = await Promise.all(
        changed.map((student) =>
          sendEmail({
            to: student.email,
            subject: statusEmailSubject(decision),
            react: StatusUpdateEmail({
              fullName: student.fullName,
              refCode: student.refCode ?? "—",
              status: decision,
            }),
            idempotencyKey: statusEmailIdempotencyKey(
              decision,
              student.refCode ?? `id-${student.id}`,
            ),
          }),
        ),
      );
      const sent = results.filter(Boolean).length;
      const failed = results.length - sent;
      emailNote =
        failed === 0
          ? ` Emailed all ${sent}.`
          : ` Emailed ${sent} of ${results.length} — ${failed} failed (Resend's free tier caps at 100/day).`;
    }

    return {
      status: "success",
      message: `${count} candidate${count === 1 ? "" : "s"} marked ${parsedStatus.data}.${emailNote}`,
    };
  } catch (error) {
    console.error("[admin/students] status update failed:", error);
    return { status: "error", message: "Could not update those candidates." };
  }
}
