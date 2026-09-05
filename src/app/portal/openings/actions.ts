"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  getOpeningCompany,
  getOpeningForCompanies,
} from "@/db/queries/openings";
import { jobApplications, jobOpenings } from "@/db/schema";
import { requireRecruiter } from "@/lib/auth";
import type { OpeningFocusCode } from "@/lib/content";
import { parseInterest } from "@/lib/interest";
import {
  ScoringNotConfiguredError,
  scoreOpeningApplicants,
} from "@/lib/scoring";
import { fieldErrors, jobOpeningSchema } from "@/lib/validation";

/**
 * Job-opening writes, all recruiter-side.
 *
 * Ordering discipline: authenticate first, re-read
 * authority FROM THE DATABASE second, decide third, and scope the UPDATE so a
 * substituted id cannot reach another company's rows. Company authority is
 * never taken from the form.
 *
 * Publishing is deliberately self-serve — the product decision of 2026-08-23
 * removed the organiser approval gate for openings. What keeps that defensible:
 * an opening exposes no student data by existing, and applicants apply to it
 * knowingly. Everything student-identifying still sits behind the recruiter's
 * company membership plus audit logging.
 */

export type OpeningActionState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fields?: Record<string, string>;
      /** Echoed submission so a failed submit never wipes the form (React 19 resets fields after every action). */
      values?: {
        title: string;
        focusArea: string;
        description: string;
        screeningPrompt: string;
        minCgpa: string;
        skills: string;
        eligibleBranches: string[];
      };
    }
  | { status: "success"; message: string };

function echoOpeningValues(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    focusArea: String(formData.get("focusArea") ?? ""),
    description: String(formData.get("description") ?? ""),
    screeningPrompt: String(formData.get("screeningPrompt") ?? ""),
    minCgpa: String(formData.get("minCgpa") ?? ""),
    skills: String(formData.get("skills") ?? ""),
    eligibleBranches: formData
      .getAll("eligibleBranches")
      .filter((v): v is string => typeof v === "string"),
  };
}

/* -------------------------------------------------------------------------
 * Create
 * ---------------------------------------------------------------------- */

