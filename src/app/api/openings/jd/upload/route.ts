/**
 * Server-proxied JD uploads for job openings.
 *
 * Same shape as the resume upload route, and for the same reason: the private
 * Blob store rejects the browser direct-upload token flow, so the bytes go
 * browser → this function → Blob.
 *
 * Differences from resumes: this surface is recruiter-only (authenticated, so
 * no rate limiter needed — Clerk is the gate), and it accepts .docx alongside
 * PDF because JDs arrive as Word documents more often than not.
 */

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { JD_UPLOAD } from "@/lib/openings";

export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor || actor.role !== "recruiter") {
    // 404, not 403 — consistent with the rest of the recruiter surface.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was received." }, { status: 400 });
  }

  if (!(JD_UPLOAD.acceptedTypes as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: `The JD must be ${JD_UPLOAD.acceptedLabel}.` },
      { status: 400 },
    );
  }

  if (file.size > JD_UPLOAD.maxBytes) {
    return NextResponse.json(
      { error: `That file is over the ${JD_UPLOAD.maxLabel} limit.` },
      { status: 400 },
    );
  }

  try {
    // Never trust the submitted filename as a storage key.
    const blob = await put(`jd/${file.name}`, file, {
      access: "private",
      addRandomSuffix: true,
      allowOverwrite: false,
      contentType: file.type,
      // OIDC isn't enabled for "development" on this project; pin the RW
      // token, same as the resume routes.
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ key: blob.pathname });
  } catch (error) {
    console.error("[jd-upload] blob write failed:", error);
    return NextResponse.json(
      { error: "Could not store that file. Please try again." },
      { status: 502 },
    );
  }
}
