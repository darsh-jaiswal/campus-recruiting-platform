"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPaidStudentByClerkId } from "@/db/queries/jobs";
import {
  addResume,
  replaceResume,
  setPrimaryResume,
  softDeleteResume,
} from "@/db/queries/resumes";
import { requireStudent } from "@/lib/auth";
import { MAX_ACTIVE_RESUMES } from "@/lib/resume-library";
import { REGISTRATION } from "@/lib/content";

/**
 * Resume-library writes, dashboard-only. Managing a library is a paid-
 * student capability: an unpaid row manages its single resume through the
 * registration form instead. Every rule these actions enforce also lives in
 * the guarded SQL of db/queries/resumes.ts — a stale client can't slip past
 * the WHERE clauses.
 */

export type LibraryActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

async function paidStudentOrNull() {
  const actor = await requireStudent();
  return getPaidStudentByClerkId(actor.userId);
}

const addSchema = z.object({
  resumeBlobKey: z.string().min(1).max(500),
  resumeFilename: z.string().min(1).max(200),
  resumeBytes: z.coerce
    .number()
    .int()
    .positive()
    .max(REGISTRATION.resumeMaxBytes),
});

export async function addResumeAction(
  _prev: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const student = await paidStudentOrNull();
  if (!student) {
    return { status: "error", message: "Complete your registration first." };
  }

  const parsed = addSchema.safeParse({
    resumeBlobKey: formData.get("resumeBlobKey"),
    resumeFilename: formData.get("resumeFilename"),
    resumeBytes: formData.get("resumeBytes"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Could not read that upload." };
  }

  // The blob key came from /api/resume/upload, which only a signed-in user
  // can call; the row this insert creates is owned by THIS student, so a
  // fabricated key can at worst add a broken entry to the caller's own
  // library. The insert enforces the active-entry cap in its WHERE.
  try {
    const row = await addResume(student.id, {
      blobKey: parsed.data.resumeBlobKey,
      filename: parsed.data.resumeFilename,
      bytes: parsed.data.resumeBytes,
    });
    if (!row) {
      return {
        status: "error",
        message: `Your library holds ${MAX_ACTIVE_RESUMES} resumes at most. Delete one first (or this file is already in it).`,
      };
    }
  } catch (error) {
    console.error("[resume-library] add failed:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Added to your library." };
}

const replaceSchema = addSchema.extend({
  resumeId: z.coerce.number().int().positive(),
});

/**
 * The dashboard's one-click "Replace this resume": uploads a new file and
 * atomically swaps it in as primary in place of `resumeId`, rather than the
 * three-step add → make primary → delete a student would otherwise need to
 * do by hand. Only ever targets the caller's own resume (ownership is in
 * replaceResume's WHERE clauses, same as every other action here).
 */
export async function replaceResumeAction(
  _prev: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const student = await paidStudentOrNull();
  if (!student) {
    return { status: "error", message: "Complete your registration first." };
  }

  const parsed = replaceSchema.safeParse({
    resumeBlobKey: formData.get("resumeBlobKey"),
    resumeFilename: formData.get("resumeFilename"),
    resumeBytes: formData.get("resumeBytes"),
    resumeId: formData.get("resumeId"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Could not read that upload." };
  }

  try {
    const replaced = await replaceResume(student.id, parsed.data.resumeId, {
      blobKey: parsed.data.resumeBlobKey,
      filename: parsed.data.resumeFilename,
      bytes: parsed.data.resumeBytes,
    });
    if (!replaced) {
      return {
        status: "error",
        message: `Your library holds ${MAX_ACTIVE_RESUMES} resumes at most. Delete one first (or this file is already in it).`,
      };
    }
  } catch (error) {
    console.error("[resume-library] replace failed:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Resume replaced." };
}

const targetSchema = z.object({
  resumeId: z.coerce.number().int().positive(),
});

export async function setPrimaryResumeAction(
  _prev: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const student = await paidStudentOrNull();
  if (!student) {
    return { status: "error", message: "Complete your registration first." };
  }

  const parsed = targetSchema.safeParse({ resumeId: formData.get("resumeId") });
  if (!parsed.success) {
    return { status: "error", message: "Could not read that request." };
  }

  try {
    const changed = await setPrimaryResume(student.id, parsed.data.resumeId);
    if (!changed) {
      return {
        status: "error",
        message: "That resume is no longer in your library.",
      };
    }
  } catch (error) {
    console.error("[resume-library] set-primary failed:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Primary resume updated." };
}

export async function deleteResumeAction(
  _prev: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const student = await paidStudentOrNull();
  if (!student) {
    return { status: "error", message: "Complete your registration first." };
  }

  const parsed = targetSchema.safeParse({ resumeId: formData.get("resumeId") });
  if (!parsed.success) {
    return { status: "error", message: "Could not read that request." };
  }

  try {
    const deleted = await softDeleteResume(student.id, parsed.data.resumeId);
    if (!deleted) {
      return {
        status: "error",
        message:
          "The primary resume can't be deleted — set another resume as primary first.",
      };
    }
  } catch (error) {
    console.error("[resume-library] delete failed:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Removed from your library." };
}
