import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentEvents, paymentOrders } from "@/db/schema";
import { settleStudentPayment } from "@/lib/payment-settlement";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { parseRazorpayEvent } from "@/lib/webhook-parsing";

/**
 * Razorpay webhook — the source of truth for whether a student is registered.
 *
 * The browser is never trusted to report payment (see the status-polling
 * route, which only ever reads what this handler already committed). Order
 * of operations, and why each step is where it is, is recorded in
 * payment-flow-review.md and the design spec at
 * docs/superpowers/specs/2026-08-22-student-accounts-and-payment-design.md —
 * read those before changing anything here.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  // MUST verify against the raw bytes — re-serializing a parsed body can
  // differ byte-for-byte from what Razorpay signed, failing a genuine event.
  const rawBody = await request.text();
  const signatureValid = verifyWebhookSignature(
    rawBody,
    request.headers.get("x-razorpay-signature"),
  );

  const { payload, eventType, razorpayOrderId, paidAmount, razorpayPaymentId } =
    parseRazorpayEvent(rawBody);

  // Logged BEFORE acting, so a rejected or unparseable event is still on
  // record — money needs an audit trail independent of what state anything
  // else ended up in.
  await db.insert(paymentEvents).values({
    razorpayOrderId,
    eventType,
    signatureValid,
    payload: payload ?? { unparseable: true, raw: rawBody.slice(0, 5000) },
  });

  if (!signatureValid) {
    return new Response("Invalid signature", { status: 400 });
  }

  // Only order.paid is acted on. payment.authorized, payment.failed and
  // everything else are logged (above) and otherwise ignored.
  if (eventType !== "order.paid" || !razorpayOrderId) {
    return Response.json({ ok: true, acted: false });
  }

  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.razorpayOrderId, razorpayOrderId))
    .limit(1);

  if (!order) {
    console.error(`[payments/webhook] order.paid for unknown order ${razorpayOrderId}`);
    return Response.json({ ok: true, acted: false, reason: "unknown_order" });
  }

  // Verify against what THIS order was created for, never against current
  // fee config — a fee change while this order was open must not invalidate
  // a payment the student was correctly quoted. See Defect 2.
  if (paidAmount !== order.amountPaise) {
    console.error(
      `[payments/webhook] amount mismatch for order ${razorpayOrderId}: ` +
        `expected ${order.amountPaise}, webhook reported ${paidAmount}`,
    );
    return Response.json({ ok: true, acted: false, reason: "amount_mismatch" });
  }

  await db
    .update(paymentOrders)
    .set({ status: "paid", razorpayPaymentId, updatedAt: new Date() })
    .where(eq(paymentOrders.id, order.id));

  // Zero rows means another handler already won this race (Razorpay can
  // deliver payment.captured and order.paid near-simultaneously, and retries
  // anything that doesn't return 2xx quickly) — that is a no-op, not an
  // error. See Defect 4.
  try {
    await settleStudentPayment(order.studentId);
    return Response.json({ ok: true, acted: true });
  } catch (error) {
    console.error("[payments/webhook] settlement failed:", error);
    return Response.json({ ok: true, acted: false, reason: "settlement_failed" });
  }
}
