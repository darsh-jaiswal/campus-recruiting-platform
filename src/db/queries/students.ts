import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";

export type FocusAreaCode = "core_dev" | "aiml" | "robotics" | "other";
export type StudentStatus =
  | "registered"
  | "screened"
  | "shortlisted"
  | "interviewed"
  | "selected"
  | "rejected";

export type PaymentFilter = "paid" | "unpaid" | "all";

export type ScreeningFilters = {
  /** CGPA floor, as a decimal string — never a float. See schema note. */
  minCgpa?: string;
  branch?: string;
  focusArea?: FocusAreaCode;
  status?: StudentStatus;
  /** Free text across name, email and reference code. */
  query?: string;
  sort?: "cgpa_desc" | "cgpa_asc" | "newest" | "name";
  /**
   * Defaults to "paid" when omitted — an unpaid row is not a registration
   * (see the design spec's "no payment, no registration" rule) and must
   * never appear in the screening list, dashboard counts, or a CSV export as
   * a genuine applicant. Callers pass "unpaid" or "all" explicitly for
   * drop-off analysis.
   */
  paymentFilter?: PaymentFilter;
};

const SORTS = {
  cgpa_desc: desc(students.cgpa),
  cgpa_asc: asc(students.cgpa),
  newest: desc(students.createdAt),
  name: asc(students.fullName),
} as const;

function buildWhere(filters: ScreeningFilters): SQL | undefined {
  // A withdrawn registration is out of the pipeline everywhere this filter
  // reaches: the screening list, the CSV export, and dashboard counts.
  // Reinstating a student is a manual organiser action, see CLAUDE.md.
  const clauses: SQL[] = [isNull(students.withdrawnAt)];

  const paymentFilter = filters.paymentFilter ?? "paid";
  if (paymentFilter === "paid") {
    clauses.push(eq(students.paymentStatus, "paid"));
  } else if (paymentFilter === "unpaid") {
    clauses.push(eq(students.paymentStatus, "pending_payment"));
  }
  // "all" adds no clause.

  if (filters.minCgpa) clauses.push(gte(students.cgpa, filters.minCgpa));
  if (filters.branch) clauses.push(eq(students.branch, filters.branch));
  if (filters.focusArea) clauses.push(eq(students.focusArea, filters.focusArea));
  if (filters.status) clauses.push(eq(students.status, filters.status));

  if (filters.query) {
    const term = `%${filters.query}%`;
    const search = or(
      ilike(students.fullName, term),
      ilike(students.email, term),
      ilike(students.refCode, term),
    );
    if (search) clauses.push(search);
  }

  return clauses.length ? and(...clauses) : undefined;
}

/** Columns safe to list. Deliberately excludes phone — it is not needed to screen. */
const LIST_COLUMNS = {
  id: students.id,
  refCode: students.refCode,
  fullName: students.fullName,
  email: students.email,
  branch: students.branch,
  programme: students.programme,
  year: students.year,
  cgpa: students.cgpa,
  focusArea: students.focusArea,
  skills: students.skills,
  status: students.status,
  paymentStatus: students.paymentStatus,
  resumeBlobKey: students.resumeBlobKey,
  createdAt: students.createdAt,
} as const;

export type StudentListRow = {
  [K in keyof typeof LIST_COLUMNS]: (typeof students)["$inferSelect"][K];
};

export async function listStudents(
  filters: ScreeningFilters,
  limit = 100,
  offset = 0,
): Promise<StudentListRow[]> {
  return db
    .select(LIST_COLUMNS)
    .from(students)
    .where(buildWhere(filters))
    .orderBy(SORTS[filters.sort ?? "cgpa_desc"])
    .limit(limit)
    .offset(offset);
}

/**
 * Export rows — the same filter set, plus phone.
 *
 * Separate from `listStudents` on purpose. The screening table does not need a
 * phone number to make a shortlist decision, so it never loads one; the export
 * is the contact list the organising team actually works from, so it does.
 * Keeping them apart means the wider column set can only escape through the
 * one route that audits it.
 */
