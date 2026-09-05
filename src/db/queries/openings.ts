import "server-only";

import type { OpeningFocusCode } from "@/lib/content";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, jobApplications, jobOpenings, students } from "@/db/schema";

/**
 * Job-opening reads.
 *
 * Same isolation discipline as portal.ts: every recruiter-facing function
 * takes the permitted company ids as a REQUIRED argument and carries them in
 * the WHERE clause. There is no read-an-opening-by-id-alone variant a
 * recruiter path could reach, and an empty `companyIds` short-circuits to
 * nothing rather than reaching the database.
 */

export type OpeningListRow = {
  id: number;
  title: string;
  focusArea: OpeningFocusCode;
  status: "draft" | "live" | "closed";
  publishedAt: Date | null;
  applicants: number;
  /** Null when no application has been scored yet. */
  avgScore: number | null;
};

/** Every opening across the recruiter's companies, newest first. */
export async function listOpeningsForCompanies(
  companyIds: readonly number[],
): Promise<OpeningListRow[]> {
  if (companyIds.length === 0) return [];

  return db
    .select({
      id: jobOpenings.id,
      title: jobOpenings.title,
      focusArea: jobOpenings.focusArea,
      status: jobOpenings.status,
      publishedAt: jobOpenings.publishedAt,
      applicants: sql<number>`(
        select count(*)::int from ${jobApplications}
        where ${jobApplications.openingId} = ${jobOpenings.id}
      )`,
      avgScore: sql<number | null>`(
        select round(avg(${jobApplications.score}))::int from ${jobApplications}
        where ${jobApplications.openingId} = ${jobOpenings.id}
          and ${jobApplications.score} is not null
      )`,
    })
    .from(jobOpenings)
    .where(inArray(jobOpenings.companyId, [...companyIds]))
    .orderBy(desc(jobOpenings.createdAt));
}

export type OpeningDetail = {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  focusArea: OpeningFocusCode;
  description: string;
  screeningPrompt: string | null;
  jdBlobKey: string | null;
  jdFilename: string | null;
  jdBytes: number | null;
  jdContentType: string | null;
  minCgpa: string | null;
  eligibleBranches: string[];
  skills: string[];
  status: "draft" | "live" | "closed";
  publishedAt: Date | null;
};

/**
 * One opening, scoped to the caller's companies. Null both when it does not
 * exist and when it is not theirs — indistinguishable on purpose.
 */
export async function getOpeningForCompanies(
  openingId: number,
  companyIds: readonly number[],
): Promise<OpeningDetail | null> {
  if (companyIds.length === 0) return null;

  const [row] = await db
    .select({
      id: jobOpenings.id,
      companyId: jobOpenings.companyId,
      companyName: companies.name,
      title: jobOpenings.title,
      focusArea: jobOpenings.focusArea,
      description: jobOpenings.description,
      screeningPrompt: jobOpenings.screeningPrompt,
      jdBlobKey: jobOpenings.jdBlobKey,
      jdFilename: jobOpenings.jdFilename,
      jdBytes: jobOpenings.jdBytes,
      jdContentType: jobOpenings.jdContentType,
      minCgpa: jobOpenings.minCgpa,
      eligibleBranches: jobOpenings.eligibleBranches,
      skills: jobOpenings.skills,
      status: jobOpenings.status,
      publishedAt: jobOpenings.publishedAt,
    })
    .from(jobOpenings)
    .innerJoin(companies, eq(jobOpenings.companyId, companies.id))
    .where(
      and(
        eq(jobOpenings.id, openingId),
        inArray(jobOpenings.companyId, [...companyIds]),
      ),
    )
    .limit(1);

  return row ?? null;
}

export type ApplicantRow = {
  studentId: number;
  refCode: string | null;
  fullName: string;
  branch: string;
  programme: string;
  year: string;
  cgpa: string;
  skills: string[];
  hasResume: boolean;
  appliedAt: Date;
  /** Derive the effective state via applicationWithdrawnAt() — either
   *  timestamp withdraws the application. */
  withdrawnAt: Date | null;
  studentWithdrawnAt: Date | null;
  interested: boolean | null;
  score: number | null;
  scoreRationale: string | null;
  promptHash: string | null;
};

/**
 * The applicant list for an opening, best score first, unscored last.
 *
 * Ownership of the opening MUST already be verified via
 * `getOpeningForCompanies` — this function trusts its caller, which is why it
 * lives in this file next to the check rather than exported from students.ts.
 */
export async function listApplicantsForOpening(
  openingId: number,
): Promise<ApplicantRow[]> {
  return db
    .select({
      studentId: students.id,
      refCode: students.refCode,
      fullName: students.fullName,
      branch: students.branch,
      programme: students.programme,
      year: students.year,
      cgpa: students.cgpa,
      skills: students.skills,
      // The application's SNAPSHOT resume, not the student's current one —
      // what this recruiter can actually open is what was applied with.
      hasResume: sql<boolean>`${jobApplications.resumeId} is not null`,
      appliedAt: jobApplications.appliedAt,
      withdrawnAt: jobApplications.withdrawnAt,
      studentWithdrawnAt: students.withdrawnAt,
      interested: jobApplications.interested,
      score: jobApplications.score,
      scoreRationale: jobApplications.scoreRationale,
      promptHash: jobApplications.promptHash,
    })
    .from(jobApplications)
    .innerJoin(students, eq(jobApplications.studentId, students.id))
    .where(eq(jobApplications.openingId, openingId))
    .orderBy(
      sql`${jobApplications.score} desc nulls last`,
      jobApplications.appliedAt,
    );
}

/**
 * The company an opening belongs to — used by Server Actions to re-derive
 * authority from the database rather than trusting a form field. Mirrors
 * getBundleCompanyIfReleased in portal.ts.
 */
export async function getOpeningCompany(
  openingId: number,
): Promise<{ companyId: number; status: "draft" | "live" | "closed" } | null> {
  const [row] = await db
    .select({ companyId: jobOpenings.companyId, status: jobOpenings.status })
    .from(jobOpenings)
    .where(eq(jobOpenings.id, openingId))
    .limit(1);

  return row ?? null;
}

/**
 * Companies whose openings this student has applied to.
 *
 * Feeds the resume-download authorization: applying to a company's opening is
 * the student's own act of sharing with that company, and it is the ONLY
 * thing that grants resume-read standing. Draft/closed status does not
 * revoke it — the application still exists and is still being evaluated.
 */
export async function companiesStudentAppliedTo(
  studentId: number,
): Promise<number[]> {
  const rows = await db
    .selectDistinct({ companyId: jobOpenings.companyId })
    .from(jobApplications)
    .innerJoin(jobOpenings, eq(jobApplications.openingId, jobOpenings.id))
    .where(eq(jobApplications.studentId, studentId));

  return rows.map((r) => r.companyId);
}
