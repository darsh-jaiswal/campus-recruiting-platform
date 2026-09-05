import "server-only";

/**
 * Reconciliation — the fallback for a webhook that never arrived.
 *
 * Razorpay webhook delivery is a real dependency (see the design spec's
 * accepted risks); if it's down, a payment can succeed with nothing here
 * ever told about it. This asks Razorpay directly, once a day, about any
 * order that has sat non-terminal for over an hour, and settles it through
 * the same compare-and-swap the webhook uses.
 */

import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { paymentOrders } from "@/db/schema";
import { settleStudentPayment } from "@/lib/payment-settlement";
import Razorpay from "razorpay";

const STUCK_AFTER_MS = 60 * 60 * 1000; // 1 hour

export type ReconciliationResult = {
  checked: number;
  settled: number;
  stillPending: number;
  failed: number;
};

export async function reconcilePendingOrders(
  now = new Date(),
): Promise<ReconciliationResult> {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error("[payment-reconciliation] Razorpay is not configured — skipping.");
    return { checked: 0, settled: 0, stillPending: 0, failed: 0 };
  }

  const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);

  const stuck = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.status, "created"), lt(paymentOrders.createdAt, cutoff)));

  let settled = 0;
  let stillPending = 0;
  let failed = 0;

  for (const order of stuck) {
    try {
      const remoteOrder = await client.orders.fetch(order.razorpayOrderId);

      if (remoteOrder.status !== "paid") {
        stillPending += 1;
        continue;
      }

      const { items } = await client.orders.fetchPayments(order.razorpayOrderId);
      const captured = items.find((payment) => payment.status === "captured") ?? items[0];

      await db
        .update(paymentOrders)
        .set({
          status: "paid",
          razorpayPaymentId: captured?.id,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));

      await settleStudentPayment(order.studentId);
      settled += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[payment-reconciliation] failed to reconcile order ${order.razorpayOrderId}:`,
        error,
      );
    }
  }

  return { checked: stuck.length, settled, stillPending, failed };
}
