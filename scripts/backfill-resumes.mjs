/**
 * One-time, idempotent backfill for the resumes table (2026-08-24).
 *
 * Every student's single `resume_blob_key` becomes their PRIMARY library
 * entry, and every existing application is pinned to that entry — pre-library
 * applications were submitted with the profile resume, so that row IS their
 * snapshot. Run after `db:push` creates the table and BEFORE deploying code
 * that reads `job_applications.resume_id`.
 *
 *   node --env-file=.env.local scripts/backfill-resumes.mjs
 *
 * Safe to re-run: both statements skip rows already handled.
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run with --env-file=.env.local");
  process.exit(1);
}
const sql = neon(url);

const inserted = await sql`
  INSERT INTO resumes (student_id, blob_key, filename, bytes, is_primary, created_at)
  SELECT id, resume_blob_key, coalesce(resume_filename, 'resume.pdf'),
         coalesce(resume_bytes, 0), true, coalesce(created_at, now())
  FROM students
  WHERE resume_blob_key IS NOT NULL
  ON CONFLICT (student_id, blob_key) DO NOTHING
  RETURNING id
`;

const pinned = await sql`
  UPDATE job_applications ja
  SET resume_id = r.id
  FROM resumes r
  WHERE r.student_id = ja.student_id
    AND r.is_primary
    AND r.deleted_at IS NULL
    AND ja.resume_id IS NULL
  RETURNING ja.opening_id
`;

const [counts] = await sql`
  SELECT
    (SELECT count(*)::int FROM students WHERE resume_blob_key IS NOT NULL) AS students_with_resume,
    (SELECT count(*)::int FROM resumes) AS resume_rows,
    (SELECT count(*)::int FROM job_applications WHERE resume_id IS NULL) AS applications_unpinned
`;

console.log(`inserted ${inserted.length} resume rows, pinned ${pinned.length} applications`);
console.log(counts);

if (counts.students_with_resume !== counts.resume_rows) {
  console.error(
    "MISMATCH: students with a resume != resume rows. Investigate before deploying read-path code.",
  );
  process.exit(1);
}
console.log("Backfill verified: counts match.");