export async function createOpening(
  _prev: OpeningActionState,
  formData: FormData,
): Promise<OpeningActionState> {
  const actor = await requireRecruiter();

  // A recruiter with no company link cannot own an opening. The portal index
  // already explains the situation; this is the fail-closed backstop.
  const companyId = actor.companyIds[0];
  if (companyId === undefined) {
    return {
      status: "error",
      message:
        "Your account is not linked to a company yet, so it cannot post openings.",
    };
  }

  const intent = formData.get("intent") === "publish" ? "publish" : "draft";

  const parsed = jobOpeningSchema.safeParse({
    title: formData.get("title"),
    focusArea: formData.get("focusArea"),
    description: formData.get("description"),
    screeningPrompt: formData.get("screeningPrompt") ?? "",
    jdBlobKey: formData.get("jdBlobKey") ?? "",
    jdFilename: formData.get("jdFilename") ?? "",
    jdBytes: formData.get("jdBytes") ?? 0,
    jdContentType: formData.get("jdContentType") ?? "",
    minCgpa: formData.get("minCgpa") ?? "",
    eligibleBranches: formData.getAll("eligibleBranches"),
    skills: String(formData.get("skills") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: echoOpeningValues(formData),
    };
  }

  try {
    await db.insert(jobOpenings).values({
      companyId,
      createdBy: actor.userId,
      title: parsed.data.title,
      focusArea: parsed.data.focusArea as OpeningFocusCode,
      description: parsed.data.description,
      screeningPrompt: parsed.data.screeningPrompt,
      jdBlobKey: parsed.data.jdBlobKey,
      jdFilename: parsed.data.jdFilename,
      jdBytes: parsed.data.jdBytes,
      jdContentType: parsed.data.jdContentType,
      minCgpa: parsed.data.minCgpa,
      eligibleBranches: [...parsed.data.eligibleBranches],
      skills: parsed.data.skills,
      status: intent === "publish" ? "live" : "draft",
      publishedAt: intent === "publish" ? new Date() : null,
    });
  } catch (error) {
    console.error("[openings] create failed:", error);
    return {
      status: "error",
      message: "Could not save the opening.",
      values: echoOpeningValues(formData),
    };
  }

  revalidatePath("/portal/openings");
  redirect(`/portal/openings?note=${intent === "publish" ? "published" : "draft"}`);
}

/* -------------------------------------------------------------------------
 * Edit
 * ---------------------------------------------------------------------- */

/**
 * Field edits only — status has its own action below. Content edits leave the
 * status untouched; if the description or screening prompt changed, stored
 * scores go stale via the prompt hash and the applicants page says so.
 */
export async function updateOpening(
  _prev: OpeningActionState,
  formData: FormData,
): Promise<OpeningActionState> {
  const actor = await requireRecruiter();

  const idParsed = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(formData.get("openingId"));
  if (!idParsed.success) {
    return { status: "error", message: "Could not read that request." };
  }
  const openingId = idParsed.data;

  // Authority from the database, not the form.
  const owned = await getOpeningCompany(openingId);
  if (!owned || !actor.companyIds.includes(owned.companyId)) {
    return { status: "error", message: "That opening is not available." };
  }

  const parsed = jobOpeningSchema.safeParse({
    title: formData.get("title"),
    focusArea: formData.get("focusArea"),
    description: formData.get("description"),
    screeningPrompt: formData.get("screeningPrompt") ?? "",
    jdBlobKey: formData.get("jdBlobKey") ?? "",
    jdFilename: formData.get("jdFilename") ?? "",
    jdBytes: formData.get("jdBytes") ?? 0,
    jdContentType: formData.get("jdContentType") ?? "",
    minCgpa: formData.get("minCgpa") ?? "",
    eligibleBranches: formData.getAll("eligibleBranches"),
    skills: String(formData.get("skills") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: echoOpeningValues(formData),
    };
  }

  try {
    await db
      .update(jobOpenings)
      .set({
        title: parsed.data.title,
        focusArea: parsed.data.focusArea as OpeningFocusCode,
        description: parsed.data.description,
        screeningPrompt: parsed.data.screeningPrompt,
        jdBlobKey: parsed.data.jdBlobKey,
        jdFilename: parsed.data.jdFilename,
        jdBytes: parsed.data.jdBytes,
        jdContentType: parsed.data.jdContentType,
        minCgpa: parsed.data.minCgpa,
        eligibleBranches: [...parsed.data.eligibleBranches],
        skills: parsed.data.skills,
        updatedAt: new Date(),
      })
      .where(eq(jobOpenings.id, openingId));
  } catch (error) {
    console.error("[openings] update failed:", error);
    return {
      status: "error",
      message: "Could not save the changes.",
      values: echoOpeningValues(formData),
    };
  }

  revalidatePath("/portal/openings");
  revalidatePath(`/portal/openings/${openingId}`);
  redirect(`/portal/openings/${openingId}`);
}

/* -------------------------------------------------------------------------
 * Status — publish a draft, close a live opening, reopen a closed one
 * ---------------------------------------------------------------------- */

/** The lifecycle, stated once. Anything not listed here is not a transition. */
const STATUS_TRANSITIONS: Record<string, { from: "draft" | "live" | "closed"; to: "draft" | "live" | "closed" }> = {
  publish: { from: "draft", to: "live" },
  close: { from: "live", to: "closed" },
  reopen: { from: "closed", to: "live" },
};

export async function setOpeningStatus(formData: FormData): Promise<void> {
  const actor = await requireRecruiter();

  const idParsed = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(formData.get("openingId"));
  const transition = STATUS_TRANSITIONS[String(formData.get("transition"))];
  if (!idParsed.success || !transition) return;
  const openingId = idParsed.data;

  const owned = await getOpeningCompany(openingId);
  if (!owned || !actor.companyIds.includes(owned.companyId)) return;

  // Guarding on the current status in the WHERE clause makes a double-click
  // or a stale tab a no-op rather than an illegal jump.
  await db
    .update(jobOpenings)
    .set({
      status: transition.to,
      updatedAt: new Date(),
      ...(transition.to === "live" && owned.status === "draft"
        ? { publishedAt: new Date() }
        : {}),
    })
    .where(
      and(
        eq(jobOpenings.id, openingId),
        eq(jobOpenings.status, transition.from),
      ),
    );

  revalidatePath("/portal/openings");
  revalidatePath(`/portal/openings/${openingId}`);
}

/* -------------------------------------------------------------------------
 * Applicant interest — the same tri-state as candidate sets
 * ---------------------------------------------------------------------- */

const targetSchema = z.object({
  openingId: z.coerce.number().int().positive(),
  studentId: z.coerce.number().int().positive(),
});

export async function setApplicantInterest(
  _prev: OpeningActionState,
  formData: FormData,
): Promise<OpeningActionState> {
  const actor = await requireRecruiter();

  const target = targetSchema.safeParse({
    openingId: formData.get("openingId"),
    studentId: formData.get("studentId"),
  });
  if (!target.success) {
    return { status: "error", message: "Could not read that request." };
  }

  const interested = parseInterest(formData.get("interested"));

  // Authority re-derived from the database — same answer whether the opening
  // is missing or another company's.
  const opening = await getOpeningCompany(target.data.openingId);
  if (!opening || !actor.companyIds.includes(opening.companyId)) {
    return { status: "error", message: "That opening is not available." };
  }

  try {
    const [updated] = await db
      .update(jobApplications)
      .set({ interested })
      .where(
        and(
          eq(jobApplications.openingId, target.data.openingId),
          eq(jobApplications.studentId, target.data.studentId),
        ),
      )
      .returning({ studentId: jobApplications.studentId });

    if (!updated) {
      return { status: "error", message: "That candidate has not applied here." };
    }

    revalidatePath(`/portal/openings/${target.data.openingId}`);
    return {
      status: "success",
      message:
        interested === true
          ? "Marked as interested."
          : interested === false
            ? "Passed."
            : "Cleared.",
    };
  } catch (error) {
    console.error("[openings] interest update failed:", error);
    return { status: "error", message: "Could not save that." };
  }
}

/* -------------------------------------------------------------------------
 * Re-run AI scoring
 * ---------------------------------------------------------------------- */

const rescoreSchema = z.object({
  openingId: z.coerce.number().int().positive(),
});

export async function rescoreOpening(
  _prev: OpeningActionState,
  formData: FormData,
): Promise<OpeningActionState> {
  const actor = await requireRecruiter();

  const target = rescoreSchema.safeParse({
    openingId: formData.get("openingId"),
  });
  if (!target.success) {
    return { status: "error", message: "Could not read that request." };
  }

  const opening = await getOpeningForCompanies(
    target.data.openingId,
    actor.companyIds,
  );
  if (!opening) {
    return { status: "error", message: "That opening is not available." };
  }

  try {
    const run = await scoreOpeningApplicants(opening);
    revalidatePath(`/portal/openings/${opening.id}`);
    revalidatePath("/portal/openings");

    if (run.scored === 0 && run.failed === 0) {
      return {
        status: "success",
        message: "All applications are already scored against the current prompt.",
      };
    }
    return {
      status: "success",
      message: `Scored ${run.scored} application${run.scored === 1 ? "" : "s"}${
        run.failed > 0 ? ` · ${run.failed} failed — run again to retry` : ""
      }.`,
    };
  } catch (error) {
    if (error instanceof ScoringNotConfiguredError) {
      return {
        status: "error",
        message:
          "AI scoring is not configured on this deployment yet. Ask the organisers to add the scoring key.",
      };
    }
    console.error("[openings] scoring run failed:", error);
    return { status: "error", message: "Scoring failed. Try again." };
  }
}
