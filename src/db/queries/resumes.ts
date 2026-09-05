import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { resumes } from "@/db/schema";
import { MAX_ACTIVE_RESUMES } from "@/lib/resume-library";

/**
 * The resume library's writes. Neon HTTP has no transactions, so every
 * invariant here is held by a single guarded statement (the payment-
 * settlement discipline): set-primary is one UPDATE that can never leave
 * zero or two primaries, and the max-3 cap is enforced inside the INSERT
 * itself rather than by a read-then-write.
 *
 * Every function takes studentId from the caller's own resolved session —
 * ownership is in the WHERE clause, never trusted from the client.
 */

export type ResumeRow = {
  id: number;
  filename: string;
  bytes: number;
  isPrimary: boolean;
  createdAt: Date;
  deletedAt: Date | null;
};

const ROW_COLUMNS = {
  id: resumes.id,
  filename: resumes.filename,
  bytes: resumes.bytes,
  isPrimary: resumes.isPrimary,
  createdAt: resumes.createdAt,
  deletedAt: resumes.deletedAt,
} as const;

/** Active library entries, primary first, newest after. */
export async function listActiveResumes(studentId: number): Promise<ResumeRow[]> {
  return db
    .select(ROW_COLUMNS)
    .from(resumes)
    .where(and(eq(resumes.studentId, studentId), isNull(resumes.deletedAt)))
    .orderBy(sql`${resumes.isPrimary} DESC`, sql`${resumes.createdAt} DESC`);
}

