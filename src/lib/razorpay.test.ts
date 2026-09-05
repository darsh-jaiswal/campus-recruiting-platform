import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { verifyWebhookSignature } from "./razorpay";

const SECRET = "test-webhook-secret";
const BODY = JSON.stringify({ event: "order.paid", payload: {} });

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  test("accepts a correctly signed body", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    expect(verifyWebhookSignature(BODY, sign(BODY, SECRET))).toBe(true);
  });

  test("rejects a signature computed with the wrong secret", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    expect(verifyWebhookSignature(BODY, sign(BODY, "wrong-secret"))).toBe(false);
  });

  test("rejects a signature that doesn't match a tampered body", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    const signatureForOriginal = sign(BODY, SECRET);
    const tamperedBody = BODY.replace("order.paid", "order.tampered");
    expect(verifyWebhookSignature(tamperedBody, signatureForOriginal)).toBe(false);
  });

  test("rejects a missing signature header", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    expect(verifyWebhookSignature(BODY, null)).toBe(false);
  });

  test("rejects when the webhook secret is not configured at all", () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(verifyWebhookSignature(BODY, sign(BODY, SECRET))).toBe(false);
  });

  test("rejects garbage that happens to be shorter than a real signature", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    expect(verifyWebhookSignature(BODY, "short")).toBe(false);
  });
});
