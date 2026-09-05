import type { NextConfig } from "next";

/**
 * Clerk's Frontend API host, decoded from the publishable key rather than
 * hardcoded — a publishable key is `pk_{test,live}_base64("<fapi-host>$")`.
 * Deriving it here means a future switch to a custom Clerk domain (or a
 * live-mode key) updates the CSP automatically instead of silently breaking
 * sign-in again the way the hardcoded-`'self'`-only policy did.
 */
function clerkFapiHost(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const encoded = key?.match(/^pk_(test|live)_(.+)$/)?.[2];
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  } catch {
    return null;
  }
}

/**
 * Security headers.
 *
 * NOTE ON CSP — a decision worth knowing about:
 * The plan calls for a nonce-based CSP. A per-request nonce requires
 * middleware to inject it into the HTML, which forces every page to render
 * dynamically. That directly conflicts with keeping the public marketing pages
 * static and CDN-served at zero compute, which is what keeps this inside the
 * free tier during a registration surge.
 *
 * The CSP below is the strict-as-possible *static-compatible* version:
 * everything is locked to 'self' with no external origins permitted, except
 * the specific third-party origins Clerk's hosted sign-in widget requires
 * (documented at https://clerk.com/docs/security/clerk-csp) — without these,
 * Clerk's JS fails to load and every sign-in page is permanently blank.
 * `script-src` must also allow 'unsafe-inline' because Next's hydration
 * bootstrap is an inline script and there is no nonce to whitelist it with.
 *
 * To upgrade to a true nonce CSP, add middleware that generates a nonce per
 * request and accept that pages become dynamic. See README § Security.
 */
function buildCsp(): string {
  const fapiHost = clerkFapiHost();
  const clerkScript = fapiHost ? ` https://${fapiHost}` : "";
  const clerkConnect = fapiHost ? ` https://${fapiHost}` : "";
  // React's dev overlay reconstructs callstacks with eval(); production React
  // never calls it, so the directive exists only in development builds.
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    // Razorpay Checkout is a script-injected overlay, not an npm bundle —
    // checkout.razorpay.com is where checkout.js itself loads from.
    `script-src 'self' 'unsafe-inline'${devEval}${clerkScript} https://challenges.cloudflare.com https://*.protect.clerk.com https://checkout.razorpay.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com https://*.razorpay.com",
    "font-src 'self' data:",
    // Resume uploads are proxied through /api/resume/upload (browser → this
    // origin → Blob), so Clerk's is otherwise the only external connect-src
    // needed — plus Razorpay's API, which checkout.js calls directly from
    // the browser once the popup opens.
    `connect-src 'self'${clerkConnect} https://*.protect.clerk.com https://api.razorpay.com https://lumberjack.razorpay.com`,
    "worker-src 'self' blob:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // The checkout popup itself is an iframe Razorpay's script injects.
    "frame-src https://challenges.cloudflare.com https://*.protect.clerk.com https://api.razorpay.com https://checkout.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const CSP = buildCsp();

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    /**
     * Client router cache for dynamic pages (default 0 since Next 15):
     * revisiting a console tab within 30s renders instantly from the cached
     * segment instead of holding a skeleton through a full server round
     * trip. The console's own mutations stay immediate — Server Actions
     * purge this cache via the revalidatePath they already call. The cost
     * is that changes made by OTHERS can read up to 30s stale.
     */
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
