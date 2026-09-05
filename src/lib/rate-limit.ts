/**
 * Rate limiting for the three public forms.
 *
 * Registration launch is a burst by design; a spam flood looks identical from
 * the outside. Upstash gives us a sliding window that survives across Fluid
 * Compute instances, which an in-memory counter would not.
 *
 * FAIL CLOSED in production. If Redis is unreachable we reject rather than
 * wave traffic through — an open door on a PII intake form is worse than a
 * temporary outage. In development, with no Redis configured, limiting is
 * skipped so the forms stay workable offline.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const isConfigured = Boolean(url && token);
const isProduction = process.env.NODE_ENV === "production";

if (!isConfigured && isProduction) {
  console.error(
    "[rate-limit] Upstash is not configured in production. Public forms will reject.",
  );
}

const redis = isConfigured ? new Redis({ url: url!, token: token! }) : null;

function makeLimiter(tokens: number, window: `${number} ${"s" | "m" | "h"}`) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: "aspire-quest",
  });
}

/** Tuned per form: registration is the high-volume path, partner is not. */
const LIMITERS = {
  register: makeLimiter(5, "10 m"),
  partner: makeLimiter(3, "10 m"),
  upload: makeLimiter(8, "10 m"),
  /**
   * Second gate on resume uploads, keyed by the signed-in user rather than
   * the IP — a campus NAT shares one IP across a hall of students, so the IP
   * bucket alone would either throttle a registration rush or, loosened, let
   * one account hammer the store.
   */
  "upload-user": makeLimiter(8, "10 m"),
} as const;

export type LimiterKey = keyof typeof LIMITERS;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited" | "unavailable"; retryAfterMs?: number };

/**
 * @param key    which form is being submitted
 * @param ident  a stable caller identity — use the client IP
 */
export async function checkRateLimit(
  key: LimiterKey,
  ident: string,
): Promise<RateLimitResult> {
  const limiter = LIMITERS[key];

  if (!limiter) {
    // Not configured. Allowed in development only.
    return isProduction ? { ok: false, reason: "unavailable" } : { ok: true };
  }

  try {
    const result = await limiter.limit(`${key}:${ident}`);
    if (result.success) return { ok: true };
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterMs: Math.max(0, result.reset - Date.now()),
    };
  } catch (error) {
    console.error("[rate-limit] Upstash call failed:", error);
    return isProduction ? { ok: false, reason: "unavailable" } : { ok: true };
  }
}

/**
 * Best-effort client IP.
 *
 * On Vercel `x-forwarded-for` is set by the platform edge and the left-most
 * entry is the real client. Do not trust this header outside Vercel.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