export async function listStudentsForExport(
  filters: ScreeningFilters,
  limit = 5000,
) {
  return db
    .select({ ...LIST_COLUMNS, phone: students.phone })
    .from(students)
    .where(buildWhere(filters))
    .orderBy(SORTS[filters.sort ?? "cgpa_desc"])
    .limit(limit);
}

export async function countStudents(
  filters: ScreeningFilters,
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(students)
    .where(buildWhere(filters));
  return row?.value ?? 0;
}

/** Full record including phone — a single-candidate read, always audited. */
export async function getStudent(id: number) {
  const [row] = await db
    .select()
    .from(students)
    .where(eq(students.id, id))
    .limit(1);
  return row ?? null;
}

export async function getStudentsByIds(ids: readonly number[]) {
  if (ids.length === 0) return [];
  return db
    .select(LIST_COLUMNS)
    .from(students)
    .where(inArray(students.id, [...ids]))
    .orderBy(desc(students.cgpa));
}

/** Dashboard counts, one round trip. Defaults to paid rows only — see ScreeningFilters.paymentFilter. */
export async function studentStatusCounts(
  paymentFilter: PaymentFilter = "paid",
): Promise<Record<StudentStatus, number>> {
  const rows = await db
    .select({
      status: students.status,
      value: sql<number>`count(*)::int`,
    })
    .from(students)
    .where(buildWhere({ paymentFilter }))
    .groupBy(students.status);

  const out: Record<StudentStatus, number> = {
    registered: 0,
    screened: 0,
    shortlisted: 0,
    interviewed: 0,
    selected: 0,
    rejected: 0,
  };
  for (const row of rows) out[row.status] = row.value;
  return out;
}

export type StatusChangedRow = {
  id: number;
  email: string;
  fullName: string;
  refCode: string | null;
};

/**
 * Bulk status write, returning ONLY the rows it actually changed — the
 * `IS DISTINCT FROM` guard makes re-running a bulk action a no-op, which is
 * what lets the caller send decision emails off the returned rows without
 * double-sending. Withdrawn registrations are never status-changed (they
 * are out of the pipeline entirely).
 */
export async function setStudentStatus(
  ids: readonly number[],
  status: StudentStatus,
): Promise<StatusChangedRow[]> {
  if (ids.length === 0) return [];
  return db
    .update(students)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        inArray(students.id, [...ids]),
        isNull(students.withdrawnAt),
        // status is NOT NULL, so ne() is a null-safe "actually changed".
        ne(students.status, status),
      ),
    )
    .returning({
      id: students.id,
      email: students.email,
      fullName: students.fullName,
      refCode: students.refCode,
    });
}

/**
 * The signed-in student's own row, whatever its payment state — the one
 * query behind /dashboard. Reading your own row is not an audited admin
 * read; it deliberately returns the full profile the student typed,
 * including phone, because it is theirs.
 */
const ACCOUNT_COLUMNS = {
  id: students.id,
  refCode: students.refCode,
  fullName: students.fullName,
  email: students.email,
  phone: students.phone,
  branch: students.branch,
  programme: students.programme,
  year: students.year,
  cgpa: students.cgpa,
  focusArea: students.focusArea,
  skills: students.skills,
  resumeFilename: students.resumeFilename,
  status: students.status,
  paymentStatus: students.paymentStatus,
  paidAt: students.paidAt,
  withdrawnAt: students.withdrawnAt,
  createdAt: students.createdAt,
} as const;

export type StudentAccountRow = {
  [K in keyof typeof ACCOUNT_COLUMNS]: (typeof students)["$inferSelect"][K];
};

export async function getStudentAccountByClerkId(
  clerkUserId: string,
): Promise<StudentAccountRow | null> {
  const [row] = await db
    .select(ACCOUNT_COLUMNS)
    .from(students)
    .where(eq(students.clerkUserId, clerkUserId))
    .limit(1);
  return row ?? null;
}

