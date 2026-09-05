import { describe, expect, test } from "vitest";
import { parseRazorpayEvent } from "./webhook-parsing";

const orderPaidBody = JSON.stringify({
  event: "order.paid",
  payload: {
    payment: {
      entity: { id: "pay_abc123", amount: 10000, order_id: "order_xyz789" },
    },
    order: {
      entity: { id: "order_xyz789", amount: 10000 },
    },
  },
});

describe("parseRazorpayEvent", () => {
  test("parses a well-formed order.paid event", () => {
    const result = parseRazorpayEvent(orderPaidBody);
    expect(result.eventType).toBe("order.paid");
    expect(result.razorpayOrderId).toBe("order_xyz789");
    expect(result.paidAmount).toBe(10000);
    expect(result.razorpayPaymentId).toBe("pay_abc123");
    expect(result.payload).not.toBeNull();
  });

  test("an unparseable body yields a null payload and 'unknown' event type", () => {
    const result = parseRazorpayEvent("{not json");
    expect(result.payload).toBeNull();
    expect(result.eventType).toBe("unknown");
    expect(result.razorpayOrderId).toBeNull();
    expect(result.paidAmount).toBeUndefined();
  });

  test("an unknown event type still parses whatever order id is present", () => {
    const body = JSON.stringify({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
    });
    const result = parseRazorpayEvent(body);
    expect(result.eventType).toBe("payment.failed");
    expect(result.razorpayOrderId).toBe("order_1");
  });

  test("an event with no event field at all is 'unknown'", () => {
    const result = parseRazorpayEvent(JSON.stringify({ payload: {} }));
    expect(result.eventType).toBe("unknown");
  });

  test("falls back to the order entity's id when the payment entity is absent", () => {
    const body = JSON.stringify({
      event: "order.paid",
      payload: { order: { entity: { id: "order_only", amount: 500 } } },
    });
    const result = parseRazorpayEvent(body);
    expect(result.razorpayOrderId).toBe("order_only");
    expect(result.paidAmount).toBe(500);
    expect(result.razorpayPaymentId).toBeUndefined();
  });

  test("a completely empty JSON object parses to all-empty fields, not a throw", () => {
    const result = parseRazorpayEvent("{}");
    expect(result.eventType).toBe("unknown");
    expect(result.razorpayOrderId).toBeNull();
    expect(result.paidAmount).toBeUndefined();
  });

  test("a JSON array (valid JSON, wrong shape) does not throw", () => {
    const result = parseRazorpayEvent("[]");
    expect(result.payload).toEqual([]);
    expect(result.eventType).toBe("unknown");
    expect(result.razorpayOrderId).toBeNull();
  });
});
