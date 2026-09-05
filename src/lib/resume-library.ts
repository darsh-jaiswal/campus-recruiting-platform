/**
 * The resume library's decision rules, pure and testable — the same
 * discipline access-policy.ts and orphaned-resumes.ts follow: anything that
 * gates a write is a function of plain data, and the I/O around it stays
 * thin.
 *
 * The model: up to MAX_ACTIVE_RESUMES active entries per student, exactly
 * one primary. The primary is what registration submitted and what
 * the admin console reads; applications snapshot whichever entry was chosen at
 * apply time, permanently. Deletion is always soft — a snapshot must
 * survive the library losing its entry.
 */

export const MAX_ACTIVE_RESUMES = 3;

export type LibraryResume = {
  id: number;
  filename: string;
  bytes: number;
  isPrimary: boolean;
  deletedAt: Date | null;
};

export function activeResumes<T extends { deletedAt: Date | null }>(
  entries: readonly T[],
): T[] {
  return entries.filter((entry) => entry.deletedAt === null);
}

export function canAddResume(entries: readonly LibraryResume[]): boolean {
  return activeResumes(entries).length < MAX_ACTIVE_RESUMES;
}

export type DeleteVerdict =
  | { ok: true }
  | { ok: false; reason: "primary" | "not_found" };

/**
 * The primary cannot be deleted — deleting it would either leave no primary
 * or silently promote another entry, mutating what future applications and
 * readers get. The student sets a different primary first, which is
 * an explicit choice instead of a hidden one.
 */
export function canDeleteResume(
  entries: readonly LibraryResume[],
  resumeId: number,
): DeleteVerdict {
  const target = activeResumes(entries).find((entry) => entry.id === resumeId);
  if (!target) return { ok: false, reason: "not_found" };
  if (target.isPrimary) return { ok: false, reason: "primary" };
  return { ok: true };
}

/** What the apply-flow picker preselects: the primary, if one is active. */
export function defaultResumeId(
  entries: readonly LibraryResume[],
): number | null {
  const active = activeResumes(entries);
  return active.find((entry) => entry.isPrimary)?.id ?? active[0]?.id ?? null;
}
