import "server-only";

/**
 * The one place a student row is ever moved to `paid`. Shared by the two
 * callers that can legitimately do this: the Razorpay webhook (the normal
 * path) and the reconciliation cron (the fallback for a webhook that never
 * arrived). Keeping the compare-and-swap in one function means both callers
 * get the same race-safety instead of two copies drifting apart.
 *
 * See payment-flow-review.md, Defect 4, for why this must be a single
 * conditional UPDATE rather than a read-then-write.
 */

import { eq, sql } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import { db } from "@/db";
import { students } from "@/db/schema";
import { RegistrationConfirmationEmail } from "@/emails/RegistrationConfirmation";
import { sendEmail } from "@/lib/email";
import { generateRefCode } from "@/lib/ref-code";

export type SettleResult = { settled: true; refCode: string } | { settled: false };

/** Best-effort — the payment already succeeded and the row is already paid. */
function sendConfirmationEmail(studentId: number, email: string, fullName: string, refCode: string) {
  waitUntil(
    sendEmail({
      to: email,
      subject: `You're registered for Aspire Quest — ${refCode}`,
      react: RegistrationConfirmationEmail({ fullName, refCode }),
      idempotencyKey: `registration-confirmation/${refCode}`,
    })
      .then((sent) => {
        if (!sent) return;
        return db
          .update(students)
          .set({ confirmationEmailSentAt: new Date() })
          .where(eq(students.id, studentId));
      })
      .catch((error) => {
        console.error("[payment-settlement] confirmation email follow-up failed:", error);
      }),
  );
}

/**
 * Marks a student row paid, issues its reference code, and sends the
 * confirmation email — but ONLY if the row is still `pending_payment`.
 *
 * `settled: false` means another caller already won this race (the webhook
 * and the reconciliation cron can both reach the same row) — that is a
 * no-op, not an error.
 */
export async function settleStudentPayment(studentId: number): Promise<SettleResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const refCode = generateRefCode();

    try {
      const updated = await db
        .update(students)
        .set({ paymentStatus: "paid", refCode, paidAt: sql`now()` })
        .where(
          sql`${students.id} = ${studentId} AND ${students.paymentStatus} = 'pending_payment'`,
        )
        .returning({ id: students.id, email: students.email, fullName: students.fullName });

      const [student] = updated;
      if (!student) return { settled: false };

      sendConfirmationEmail(student.id, student.email, student.fullName, refCode);
      return { settled: true, refCode };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("students_ref_code_idx")) continue; // collision — try another code
      throw error;
    }
  }

  throw new Error(`[payment-settlement] exhausted ref-code attempts for student ${studentId}`);
}