/** One active entry, ownership checked — the apply flow's validation read. */
export async function getActiveResume(
  studentId: number,
  resumeId: number,
): Promise<ResumeRow | null> {
  const [row] = await db
    .select(ROW_COLUMNS)
    .from(resumes)
    .where(
      and(
        eq(resumes.id, resumeId),
        eq(resumes.studentId, studentId),
        isNull(resumes.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Add an entry, capped at MAX_ACTIVE_RESUMES active rows — the cap lives in
 * the INSERT's WHERE so two concurrent adds cannot both slip past a
 * read-then-check. Returns null when the cap (or a duplicate of the same
 * upload) blocked the insert.
 */
export async function addResume(
  studentId: number,
  file: { blobKey: string; filename: string; bytes: number },
): Promise<ResumeRow | null> {
  const inserted = await db.execute(sql`
    INSERT INTO resumes (student_id, blob_key, filename, bytes, is_primary)
    SELECT ${studentId}, ${file.blobKey}, ${file.filename}, ${file.bytes}, false
    WHERE (
      SELECT count(*) FROM resumes
      WHERE student_id = ${studentId} AND deleted_at IS NULL
    ) < ${MAX_ACTIVE_RESUMES}
    ON CONFLICT (student_id, blob_key) DO NOTHING
    RETURNING id, filename, bytes, is_primary, created_at, deleted_at
  `);

  const row = inserted.rows[0] as
    | {
        id: number;
        filename: string;
        bytes: number;
        is_primary: boolean;
        created_at: string;
        deleted_at: string | null;
      }
    | undefined;
  if (!row) return null;

  return {
    id: row.id,
    filename: row.filename,
    bytes: row.bytes,
    isPrimary: row.is_primary,
    createdAt: new Date(row.created_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

/**
 * Soft delete. The WHERE enforces every rule at once — ownership, active,
 * and never-the-primary — so a stale client can't delete what the UI would
 * have hidden. The blob is left for the orphan sweep, which spares it while
 * any application still references this row.
 */
export async function softDeleteResume(
  studentId: number,
  resumeId: number,
): Promise<boolean> {
  const updated = await db
    .update(resumes)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(resumes.id, resumeId),
        eq(resumes.studentId, studentId),
        eq(resumes.isPrimary, false),
        isNull(resumes.deletedAt),
      ),
    )
    .returning({ id: resumes.id });
  return updated.length > 0;
}

/**
 * Make one active entry the primary — a single UPDATE computing
 * `is_primary = (id = $target)` across the student's active rows, guarded
 * by EXISTS so a bad id demotes nothing. A crash can therefore never leave
 * zero or two primaries.
 *
 * The students.resume* mirror is refreshed afterwards (second statement —
 * see syncPrimaryMirror). A crash between the two leaves the mirror stale;
 * re-running the action heals it, and nothing pays money or sends email off
 * the mirror.
 */
export async function setPrimaryResume(
  studentId: number,
  resumeId: number,
): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE resumes
    SET is_primary = (id = ${resumeId})
    WHERE student_id = ${studentId}
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM resumes
        WHERE id = ${resumeId}
          AND student_id = ${studentId}
          AND deleted_at IS NULL
      )
    RETURNING id
  `);
  if (result.rows.length === 0) return false;

  await syncPrimaryMirror(studentId);
  return true;
}

/**
 * Copy the current primary into students.resume* — the mirror that keeps
 * the admin student page and the CSV export working unchanged.
 */
export async function syncPrimaryMirror(studentId: number): Promise<void> {
  await db.execute(sql`
    UPDATE students s
    SET resume_blob_key = r.blob_key,
        resume_filename = r.filename,
        resume_bytes = r.bytes,
        updated_at = now()
    FROM resumes r
    WHERE s.id = ${studentId}
      AND r.student_id = ${studentId}
      AND r.is_primary
      AND r.deleted_at IS NULL
  `);
}

/**
 * Registration's write: the submitted file becomes (or refreshes) the
 * primary. Two statements, crash-safe in order: (1) upsert the row as
 * non-primary, resurrecting a soft-deleted duplicate of the same upload;
 * (2) one atomic set-primary keyed by blob key. The caller's student upsert
 * already wrote the students.resume* mirror, so a crash anywhere here
 * leaves that pointer valid and the next submit heals the library.
 *
 * Deliberately NOT capped: registration must never fail on the library
 * cap (and in practice a pre-payment student has at most one entry).
 */
export async function ensurePrimaryResume(
  studentId: number,
  file: { blobKey: string; filename: string; bytes: number },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO resumes (student_id, blob_key, filename, bytes, is_primary)
    VALUES (${studentId}, ${file.blobKey}, ${file.filename}, ${file.bytes}, false)
    ON CONFLICT (student_id, blob_key)
    DO UPDATE SET deleted_at = NULL, filename = ${file.filename}, bytes = ${file.bytes}
  `);

  await db.execute(sql`
    UPDATE resumes
    SET is_primary = (blob_key = ${file.blobKey})
    WHERE student_id = ${studentId} AND deleted_at IS NULL
  `);
}

/**
 * Swap the primary resume for a freshly uploaded file, in the dashboard's
 * one-click "Replace" action. Two statements, crash-safe in order (same
 * discipline as ensurePrimaryResume — Neon HTTP has no transactions):
 * (1) insert the new file as a normal capped, non-primary entry; (2) one
 * atomic UPDATE that promotes it to primary and retires `resumeIdToReplace`
 * in the same statement, so there's never a moment with two primaries. If
 * step 1 is blocked (cap already at MAX_ACTIVE_RESUMES, or this exact file
 * is already in the library) this returns null before touching anything —
 * the student's current primary is untouched, not left in a half state. If
 * a crash happens between the two statements, the old resume is still
 * fully active and primary (nothing was deleted yet); the new upload just
 * sits as a harmless non-primary extra the student can delete or promote
 * themselves.
 */
export async function replaceResume(
  studentId: number,
  resumeIdToReplace: number,
  file: { blobKey: string; filename: string; bytes: number },
): Promise<ResumeRow | null> {
  const inserted = await addResume(studentId, file);
  if (!inserted) return null;

  await db.execute(sql`
    UPDATE resumes
    SET is_primary = (id = ${inserted.id}),
        deleted_at = CASE WHEN id = ${resumeIdToReplace} THEN now() ELSE deleted_at END
    WHERE student_id = ${studentId} AND deleted_at IS NULL
  `);

  await syncPrimaryMirror(studentId);
  return { ...inserted, isPrimary: true };
}

/** The application's snapshot resume, for scoring and the download route. */
export async function getApplicationResume(
  openingId: number,
  studentId: number,
): Promise<{ blobKey: string; filename: string } | null> {
  const result = await db.execute(sql`
    SELECT r.blob_key, r.filename
    FROM job_applications ja
    INNER JOIN resumes r ON r.id = ja.resume_id
    WHERE ja.opening_id = ${openingId} AND ja.student_id = ${studentId}
    LIMIT 1
  `);
  const row = result.rows[0] as { blob_key: string; filename: string } | undefined;
  return row ? { blobKey: row.blob_key, filename: row.filename } : null;
}
