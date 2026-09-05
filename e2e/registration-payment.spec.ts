import { expect, test } from "@playwright/test";
import { signInAsStudent } from "./support/clerk";

/**
 * The review-before-payment screen — the one place this suite goes further
 * than registration-form.spec.ts, which deliberately stops short of any
 * submission. Reaching "Continue to review" is entirely client-side (it
 * reads the already-filled form, no server round trip), so it is safe to
 * exercise here without a live Razorpay account: nothing is written to the
 * database and no order is created.
 *
 * What this suite deliberately does NOT cover: clicking "Confirm & pay".
 * That calls the real server action, which — with a fee configured — either
 * opens Razorpay Checkout (needs live keys this environment does not have)
 * or, without keys configured, returns a clear "temporarily unavailable"
 * error. Either way it is unsafe to automate here; see
 * docs/superpowers/specs/2026-08-22-student-accounts-and-payment-design.md.
 */

const FAKE_RESUME = {
  name: "resume.pdf",
  mimeType: "application/pdf",
  // Validation here is by declared MIME type and size only (see
  // src/app/api/resume/upload/route.ts) — the bytes never need to parse as
  // a real PDF for this test to exercise the actual upload endpoint.
  buffer: Buffer.from("%PDF-1.4 fake resume content for e2e"),
};

test.describe("registration review screen", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStudent(page);
    await page.goto("/register");
    await expect(page).toHaveURL(/\/register$/);
  });

  test("review shows every entered value and the fee, with no reference code yet", async ({
    page,
  }) => {
    await page.getByLabel("Full name").fill("Review Screen Candidate");
    await page.getByLabel("Mobile number").fill("9876543210");
    await page.getByLabel("CGPA").fill("8.42");
    await page.getByLabel("Programme").selectOption("B.Tech");
    await page.getByLabel("Branch").selectOption("CS");
    await page.getByLabel("Year").selectOption("3rd year");
    await page.getByRole("radio").first().check();
    await page.getByLabel("Skills").fill("TypeScript, React");

    // getByLabel("Resume") ambiguously matches the consent checkbox too (its
    // label text contains "resume"), so target the file input directly.
    await page.locator('input[type="file"]').setInputFiles(FAKE_RESUME);
    await expect(page.getByText(/resume\.pdf uploaded/i)).toBeVisible({
      timeout: 15_000,
    });

    const consent = page.getByRole("checkbox");
    await consent.check();

    const continueButton = page.getByRole("button", { name: /continue to review/i });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // The review screen itself.
    await expect(page.getByText("Review before you pay")).toBeVisible();
    await expect(page.getByText("Review Screen Candidate")).toBeVisible();
    await expect(page.getByText("8.42")).toBeVisible();

    // The fee, shown as a real figure — not "Free" — since REGISTRATION_FEE
    // is set. If this ever reads "Free" it means the fee config regressed.
    await expect(page.getByText("Registration fee")).toBeVisible();

    // The whole point: nothing resembling an AQ-XXXXXX reference code exists
    // anywhere on screen before payment is even attempted.
    await expect(page.getByText(/AQ-[A-Z0-9]{6}/)).toHaveCount(0);

    await expect(page.getByRole("button", { name: /confirm & pay/i })).toBeVisible();

    // Edit must return to the editable form with everything still filled in
    // — nothing typed is lost by visiting the review screen.
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Full name")).toHaveValue("Review Screen Candidate");
  });
});
