import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobApplications } from "@/db/schema";
import type { OpeningDetail } from "@/db/queries/openings";
import { listApplicantsForOpening } from "@/db/queries/openings";
import { getApplicationResume } from "@/db/queries/resumes";
import { scoringPromptHash } from "./openings";
import { applicationWithdrawnAt } from "./withdrawal";

/**
 * AI resume scoring for job openings.
 *
 * Claude reads each applicant's resume PDF against the opening's description
 * and the recruiter's private screening prompt, and returns a 0–100 score with
 * a short written rationale. The score RANKS the applicant list; it never
 * auto-rejects anyone — a human reads the ranking and decides, which is also
 * the answer when a student asks why they weren't picked.
 *
 * Idempotent by design: each stored score carries the hash of the inputs that
 * produced it, so a re-run scores only new applicants and rows whose opening
 * text changed since. Re-running after a partial failure picks up exactly
 * where it left off.
 */

/**
 * Owner's choice (2026-08-24): Sonnet 4.5 over Opus for scoring cost. Every
 * stored score records the model that produced it, so mixed-model history
 * stays attributable. Note Sonnet 4.5 is an older-generation model — swap to
 * a current Sonnet before its eventual retirement.
 */
const SCORE_MODEL = "claude-sonnet-4-5";

/** Small enough to stay inside one Vercel invocation comfortably. */
const CONCURRENCY = 3;

const scoreOutput = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Overall fit of this candidate for the role, 0-100."),
  rationale: z
    .string()
    .describe(
      "One to two factual sentences a recruiter reads to understand the rank. Reference concrete resume evidence.",
    ),
});

export type ScoringRunResult = {
  scored: number;
  skippedFresh: number;
  skippedNoResume: number;
  skippedWithdrawn: number;
  failed: number;
};

export class ScoringNotConfiguredError extends Error {
  constructor() {
    super("Scoring is not configured: ANTHROPIC_API_KEY is missing.");
    this.name = "ScoringNotConfiguredError";
  }
}

/**
 * Score every applicant of an opening whose stored score is missing or stale.
 *
 * The caller (the Server Action) has already verified the actor owns the
 * opening — the same trust shape as listApplicantsForOpening.
 */
export async function scoreOpeningApplicants(
  opening: OpeningDetail,
): Promise<ScoringRunResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new ScoringNotConfiguredError();

  const client = new Anthropic();
  const currentHash = scoringPromptHash(
    opening.description,
    opening.screeningPrompt,
    opening.jdBlobKey,
  );

  // Fetched once per run, not once per applicant — every call shares it.
  const jd = await loadJdContent(opening);

  const applicants = await listApplicantsForOpening(opening.id);
  const result: ScoringRunResult = {
    scored: 0,
    skippedFresh: 0,
    skippedNoResume: 0,
    skippedWithdrawn: 0,
    failed: 0,
  };

  const queue = applicants.filter((a) => {
    // A withdrawn application (its own withdrawal or the whole
    // registration's) is not scored — the candidate pulled out. Any score
    // it already earned stays on the row for the recruiter's record.
    if (applicationWithdrawnAt(a, { withdrawnAt: a.studentWithdrawnAt })) {
      result.skippedWithdrawn += 1;
      return false;
    }
    if (a.score !== null && a.promptHash === currentHash) {
      result.skippedFresh += 1;
      return false;
    }
    if (!a.hasResume) {
      result.skippedNoResume += 1;
      return false;
    }
    return true;
  });

  // Plain batching rather than a concurrency library — the pool is small and
  // a dependency is not worth it for this.
  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.allSettled(
      batch.map((applicant) =>
        scoreOneApplicant(
          client,
          opening,
          jd,
          currentHash,
          applicant.studentId,
          {
            branch: applicant.branch,
            programme: applicant.programme,
            year: applicant.year,
            cgpa: applicant.cgpa,
            skills: applicant.skills,
          },
        ),
      ),
    );
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") result.scored += 1;
      else {
        result.failed += 1;
        console.error("[scoring] applicant failed:", outcome.reason);
      }
    }
  }

  return result;
}

type ApplicantProfile = {
  branch: string;
  programme: string;
  year: string;
  cgpa: string;
  skills: string[];
};

