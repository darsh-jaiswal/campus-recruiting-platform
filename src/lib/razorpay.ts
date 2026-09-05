/**
 * Razorpay — server-side order creation and webhook signature verification.
 *
 * Not a Vercel Marketplace integration (verified 2026-08-22: the payments
 * category offers Stripe only). Wired directly via the razorpay SDK with
 * keys in env vars. Razorpay remains the right choice for domestic ₹
 * collection from Indian students.
 *
 * The amount is set server-side, here, and never accepted from the browser —
 * that is what makes the payment tamper-resistant. See the design spec at
 * docs/superpowers/specs/2026-08-22-student-accounts-and-payment-design.md.
 *
 * No `import "server-only"` guard: this is only ever reached from a
 * `"use server"` action file and a route handler (verified — grep for
 * `from "@/lib/razorpay"`), and the guard would block unit-testing
 * `verifyWebhookSignature` directly, the way orphaned-resumes.ts's pure
 * functions are tested elsewhere in this codebase.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";

let client: Razorpay | null = null;

function getClient(): Razorpay {
  if (client) return client;

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured — NEXT_PUBLIC_RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing.",
    );
  }

  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

/** Whether Razorpay has usable API keys. Callers use this to fail with a clear message instead of a stack trace. */
export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  );
}

export type CreatedOrder = {
  razorpayOrderId: string;
};

/**
 * Creates a Razorpay order for exactly `amountPaise`. This value becomes the
 * contract with the student — the webhook later verifies against what THIS
 * order was created for, not against whatever the fee config says at the
 * time the webhook arrives. See payment-flow-review.md, Defect 2.
 */
export async function createRazorpayOrder({
  amountPaise,
  receipt,
}: {
  amountPaise: number;
  /** Our own paymentOrders row id, stringified — lets Razorpay's dashboard cross-reference back to us. */
  receipt: string;
}): Promise<CreatedOrder> {
  const order = await getClient().orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt,
  });

  return { razorpayOrderId: order.id };
}

/**
 * Verifies a Razorpay webhook's HMAC-SHA256 signature against the raw request
 * body. MUST run on the raw bytes before any JSON parsing — Razorpay signs
 * the exact bytes it sent, and re-serializing a parsed body can produce a
 * byte-for-byte different string that fails verification even for a
 * genuine event.
 *
 * Uses a constant-time comparison — a naive `===` on the hex digests leaks
 * timing information an attacker could use to forge a valid signature one
 * byte at a time.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signatureHeader, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
