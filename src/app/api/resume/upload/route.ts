/**
 * Server-proxied resume uploads.
 *
 * Direct-to-Blob uploads from the browser (the `@vercel/blob/client` token
 * flow) do not work against a *private* access store: the store's CORS
 * preflight for the client-token PUT returns 403 and never allows the
 * `authorization` header the SDK needs, so the browser blocks the upload
 * before it's sent. Confirmed by hand against the live store — this isn't a
 * config slip on our side, private stores just don't support that flow.
 *
 * So the bytes go browser → this function → Blob instead. That costs some
 * function bandwidth per registration (capped at 5 MB), but keeps the
 * resume genuinely private, which is the guarantee stated in the consent
 * checkbox on the form.
 */

import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { REGISTRATION } from "@/lib/content";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request): Promise<NextResponse> {
  // Uploads write to the store the moment a file is picked, before any form
  // is submitted — an identity is the only thing tying that write to a real
  // registration. Anonymous writes were possible until 2026-08-24.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Your session has expired. Sign in again to upload a resume." },
      { status: 401 },
    );
  }

  const ip = clientIp(request.headers);
  const limit = await checkRateLimit("upload", ip);

  if (!limit.ok) {
    return NextResponse.json(
      {
        error:
          limit.reason === "rate_limited"
            ? "Too many upload attempts. Try again in a few minutes."
            : "Uploads are temporarily unavailable. Please try again shortly.",
      },
      { status: limit.reason === "rate_limited" ? 429 : 503 },
    );
  }

  const userLimit = await checkRateLimit("upload-user", userId);
  if (!userLimit.ok) {
    return NextResponse.json(
      {
        error:
          userLimit.reason === "rate_limited"
            ? "Too many upload attempts. Try again in a few minutes."
            : "Uploads are temporarily unavailable. Please try again shortly.",
      },
      { status: userLimit.reason === "rate_limited" ? 429 : 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was received." }, { status: 400 });
  }

  if (!(REGISTRATION.resumeAcceptedTypes as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: `Your resume must be ${REGISTRATION.resumeAcceptedLabel}.` },
      { status: 400 },
    );
  }

  if (file.size > REGISTRATION.resumeMaxBytes) {
    return NextResponse.json(
      { error: `That file is over the ${REGISTRATION.resumeMaxLabel} limit.` },
      { status: 400 },
    );
  }

  try {
    // Never trust the submitted filename as a storage key. The resumes/
    // prefix keeps the store auditable next to jd/ — legacy resumes live at
    // the root, so nothing may ever assume the prefix exists.
    const blob = await put(`resumes/${file.name}`, file, {
      access: "private",
      addRandomSuffix: true,
      allowOverwrite: false,
      contentType: "application/pdf",
      // Both VERCEL_OIDC_TOKEN and BLOB_STORE_ID are present in every
      // environment, which makes the SDK prefer OIDC auth — but OIDC isn't
      // enabled for "development" on this project, so pin the RW token.
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ key: blob.pathname });
  } catch (error) {
    console.error("[resume-upload] blob write failed:", error);
    return NextResponse.json(
      { error: "Could not store that file. Please try again." },
      { status: 502 },
    );
  }
}
