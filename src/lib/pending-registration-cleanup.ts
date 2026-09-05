import "server-only";

/**
 * Deletes abandoned, unpaid registrations — someone who filled the form and
 * never opened the payment popup at all.
 *
 * Two conditions must BOTH hold, mirroring the discipline in
 * orphaned-resumes.ts:
 *
 *   1. Still `pending_payment` and older than the grace period.
 *   2. No `paymentOrders` row exists for it AT ALL.
 *
 * Condition 2 is the one that matters. A row with even one payment attempt
 * is kept PERMANENTLY, however old — deleting it risks the exact disaster
 * Defect 5 describes: a payment completes against a row that cleanup already
 * removed, with nothing left to attach it to. A row with no order was never
 * exposed to that risk, because no order means no possible late webhook.
 */

import { and, eq, isNull, lt } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { paymentOrders, students } from "@/db/schema";

const GRACE_MS = 24 * 60 * 60 * 1000;

export type CleanupResult = {
  scanned: number;
  deleted: number;
  blobFailed: number;
};

export async function cleanupAbandonedRegistrations(
  now = new Date(),
): Promise<CleanupResult> {
  const cutoff = new Date(now.getTime() - GRACE_MS);
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  // A row with no matching paymentOrders row at all — left join, keep where
  // the join found nothing.
  const candidates = await db
    .select({
      id: students.id,
      resumeBlobKey: students.resumeBlobKey,
    })
    .from(students)
    .leftJoin(paymentOrders, eq(paymentOrders.studentId, students.id))
    .where(
      and(
        eq(students.paymentStatus, "pending_payment"),
        lt(students.createdAt, cutoff),
        isNull(paymentOrders.id),
      ),
    );

  let deleted = 0;
  let blobFailed = 0;

  for (const candidate of candidates) {
    if (candidate.resumeBlobKey) {
      if (!token) {
        console.error(
          "[pending-cleanup] BLOB_READ_WRITE_TOKEN missing — deleting the row but leaving its blob orphaned for a later sweep.",
        );
      } else {
        try {
          await del(candidate.resumeBlobKey, { token });
        } catch (error) {
          // A stuck blob must not abort the run — the orphaned-resume sweep
          // picks up anything left behind here.
          blobFailed += 1;
          console.error(
            `[pending-cleanup] failed to delete blob for student ${candidate.id}:`,
            error,
          );
        }
      }
    }

    await db.delete(students).where(eq(students.id, candidate.id));
    deleted += 1;
  }

  return { scanned: candidates.length, deleted, blobFailed };
}
