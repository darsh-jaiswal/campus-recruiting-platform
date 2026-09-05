/**
 * Orphaned resume sweep.
 *
 * The registration form uploads a resume the moment a file is chosen, not on
 * submit — that is what makes the progress bar real, and the payment flow needs
 * the blob to exist before checkout opens. The cost is that anyone who picks a
 * file and then walks away leaves a blob in the store that no database row
 * references. Nothing ever cleaned those up.
 *
 * This deletes files, so the decision of WHAT to delete is a pure function
 * tested exhaustively in orphaned-resumes.test.ts, and the I/O around it
 * refuses to run when its inputs look wrong. Two independent conditions must
 * both hold before a blob is removed:
 *
 *   1. No student row references it.
 *   2. It is older than the grace period — nobody fills a form for a day.
 */

import { del, list } from "@vercel/blob";
import { isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobOpenings, students } from "@/db/schema";

/** A day. A form session is minutes; this is deliberately far beyond it. */
const GRACE_MS = 24 * 60 * 60 * 1000;

export type BlobSummary = {
  pathname: string;
  uploadedAt: Date;
};

/**
 * Which blobs are safe to delete.
 *
 * Pure and I/O-free so the rule can be tested directly rather than reasoned
 * about — the same approach access-policy.ts takes for authorisation.
 */
export function selectOrphanedBlobs({
  blobs,
  referencedKeys,
  now,
  graceMs = GRACE_MS,
}: {
  blobs: readonly BlobSummary[];
  referencedKeys: ReadonlySet<string>;
  now: Date;
  graceMs?: number;
}): string[] {
  const cutoff = now.getTime() - graceMs;

  return blobs
    .filter((blob) => !referencedKeys.has(blob.pathname))
    .filter((blob) => blob.uploadedAt.getTime() < cutoff)
    .map((blob) => blob.pathname);
}

export type SweepResult =
  | { ran: false; reason: "not_configured" | "no_referenced_keys" }
  | { ran: true; scanned: number; deleted: number; failed: number; dryRun: boolean };

/**
 * Every blob key currently referenced by a database row.
 *
 * The store holds more than resumes: recruiters' JD documents live in it too
 * (`job_openings.jd_blob_key`), and `list()` below scans the whole store — so
 * every table that points at a blob MUST contribute to this set, or the sweep
 * deletes live files. If you add a blob-referencing column anywhere, add it
 * here in the same change.
 *
 * Read in full rather than checked per-blob: one query is cheaper than N, and
 * an all-or-nothing read means a partial failure surfaces as an error instead
 * of silently under-reporting references and deleting live files.
 */
async function referencedBlobKeys(): Promise<Set<string>> {
  const resumeRows = await db
    .select({ key: students.resumeBlobKey })
    .from(students)
    .where(isNotNull(students.resumeBlobKey));

  const jdRows = await db
    .select({ key: jobOpenings.jdBlobKey })
    .from(jobOpenings)
    .where(isNotNull(jobOpenings.jdBlobKey));

  // The resume library: every ACTIVE entry, plus every entry — active or
  // soft-deleted — that an application snapshotted at apply time. A soft-
  // deleted entry nothing ever applied with is the one library case that
  // may (and should) be reaped. Queried inline (not via db/queries, whose
  // files import "server-only") so this module stays importable by its own
  // unit tests.
  const activeLibrary = await db.execute(sql`
    SELECT DISTINCT blob_key FROM resumes WHERE deleted_at IS NULL
  `);
  const snapshotted = await db.execute(sql`
    SELECT DISTINCT r.blob_key
    FROM resumes r
    INNER JOIN job_applications ja ON ja.resume_id = r.id
  `);
  const libraryKeys = [...activeLibrary.rows, ...snapshotted.rows].map(
    (row) => (row as { blob_key: string }).blob_key,
  );

  return new Set(
    [...resumeRows, ...jdRows]
      .map((row) => row.key)
      .filter((key): key is string => Boolean(key))
      .concat(libraryKeys),
  );
}

/**
 * @param dryRun report what would be deleted without deleting it. Run this
 *               first against any store whose contents you have not verified.
 */
export async function sweepOrphanedResumes({
  dryRun = false,
  now = new Date(),
}: { dryRun?: boolean; now?: Date } = {}): Promise<SweepResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("[resume-sweep] BLOB_READ_WRITE_TOKEN missing — refusing to run.");
    return { ran: false, reason: "not_configured" };
  }

  const referenced = await referencedBlobKeys();

  // A store with files in it but zero references almost certainly means the
  // reference read went wrong, not that every file is genuinely orphaned.
  // Deleting on that reading would destroy every live resume and JD, so stop.
  if (referenced.size === 0) {
    const probe = await list({ limit: 1, token });
    if (probe.blobs.length > 0) {
      console.error(
        "[resume-sweep] Store is non-empty but no row references any blob. " +
          "Refusing to run — this looks like a failed read, not a store full of orphans.",
      );
      return { ran: false, reason: "no_referenced_keys" };
    }
  }

  let cursor: string | undefined;
  let scanned = 0;
  let deleted = 0;
  let failed = 0;

  do {
    const page = await list({ cursor, limit: 1000, token });
    scanned += page.blobs.length;

    const orphans = selectOrphanedBlobs({
      blobs: page.blobs.map((blob) => ({
        pathname: blob.pathname,
        uploadedAt: blob.uploadedAt,
      })),
      referencedKeys: referenced,
      now,
    });

    for (const pathname of orphans) {
      if (dryRun) {
        console.info(`[resume-sweep] would delete: ${pathname}`);
        deleted += 1;
        continue;
      }

      try {
        await del(pathname, { token });
        deleted += 1;
      } catch (error) {
        // One stuck file must not abort the sweep.
        failed += 1;
        console.error(`[resume-sweep] failed to delete ${pathname}:`, error);
      }
    }

    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return { ran: true, scanned, deleted, failed, dryRun };
}
