import { reconcilePendingOrders } from "@/lib/payment-reconciliation";

/**
 * Daily reconciliation. Fallback for a Razorpay webhook that never arrived —
 * see the accepted risks in the design spec. Settles any order that has sat
 * non-terminal for over an hour by asking Razorpay directly.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await reconcilePendingOrders();
  return Response.json(result);
}
