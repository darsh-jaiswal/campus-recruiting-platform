/**
 * Pre-event reminder emails.
 *
 * Milestones are days-before-EDITION.startsAt, nearest-to-event last. This
 * whole module is a deliberate no-op while EDITION.startsAt is null — see
 * src/lib/content.ts. Once an organiser sets a real date and redeploys, the
 * next cron run picks up from wherever `remindersSent` already is per
 * student.
 *
 * A student who missed earlier milestones (cron didn't run, or they
 * registered late) is caught up to the current milestone directly, not sent
 * every skipped reminder back-to-back.
 */

import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { EDITION } from "@/lib/content";
import { sendEmail } from "@/lib/email";
import { EventReminderEmail } from "@/emails/EventReminder";

/** Nearest-to-event last. The send loop assumes this order. */
const MILESTONES_DAYS_BEFORE = [7, 3, 1] as const;

function whenLabel(daysBefore: number): string {
  if (daysBefore === 1) return "tomorrow";
  return `in ${daysBefore} days`;
}

export type ReminderRunResult =
  | { skipped: true; reason: "no_event_date" | "no_milestone_due" }
  | {
      skipped: false;
      milestoneIndex: number;
      daysBefore: number;
      sent: number;
      failed: number;
    };

/** The furthest-out milestone whose threshold has already been reached, if any. */
function currentDueIndex(daysUntilEvent: number): number {
  for (let i = MILESTONES_DAYS_BEFORE.length - 1; i >= 0; i--) {
    if (daysUntilEvent <= MILESTONES_DAYS_BEFORE[i]!) return i;
  }
  return -1;
}

/**
 * Sends the current milestone's reminder to every student not yet caught up
 * to it. Safe to call repeatedly (e.g. daily cron).
 */
export async function runDueReminders(now = new Date()): Promise<ReminderRunResult> {
  if (!EDITION.startsAt) {
    return { skipped: true, reason: "no_event_date" };
  }

  const eventDate = new Date(EDITION.startsAt);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilEvent = Math.ceil(
    (eventDate.getTime() - now.getTime()) / msPerDay,
  );

  const dueIndex = currentDueIndex(daysUntilEvent);
  if (dueIndex === -1) {
    return { skipped: true, reason: "no_milestone_due" };
  }

  const daysBefore = MILESTONES_DAYS_BEFORE[dueIndex]!;

  // Unpaid rows are not registrations — see the "no payment, no registration"
  // rule in the payment design spec — so they never receive event reminders.
  // This also guarantees refCode is non-null below: the webhook's
  // compare-and-swap sets payment_status='paid' and ref_code in the same
  // statement, so a paid row always has one.
  const eligible = await db
    .select({
      id: students.id,
      fullName: students.fullName,
      email: students.email,
      refCode: students.refCode,
    })
    .from(students)
    .where(
      and(
        eq(students.paymentStatus, "paid"),
        lte(students.remindersSent, dueIndex),
        // A withdrawn registration gets no event mail.
        isNull(students.withdrawnAt),
      ),
    )
    .orderBy(asc(students.id));

  let sent = 0;
  let failed = 0;

  for (const student of eligible) {
    // Guaranteed non-null by the paymentStatus='paid' filter above.
    const refCode = student.refCode!;
    const ok = await sendEmail({
      to: student.email,
      subject: `Aspire Quest is ${whenLabel(daysBefore)}`,
      react: EventReminderEmail({
        fullName: student.fullName,
        refCode,
        whenLabel: whenLabel(daysBefore),
        dateLabel: EDITION.dateLabel,
      }),
      idempotencyKey: `event-reminder-${dueIndex}/${refCode}`,
    });

    if (ok) {
      sent += 1;
      await db
        .update(students)
        .set({ remindersSent: dueIndex + 1 })
        .where(eq(students.id, student.id));
    } else {
      failed += 1;
    }
  }

  return { skipped: false, milestoneIndex: dueIndex, daysBefore, sent, failed };
}
