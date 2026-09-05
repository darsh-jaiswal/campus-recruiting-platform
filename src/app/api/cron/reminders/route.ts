import { runDueReminders } from "@/lib/reminders";

/**
 * Daily reminder cron. See src/lib/reminders.ts — this is a no-op until
 * EDITION.startsAt is set.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runDueReminders();

  if (result.skipped) {
    return Response.json({ skipped: true, reason: result.reason });
  }

  return Response.json({
    skipped: false,
    milestoneIndex: result.milestoneIndex,
    daysBefore: result.daysBefore,
    sent: result.sent,
    failed: result.failed,
  });
}
