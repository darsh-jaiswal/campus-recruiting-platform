"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireStudent } from "@/lib/auth";

/**
 * Registration withdrawal — the whole application, not one opening.
 *
 * Policy (owner decision, 2026-08-24): the row and its payment record are
 * KEPT (the fee is non-refundable and /privacy's retention terms apply);
 * the student disappears from screening, exports, reminder emails
 * and new applications; reversal is a manual organiser action.
 *
 * Write order matters — there are no transactions here. students.withdrawn_at
 * goes FIRST because it alone already withdraws every application derivedly
 * (src/lib/withdrawal.ts); the per-application backfill after it is cosmetic,
 * so a crash between the two statements changes nothing a reader can see.
 */

export type WithdrawRegistrationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "withdrawn" };

export async function withdrawRegistration(
  _prev: WithdrawRegistrationState,
  formData: FormData,
): Promise<WithdrawRegistrationState> {
  const actor = await requireStudent();

  // Typed confirmation, validated server-side too — this is the most
  // consequential self-service action a student has.
  if (formData.get("confirm") !== "WITHDRAW") {
    return {
      status: "error",
      message: "Type WITHDRAW in the confirmation box to proceed.",
    };
  }

  try {
    const withdrawn = await db.execute(sql`
      UPDATE students
      SET withdrawn_at = now(), updated_at = now()
      WHERE clerk_user_id = ${actor.userId}
        AND payment_status = 'paid'
        AND withdrawn_at IS NULL
      RETURNING id
    `);
    const row = withdrawn.rows[0] as { id: number } | undefined;
    if (!row) {
      return {
        status: "error",
        message: "No active registration to withdraw.",
      };
    }

    await db.execute(sql`
      UPDATE job_applications
      SET withdrawn_at = coalesce(withdrawn_at, now())
      WHERE student_id = ${row.id}
    `);
  } catch (error) {
    console.error("[dashboard] registration withdrawal failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again in a moment.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return { status: "withdrawn" };
}
