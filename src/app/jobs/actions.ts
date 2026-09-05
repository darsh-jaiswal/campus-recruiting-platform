"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  getPaidStudentByClerkId,
  getPublicOpening,
} from "@/db/queries/jobs";
import { getActiveResume } from "@/db/queries/resumes";
import { jobApplications } from "@/db/schema";
import { requireStudent } from "@/lib/auth";
import { checkEligibility } from "@/lib/openings";

/**
 * Applying — the one write a student can make on the jobs board.
 *
 * The disabled Apply button is courtesy; THIS is the enforcement point.
 * Everything is re-checked here against the database: signed in, registered
 * and paid, opening live, CGPA floor, branch list. The (opening, student)
 * primary key makes a duplicate apply structurally impossible, so a retry or
 * double-click converges on "you have applied" rather than an error.
 *
 * Applying is also the student's act of sharing: it is what grants the
 * opening's company resume-read standing (see the resume download route).
 */

export type ApplyState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "applied" };

const targetSchema = z.object({
  openingId: z.coerce.number().int().positive(),
  resumeId: z.coerce.number().int().positive(),
});

export async function applyToOpening(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const actor = await requireStudent();

  const target = targetSchema.safeParse({
    openingId: formData.get("openingId"),
    resumeId: formData.get("resumeId"),
  });
  if (!target.success) {
    return { status: "error", message: "Could not read that request." };
  }

  const student = await getPaidStudentByClerkId(actor.userId);
  if (!student) {
    return {
      status: "error",
      message:
        "Complete your Aspire Quest registration first — your application uses the profile and resume from it.",
    };
  }
  if (student.withdrawnAt) {
    return {
      status: "error",
      message:
        "Your registration is withdrawn, so new applications are closed to you. Contact the organising team to reinstate it.",
    };
  }

  const opening = await getPublicOpening(target.data.openingId);
  if (!opening || opening.status !== "live") {
    return {
      status: "error",
      message: "This opening is not accepting applications.",
    };
  }

  const eligibility = checkEligibility(opening, student);
  if (!eligibility.eligible) {
    return { status: "error", message: eligibility.reason };
  }

  // The chosen CV must be the caller's own, and still active. A concurrent
  // soft-delete between this read and the insert is harmless: the snapshot
  // is allowed to point at a soft-deleted entry — that is what "snapshot"
  // means — and the orphan sweep spares any blob an application references.
  const resume = await getActiveResume(student.id, target.data.resumeId);
  if (!resume) {
    return {
      status: "error",
      message: "That resume is no longer in your library. Pick another one.",
    };
  }

  try {
    await db
      .insert(jobApplications)
      .values({
        openingId: opening.id,
        studentId: student.id,
        resumeId: resume.id,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error("[jobs] apply failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again in a moment.",
    };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${opening.id}`);
  return { status: "applied" };
}

export type WithdrawState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "withdrawn" };

const withdrawSchema = z.object({
  openingId: z.coerce.number().int().positive(),
});

/**
 * Withdraw one application. Allowed at any time — students take offers
 * elsewhere even after an opening closes. The row is kept: the recruiter
 * sees a withdrawn candidate, not a vanished one, and any AI score stays
 * on record. Re-applying (below) is what clears the flag.
 */
export async function withdrawApplication(
  _prev: WithdrawState,
  formData: FormData,
): Promise<WithdrawState> {
  const actor = await requireStudent();

  const target = withdrawSchema.safeParse({
    openingId: formData.get("openingId"),
  });
  if (!target.success) {
    return { status: "error", message: "Could not read that request." };
  }

  const student = await getPaidStudentByClerkId(actor.userId);
  if (!student) {
    return { status: "error", message: "No application found." };
  }

  try {
    const updated = await db
      .update(jobApplications)
      .set({ withdrawnAt: new Date() })
      .where(
        and(
          eq(jobApplications.openingId, target.data.openingId),
          eq(jobApplications.studentId, student.id),
          isNull(jobApplications.withdrawnAt),
        ),
      )
      .returning({ openingId: jobApplications.openingId });
    if (updated.length === 0) {
      return { status: "error", message: "No active application to withdraw." };
    }
  } catch (error) {
    console.error("[jobs] withdraw failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again in a moment.",
    };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${target.data.openingId}`);
  revalidatePath("/dashboard");
  return { status: "withdrawn" };
}

/**
 * Re-apply after a withdrawal — only while the opening is live, with a
 * fresh CV choice. ONE UPDATE: the CASE expressions read the OLD resume_id
 * (Postgres SET sees pre-update values), so the stored AI score survives
 * exactly when the CV is unchanged and is thrown away when it isn't — the
 * old score described the old document. See src/lib/withdrawal.ts.
 */
export async function reapplyToOpening(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const actor = await requireStudent();

  const target = targetSchema.safeParse({
    openingId: formData.get("openingId"),
    resumeId: formData.get("resumeId"),
  });
  if (!target.success) {
    return { status: "error", message: "Could not read that request." };
  }

  const student = await getPaidStudentByClerkId(actor.userId);
  if (!student) {
    return { status: "error", message: "No application found." };
  }
  if (student.withdrawnAt) {
    return {
      status: "error",
      message:
        "Your registration is withdrawn, so new applications are closed to you. Contact the organising team to reinstate it.",
    };
  }

  const opening = await getPublicOpening(target.data.openingId);
  if (!opening || opening.status !== "live") {
    return {
      status: "error",
      message: "This opening is not accepting applications.",
    };
  }

  const eligibility = checkEligibility(opening, student);
  if (!eligibility.eligible) {
    return { status: "error", message: eligibility.reason };
  }

  const resume = await getActiveResume(student.id, target.data.resumeId);
  if (!resume) {
    return {
      status: "error",
      message: "That resume is no longer in your library. Pick another one.",
    };
  }

  try {
    const updated = await db.execute(sql`
      UPDATE job_applications SET
        withdrawn_at = NULL,
        applied_at = now(),
        score = CASE WHEN resume_id = ${resume.id} THEN score ELSE NULL END,
        score_rationale = CASE WHEN resume_id = ${resume.id} THEN score_rationale ELSE NULL END,
        score_model = CASE WHEN resume_id = ${resume.id} THEN score_model ELSE NULL END,
        prompt_hash = CASE WHEN resume_id = ${resume.id} THEN prompt_hash ELSE NULL END,
        scored_at = CASE WHEN resume_id = ${resume.id} THEN scored_at ELSE NULL END,
        resume_id = ${resume.id}
      WHERE opening_id = ${opening.id}
        AND student_id = ${student.id}
        AND withdrawn_at IS NOT NULL
      RETURNING opening_id
    `);
    if (updated.rows.length === 0) {
      return { status: "error", message: "No withdrawn application to revive." };
    }
  } catch (error) {
    console.error("[jobs] re-apply failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again in a moment.",
    };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${opening.id}`);
  revalidatePath("/dashboard");
  return { status: "applied" };
}
