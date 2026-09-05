import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";

/**
 * Display-only status read for the registration page's polling UI. The
 * webhook (src/app/api/payments/razorpay/webhook/route.ts) is the only
 * writer of payment state — this route only ever reads what it already
 * committed, never trusts the browser's own account of what happened.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [student] = await db
    .select({
      paymentStatus: students.paymentStatus,
      refCode: students.refCode,
    })
    .from(students)
    .where(eq(students.clerkUserId, userId))
    .limit(1);

  if (!student) {
    return Response.json({ found: false });
  }

  return Response.json({
    found: true,
    paymentStatus: student.paymentStatus,
    refCode: student.refCode,
  });
}
