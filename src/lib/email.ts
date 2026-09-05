/**
 * Resend client.
 *
 * FAILS SOFT, unlike rate-limit.ts. A registration that saved to the
 * database must never be lost or rejected because an email provider hiccup —
 * the confirmation is a courtesy, the database row is the real record. Every
 * call site here logs and swallows; callers must not let this block or fail
 * their transaction.
 */

import { Resend } from "resend";
import type { ReactElement } from "react";

const apiKey = process.env.RESEND_API_KEY;
const domain = process.env.RESEND_EMAIL_DOMAIN;

const resend = apiKey ? new Resend(apiKey) : null;

export const EMAIL_FROM = domain
  ? `Aspire Quest <noreply@${domain}>`
  : "Aspire Quest <onboarding@resend.dev>";

type SendArgs = {
  to: string;
  subject: string;
  react: ReactElement;
  /** Stable per-event id — prevents duplicate sends on cron/action retry. */
  idempotencyKey: string;
};

/**
 * Best-effort send. Returns whether it went out; never throws.
 */
export async function sendEmail({
  to,
  subject,
  react,
  idempotencyKey,
}: SendArgs): Promise<boolean> {
  if (!resend) {
    console.error("[email] RESEND_API_KEY not configured — skipping send.");
    return false;
  }

  const { error } = await resend.emails.send(
    { from: EMAIL_FROM, to, subject, react },
    { idempotencyKey },
  );

  if (error) {
    console.error("[email] send failed:", error);
    return false;
  }

  return true;
}
