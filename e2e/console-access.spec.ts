import { expect, test } from "@playwright/test";

/**
 * /admin and /portal, unauthenticated.
 *
 * README, § Console access: without Clerk keys these return 500 rather than
 * rendering ("not a bug"); WITH Clerk keys they redirect to sign-in instead.
 * Either way, the one outcome that must never happen is the console
 * content itself rendering to a signed-out visitor — so that is what these
 * tests assert, rather than a specific status code that depends on which
 * environment CI happens to run against.
 *
 * `page.goto` follows redirects, so `response.status()` reflects wherever the
 * browser ends up — the sign-in page (200) when Clerk is configured, or the
 * failed route itself (500) when it is not. Checking the final content and
 * URL, not the status code, is what stays correct across both states.
 */

for (const path of ["/admin", "/portal"]) {
  test(`${path} never renders console content to a signed-out visitor`, async ({
    page,
  }) => {
    const response = await page.goto(path);

    await expect(
      page.getByRole("heading", { name: /overview|job openings/i }),
    ).toHaveCount(0);

    // If it rendered at all (200), it must be the sign-in page, not the
    // protected route responding as if the visitor were authenticated.
    if (response?.status() === 200) {
      expect(page.url()).toContain("/sign-in");
    }
  });
}

test("resume download requires auth even for a well-formed request", async ({
  request,
}) => {
  const response = await request.get("/api/resume/download?studentId=1", {
    maxRedirects: 0,
  });

  // Either redirected to sign-in (3xx) or hard-failed (5xx with no env) —
  // never a 200 serving bytes.
  expect(response.status()).not.toBe(200);
});
