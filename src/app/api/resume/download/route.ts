import { get } from "@vercel/blob";
import {
  companiesStudentAppliedTo,
  getOpeningCompany,
} from "@/db/queries/openings";
import { getApplicationResume } from "@/db/queries/resumes";
import { getStudent } from "@/db/queries/students";
import { canReadResume } from "@/lib/access-policy";
import { recordAudit } from "@/lib/audit";
import { requireActor } from "@/lib/auth";

/**
 * Resume reads.
 *
 * This is the single most sensitive route in the application, so the rules are
 * strict and stated:
 *
 *   1. The raw blob URL is NEVER returned to the client. The bytes are streamed
 *      through this handler after an authorization check.
 *   2. An admin may read any resume. A recruiter may read a resume ONLY if
 *      the student applied to an opening of a company that recruiter is a
 *      member of — checked against the database, never against anything the
 *      client sent.
 *   3. An `openingId` scope narrows the read to ONE application's snapshot, and
 *      the caller must be able to act for the company that OWNS that opening.
 *      Standing over the student is NOT sufficient: a student who applied to
 *      two companies granted each of them one CV, not both.
 *   4. Every successful read writes an audit row before the bytes go out.
 *
 * Failure mode is 404 rather than 403 for recruiters: telling an unauthorised
 * caller that a given student id exists is itself a disclosure.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const actor = await requireActor();

  const url = new URL(request.url);
  const rawId = url.searchParams.get("studentId");
  const studentId = Number(rawId);

  if (!rawId || !Number.isInteger(studentId) || studentId <= 0) {
    return new Response("Bad request", { status: 400 });
  }

  // Optional: scope the read to one application's SNAPSHOT resume — the file
  // actually submitted to that opening, which may differ from the student's
  // current primary. Recruiters' applicant lists pass this; admin reads
  // stay whole-profile (the primary, via the students mirror).
  const rawOpeningId = url.searchParams.get("openingId");
  let openingId: number | null = null;
  if (rawOpeningId !== null) {
    openingId = Number(rawOpeningId);
    if (!Number.isInteger(openingId) || openingId <= 0) {
      return new Response("Bad request", { status: 400 });
    }
  }

  // Every fact the decision needs is gathered FIRST, the decision is made
  // once, and only then is a file selected. That order is deliberate: it is
  // what stops the 404 from working as an oracle. Selecting the file first
  // made a real application answer differently from an absent one, so a
  // recruiter could sweep the sequential opening ids and read off which
  // competitors each of their candidates had applied to.
  const owning = openingId !== null ? await getOpeningCompany(openingId) : null;

  const student = await getStudent(studentId);
  if (!student) {
    return new Response("Not found", { status: 404 });
  }

  // Standing comes from the student's own application to one of the company's
  // job openings — applying is itself the student's act of sharing. (Curated
  // bundles, the second channel, were removed 2026-08-24.)
  const permitted = await companiesStudentAppliedTo(studentId);

  // Decided by the tested policy in @/lib/access-policy, not inline here.
  const allowed = canReadResume(actor, {
    scopedToOpening: openingId !== null,
    owningCompanyId: owning?.companyId ?? null,
    permittedCompanyIds: permitted,
  });
  if (!allowed) {
    return new Response("Not found", { status: 404 });
  }

  const snapshot = openingId
    ? await getApplicationResume(openingId, studentId)
    : null;
  const blobKey = snapshot?.blobKey ?? (openingId ? null : student.resumeBlobKey);
  if (!blobKey) {
    return new Response("Not found", { status: 404 });
  }

  await recordAudit({
    actor,
    action: "view_resume",
    studentId,
    detail: openingId
      ? `Resume read · ${student.refCode} · application to opening ${openingId}`
      : `Resume read · ${student.refCode}`,
  });

  try {
    // Both VERCEL_OIDC_TOKEN and BLOB_STORE_ID are present in every
    // environment, which makes the SDK prefer OIDC auth — but OIDC isn't
    // enabled for "development" on this project, so pin the RW token, same
    // as the upload route.
    const result = await get(blobKey, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result) return new Response("Not found", { status: 404 });

    // Filename is rebuilt from our own data — never echoed from the upload.
    const filename = `${student.refCode}-resume.pdf`;

    return new Response(result.stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[resume-download] blob read failed:", error);
    return new Response("Could not read that file", { status: 502 });
  }
}
