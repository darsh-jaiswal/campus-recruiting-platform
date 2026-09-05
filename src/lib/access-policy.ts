/**
 * Access policy — pure functions, no I/O.
 *
 * The recruiter-isolation rule is the single most important invariant in this
 * application: a recruiter must never be able to read a candidate belonging to
 * another company. Keeping the decision here, free of Clerk and the database,
 * means it can be tested exhaustively rather than reasoned about.
 *
 * There are three roles. `admin` and `recruiter` are granted by a human setting
 * Clerk `publicMetadata.role`. `student` is the DEFAULT for any signed-in
 * account with no granted role, because students self-serve and nobody
 * provisions them — so every function here must deny it explicitly. A missing
 * deny would hand candidate PII to anyone who signs in with Google.
 *
 * Callers supply the facts (who is asking, which companies the resource
 * belongs to); this module decides. It never fetches anything itself.
 */

export type Role = "admin" | "recruiter" | "student";

export type PolicyActor = {
  role: Role;
  /** Companies this actor is a member of. Always empty for admins. */
  companyIds: readonly number[];
};

/** May this actor act on behalf of `companyId`? */
export function canActForCompany(
  actor: PolicyActor,
  companyId: number,
): boolean {
  // A student is the default role for any signed-in account. It grants nothing.
  if (actor.role === "student") return false;
  if (actor.role === "admin") return true;
  return actor.companyIds.includes(companyId);
}

/**
 * May this actor read a student's resume?
 *
 * `permittedCompanyIds` is the set of companies the student has APPLIED to —
 * applying is the student's act of sharing. An empty set means nobody but an
 * admin may read it, which is the correct answer for a candidate who has
 * registered but not yet applied anywhere.
 */
export function canReadStudentResume(
  actor: PolicyActor,
  permittedCompanyIds: readonly number[],
): boolean {
  if (actor.role === "student") return false;
  if (actor.role === "admin") return true;
  if (actor.companyIds.length === 0) return false;
  return permittedCompanyIds.some((id) => actor.companyIds.includes(id));
}

/** The facts a resume read is decided on. Gathered by the caller, never inferred here. */
export type ResumeReadRequest = {
  /** True when an `openingId` narrowed the read to ONE application's snapshot. */
  scopedToOpening: boolean;
  /** Company owning that opening. Null when the opening does not exist, or the read is not scoped. */
  owningCompanyId: number | null;
  /** Companies the student has APPLIED to. */
  permittedCompanyIds: readonly number[];
};

/**
 * May this actor read a resume — whole-profile, or one application's snapshot?
 *
 * Two DIFFERENT questions hide in this route, and conflating them was a real
 * disclosure bug (audited 2026-09-03):
 *
 *   - Whole-profile read (no openingId): may the actor see this student at all?
 *     That is `canReadStudentResume` and nothing more.
 *
 *   - Application-scoped read (openingId given): the actor must ALSO be able to
 *     act for the company owning that opening. Standing over the student is not
 *     enough. A student who applied to two companies handed each of them one
 *     CV, not both — so a recruiter at company A passing company B's openingId
 *     must be refused even though A and B both hold standing on that student.
 *
 * Because the second rule is checked on the OPENING rather than the student, it
 * also closes an enumeration channel: a recruiter cannot probe opening ids to
 * discover which rivals a candidate applied to, since every id outside their own
 * companies is refused identically whether or not an application exists.
 */
export function canReadResume(
  actor: PolicyActor,
  request: ResumeReadRequest,
): boolean {
  if (!canReadStudentResume(actor, request.permittedCompanyIds)) return false;
  if (!request.scopedToOpening) return true;

  // Scoped read: a missing opening is refused, never widened to a whole-profile read.
  if (request.owningCompanyId === null) return false;
  return canActForCompany(actor, request.owningCompanyId);
}
