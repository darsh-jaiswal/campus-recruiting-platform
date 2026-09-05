import { expect, test } from "@playwright/test";

/**
 * Registration requires an account; browsing never does. The second half
 * matters as much as the first — forcing sign-in on a marketing page would
 * cost real applicants.
 */
test("an anonymous visitor is sent to sign-in from registration", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("an anonymous visitor can still browse the public site", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: /Aspire Quest — home/i }),
  ).toBeVisible();

  await page.goto("/partners");
  await expect(page).toHaveURL(/\/partners$/);
  await expect(
    page.getByRole("heading", { name: "Recruit From Campus.", level: 1 }),
  ).toBeVisible();

  await page.goto("/alumni");
  await expect(page).toHaveURL(/\/alumni$/);
  await expect(
    page.getByRole("heading", { name: "Open a door at your company.", level: 1 }),
  ).toBeVisible();
});
