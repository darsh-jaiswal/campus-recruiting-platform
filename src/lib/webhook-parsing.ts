/**
 * Pure parsing of a Razorpay webhook body — no I/O, so it can be tested
 * exhaustively rather than reasoned about. Same approach access-policy.ts
 * and orphaned-resumes.ts take for their decision logic.
 */

export type RazorpayEventPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; amount?: number; order_id?: string } };
    order?: { entity?: { id?: string; amount?: number } };
  };
};

export type ParsedWebhookEvent = {
  /** Null when the body was not valid JSON. */
  payload: RazorpayEventPayload | null;
  eventType: string;
  /** Resolved from the order entity first, the payment entity's order_id otherwise. */
  razorpayOrderId: string | null;
  /** From the payment entity, falling back to the order entity's amount. */
  paidAmount: number | undefined;
  razorpayPaymentId: string | undefined;
};

export function parseRazorpayEvent(rawBody: string): ParsedWebhookEvent {
  let payload: RazorpayEventPayload | null;
  try {
    payload = JSON.parse(rawBody) as RazorpayEventPayload;
  } catch {
    payload = null;
  }

  return {
    payload,
    eventType: payload?.event ?? "unknown",
    razorpayOrderId:
      payload?.payload?.order?.entity?.id ??
      payload?.payload?.payment?.entity?.order_id ??
      null,
    paidAmount: payload?.payload?.payment?.entity?.amount ?? payload?.payload?.order?.entity?.amount,
    razorpayPaymentId: payload?.payload?.payment?.entity?.id,
  };
}