/**
 * The uploaded JD, prepared for the API: a PDF goes in natively as a document
 * block; a .docx is reduced to text with mammoth (imperfect on heavy layout,
 * but this is model context, not display — the original stays downloadable).
 * Null when the opening has no JD, or the file could not be read — a broken
 * attachment must degrade scoring context, never abort the run.
 */
type JdContent =
  | { kind: "pdf"; base64: string }
  | { kind: "text"; text: string }
  | null;

async function loadJdContent(opening: OpeningDetail): Promise<JdContent> {
  if (!opening.jdBlobKey) return null;

  try {
    const blob = await get(opening.jdBlobKey, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!blob) return null;

    const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());

    if (opening.jdContentType === "application/pdf") {
      return { kind: "pdf", base64: bytes.toString("base64") };
    }

    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    const text = value.trim();
    return text ? { kind: "text", text } : null;
  } catch (error) {
    console.error("[scoring] JD load failed — scoring without it:", error);
    return null;
  }
}

async function scoreOneApplicant(
  client: Anthropic,
  opening: OpeningDetail,
  jd: JdContent,
  promptHash: string,
  studentId: number,
  profile: ApplicantProfile,
): Promise<void> {
  // The application's snapshot resume — the exact file the student applied
  // with, regardless of what their library holds today. Scoring anything
  // else would grade a document the recruiter never received.
  const snapshot = await getApplicationResume(opening.id, studentId);
  if (!snapshot) throw new Error(`application ${opening.id}/${studentId} has no resume`);

  // Same auth pinning as the resume download route: OIDC is not enabled for
  // development on this project, so use the RW token explicitly.
  const blob = await get(snapshot.blobKey, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  if (!blob) throw new Error(`resume blob missing for student ${studentId}`);

  const pdfBase64 = Buffer.from(await new Response(blob.stream).arrayBuffer())
    .toString("base64");

  const content: Anthropic.ContentBlockParam[] = [];

  // The JD document (when present) leads, so the model reads the role before
  // the candidate — the same order a human screener works in.
  if (jd?.kind === "pdf") {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: jd.base64 },
    });
  }

  content.push({
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
  });

  content.push({
    type: "text",
    text: [
      `JOB OPENING: ${opening.title}`,
      `Focus area: ${opening.focusArea}`,
      `Description:\n${opening.description}`,
      jd?.kind === "pdf"
        ? "The FIRST attached PDF is the full job description document; the SECOND is the candidate's resume."
        : "The attached PDF is the candidate's resume.",
      jd?.kind === "text"
        ? `Full job description document (extracted from the uploaded file):\n${jd.text}`
        : null,
      opening.screeningPrompt
        ? `Recruiter's screening instructions (private):\n${opening.screeningPrompt}`
        : "No additional screening instructions were given.",
      `Required skills: ${opening.skills.length > 0 ? opening.skills.join(", ") : "not specified"}`,
      "",
      "CANDIDATE (registered profile):",
      `Branch: ${profile.branch} · ${profile.programme} · ${profile.year}`,
      `CGPA: ${profile.cgpa}`,
      `Self-declared skills: ${profile.skills.length > 0 ? profile.skills.join(", ") : "none listed"}`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  });

  const response = await client.messages.parse({
    model: SCORE_MODEL,
    max_tokens: 2048,
    system: [
      "You score one internship candidate's resume against one job opening at a university recruitment drive.",
      "Score 0-100 for fit. 80+ means you would definitely interview them; 60-79 a plausible fit worth a look; below 60 a weak match for this specific role.",
      "Weigh concrete evidence (shipped projects, internships, specifics) over keyword mentions. The screening instructions, when present, describe what the recruiter actually wants — they outrank generic resume polish.",
      "The rationale is read by the recruiter: one or two plain factual sentences citing resume evidence. No markdown, no hedging boilerplate.",
    ].join(" "),
    messages: [{ role: "user", content }],
    output_config: {
      format: zodOutputFormat(scoreOutput),
    },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error(`unparseable scoring output for student ${studentId}`);

  await db
    .update(jobApplications)
    .set({
      score: parsed.score,
      scoreRationale: parsed.rationale,
      scoreModel: SCORE_MODEL,
      promptHash,
      scoredAt: new Date(),
    })
    .where(
      and(
        eq(jobApplications.openingId, opening.id),
        eq(jobApplications.studentId, studentId),
      ),
    );
}
