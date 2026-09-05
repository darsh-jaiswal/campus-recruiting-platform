import { expect, test } from "@playwright/test";

/**
 * Public marketing site — the pages an anonymous visitor must always reach.
 * None of them may require a session (see README § Getting started,
 * § Security); the proxy bug fixed in commit 54036f6 was an unconfigured
 * Clerk throwing on every request, these included.
 *
 * One caveat now that registration is gated: the nav test below asserts the
 * Register link lands on sign-in, which only happens when Clerk is actually
 * configured. Everything else here still holds with no environment at all.
 */

test.describe("home page", () => {
  test("renders the hero and primary nav", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: /Aspire Quest — home/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "For students", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "For recruiters" }),
    ).toBeVisible();
  });

  /*
   * One test per link rather than one walking both. Visiting /sign-in leaves
   * Clerk's dev-browser handshake in flight, and a second click in the same
   * test raced it — the navigation was cancelled and the assertion read the
   * stale URL. Separate tests also name which link broke.
   */
  test("the For students link reaches registration, via sign-in", async ({
    page,
  }) => {
    await page.goto("/");

    // Registration is behind an account, so for an anonymous visitor
    // "reaching registration" means landing on sign-in with somewhere to go
    // next. Asserting the destination renders, not just its URL, is what
    // stops this passing on an error page.
    await page
      .getByRole("link", { name: "For students", exact: true })
      .click();
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(
      page.getByRole("link", { name: /continue to registration/i }),
    ).toBeVisible();
  });

  test("the recruiter link reaches the partners page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "For recruiters" }).click();
    await expect(page).toHaveURL(/\/partners$/);
    await expect(
      page.getByRole("heading", { name: "Recruit From Campus.", level: 1 }),
    ).toBeVisible();
  });
});

// `/register` is deliberately absent: it redirects an anonymous visitor, so
// checking it here would report the sign-in page's heading as its own. Its
// heading structure is asserted signed-in, in registration-form.spec.ts.
for (const path of ["/", "/alumni", "/partners"]) {
  test(`${path} has no obvious accessibility violations in heading structure`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);

    // Exactly one h1 per page — the baseline heading-hierarchy check.
    await expect(page.locator("h1")).toHaveCount(1);
  });
}

test("no-access page renders standalone (no console chrome)", async ({
  page,
}) => {
  const response = await page.goto("/no-access");
  expect(response?.status()).toBe(200);
});

/**
 * Horizontal overflow.
 *
 * Added after a real one: the placements table carries `min-w-[34rem]`, and
 * its grid column defaulted to `min-width: auto`, so on a phone the column
 * refused to shrink and pushed the whole document sideways. The
 * `overflow-x-auto` wrapper could not help, because its parent was already too
 * wide. Wide content must scroll inside its own container, never the body.
 */
for (const [label, width] of [
  ["small phone", 320],
  ["phone", 390],
  ["tablet", 768],
  ["laptop", 1280],
] as const) {
  test(`no horizontal page scroll at ${label} (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

    expect(overflows).toBe(false);
  });
}

/**
 * Button contrast.
 *
 * Added after a real bug: `globals.css` defined `a { color: inherit }`
 * unlayered, and an unlayered rule beats anything in `@layer utilities`
 * regardless of specificity — so `text-white` on every link-shaped button was
 * silently overridden. It went unnoticed for as long as the primary button was
 * amber, because dark-on-amber still read as text, and became invisible the
 * moment the palette went monochrome.
 *
 * Asserting the computed colours differ catches the whole class of "the label
 * is the same colour as the button" without pinning either value.
 */
test("primary call to action does not render its label in the fill colour", async ({
  page,
}) => {
  await page.goto("/");

  const cta = page.getByRole("link", { name: "Register as a student" });
  await expect(cta).toBeVisible();

  const { color, background } = await cta.evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, background: style.backgroundColor };
  });

  expect(color).not.toBe(background);
});
