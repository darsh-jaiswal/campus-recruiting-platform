import { cleanupAbandonedRegistrations } from "@/lib/pending-registration-cleanup";

/**
 * Daily cleanup of abandoned, unpaid registrations — see
 * src/lib/pending-registration-cleanup.ts for the two conditions that must
 * both hold before a row is deleted.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await cleanupAbandonedRegistrations();
  return Response.json(result);
}
