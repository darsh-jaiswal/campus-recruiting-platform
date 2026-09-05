import { sweepOrphanedResumes } from "@/lib/orphaned-resumes";

/**
 * Deletes resume blobs no student row references. See src/lib/orphaned-resumes.ts
 * for why they accumulate and what protects live files.
 *
 * `?dryRun=1` reports what would go without deleting anything — worth running
 * once by hand before trusting the scheduled job against a real store.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const result = await sweepOrphanedResumes({ dryRun });

  if (!result.ran) {
    // 200, not an error: refusing to run on suspicious input is correct
    // behaviour, and a failing cron would page for something working as designed.
    return Response.json(result);
  }

  return Response.json(result);
}
