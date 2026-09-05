import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentOrders } from "@/db/schema";

/** The order that actually paid, if any — for the admin detail page's "amount paid" line. */
export async function getPaidOrderForStudent(studentId: number) {
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.studentId, studentId))
    .orderBy(desc(paymentOrders.updatedAt))
    .limit(1);

  return order?.status === "paid" ? order : null;
}
