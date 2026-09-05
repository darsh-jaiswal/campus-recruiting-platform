/**
 * JD reads.
 *
 * Less sensitive than resumes (a JD is content the company wants circulated),
 * but the file still lives in the private store, so reads stream through this
 * handler after a check. The rule:
 *
 *   - A LIVE opening's JD is readable by any signed-in account — students
 *     evaluating whether to apply are exactly its audience.
 *   - Otherwise (draft, closed) only admins and recruiters of the owning
 *     company may read it.
 *
 * Failure mode is 404 rather than 403, consistent with the portal.
 */

import { get } from "@vercel/blob";
import { getOpeningJdMeta } from "@/db/queries/jobs";
import { requireActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const actor = await requireActor();

  const url = new URL(request.url);
  const rawId = url.searchParams.get("openingId");
  const openingId = Number(rawId);

  if (!rawId || !Number.isInteger(openingId) || openingId <= 0) {
    return new Response("Bad request", { status: 400 });
  }

  const meta = await getOpeningJdMeta(openingId);
  if (!meta?.jdBlobKey) {
    return new Response("Not found", { status: 404 });
  }

  const permitted =
    meta.status === "live" ||
    actor.role === "admin" ||
    (actor.role === "recruiter" && actor.companyIds.includes(meta.companyId));
  if (!permitted) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const result = await get(meta.jdBlobKey, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result) return new Response("Not found", { status: 404 });

    const isPdf = meta.jdContentType === "application/pdf";
    // Filename rebuilt from our own data — never echoed from the upload path.
    const filename = `opening-${openingId}-jd.${isPdf ? "pdf" : "docx"}`;

    return new Response(result.stream, {
      headers: {
        "Content-Type": meta.jdContentType ?? "application/octet-stream",
        "Content-Disposition": `${isPdf ? "inline" : "attachment"}; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[jd-download] blob read failed:", error);
    return new Response("Not found", { status: 404 });
  }
}
