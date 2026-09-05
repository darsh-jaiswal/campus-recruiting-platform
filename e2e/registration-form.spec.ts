import { expect, test } from "@playwright/test";
import { signInAsStudent } from "./support/clerk";

/**
 * The registration form's static contract: required fields, labels, and the
 * submit-gate on resume upload.
 *
 * These sign in first. Registration is behind an account now, so an anonymous
 * visit never reaches the form at all — that redirect is covered separately in
 * `registration-auth.spec.ts`, and asserting it again here would only mean
 * these tests silently stopped inspecting the form.
 *
 * What this suite deliberately does NOT cover: actually submitting the form.
 * That needs Vercel Blob (for the resume upload) and a database (for the
 * insert) — see README § "Required before the app can persist anything".
 * Full submission belongs in a separate suite gated on those being
 * configured, not here.
 */

test.describe("registration form", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStudent(page);
    await page.goto("/register");
    // Guard the guard: if the session did not carry, every assertion below
    // would be evaluated against the sign-in page and fail for the wrong
    // reason.
    await expect(page).toHaveURL(/\/register$/);
  });

  test("required fields are marked required and labelled", async ({
    page,
  }) => {
    for (const label of [
      "Full name",
      "Mobile number",
      "CGPA",
      "Programme",
      "Branch",
      "Year",
    ]) {
      const field = page.getByLabel(label, { exact: false });
      await expect(field).toBeVisible();
      await expect(field).toHaveAttribute("required", "");
    }
  });

  test("the email comes from the account and cannot be typed", async ({
    page,
  }) => {
    // The whole point of gating registration is that the address is verified
    // rather than entered. An editable email input anywhere on this form —
    // even a hidden one — would hand that back to the browser, so assert the
    // absence as well as the display.
    await expect(page.getByText("From the account you signed in with")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toHaveCount(0);
  });

  test("focus area is a required radiogroup, not a free skip", async ({
    page,
  }) => {
    const group = page.getByRole("radiogroup", { name: "Focus area" });
    await expect(group).toBeVisible();

    const options = group.getByRole("radio");
    await expect(options).toHaveCount(4); // core_dev, aiml, robotics, other
    for (const option of await options.all()) {
      await expect(option).toHaveAttribute("required", "");
    }
  });

  test("continuing to review stays disabled until a resume is attached", async ({
    page,
  }) => {
    const submit = page.getByRole("button", { name: /continue to review/i });
    await expect(submit).toBeDisabled();

    // Filling every other field must not be enough on its own — the resume
    // gate is independent of the rest of the form's completeness.
    await page.getByLabel("Full name").fill("Test Candidate");
    await page.getByLabel("Mobile number").fill("9876543210");
    await expect(submit).toBeDisabled();
  });

  test("the consent checkbox states what it consents to, not a generic label", async ({
    page,
  }) => {
    await expect(
      page.getByText(/every access to it is logged/i),
    ).toBeVisible();
  });

  // Moved here from the public-site heading-structure sweep. Anonymously,
  // /register redirects, so that sweep was checking the sign-in page's
  // heading and reporting it as /register's.
  test("has no obvious accessibility violations in heading structure", async ({
    page,
  }) => {
    await expect(page.locator("h1")).toHaveCount(1);
  });

  // Regression for a real report: an invalid CGPA ("8;23") used to sail
  // through "Continue to review", and the server's rejection after
  // "Confirm & pay" rendered in ink — the student read the whole exchange
  // as the button doing nothing. Every problem must now be flagged inline,
  // in place, before the review screen is reachable. Client-side only:
  // nothing here touches the server action or the database.
  test("invalid and missing fields are flagged inline at Continue to review", async ({
    page,
  }) => {
    await page.getByLabel("Full name").fill("Gate Tester");
    await page.getByLabel("Mobile number").fill("12345");

    // Junk is untypeable in the CGPA box: digits, one dot, two digits a side.
    await page.getByLabel("CGPA").fill("3.33333");
    await expect(page.getByLabel("CGPA")).toHaveValue("3.33");
    // A trailing dot survives the keystroke filter (it's a legitimate
    // mid-typing state) but must still be flagged at Continue.
    await page.getByLabel("CGPA").fill("8.");
    await page.getByLabel("Programme").selectOption("B.Tech");
    await page.getByLabel("Branch").selectOption("CS");
    await page.getByLabel("Year").selectOption("3rd year");
    await page.locator('input[type="file"]').setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake resume content for e2e"),
    });
    await expect(page.getByText(/resume\.pdf uploaded/i)).toBeVisible({
      timeout: 15_000,
    });
    // Deliberately left broken: focus area unchosen, consent unchecked.

    await page.getByRole("button", { name: /continue to review/i }).click();

    await expect(
      page.getByText("Enter CGPA as a number, e.g. 7.85."),
    ).toBeVisible();
    await expect(
      page.getByText("Enter a valid 10-digit Indian mobile number."),
    ).toBeVisible();
    await expect(page.getByText("Select one focus area.")).toBeVisible();
    await expect(
      page.getByText("You must agree before we can process your application."),
    ).toBeVisible();
    // The click happened at the bottom of a long form — it must be answered
    // there too, not only up at the fields.
    await expect(page.getByText(/some fields need fixing/i)).toBeVisible();
    await expect(page.getByText(/review before you pay/i)).toHaveCount(0);

    // Fixing the fields lets the same click through to review.
    await page.getByLabel("Mobile number").fill("9876543210");
    await page.getByLabel("CGPA").fill("8.23");
    await page.getByRole("radio").first().check();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue to review/i }).click();
    await expect(page.getByText(/review before you pay/i)).toBeVisible();
  });

  // Regression for a real report: edits made without pressing Confirm & pay
  // were silently discarded on sign-out, and the form reverted to the last
  // SUBMITTED attempt. Unsubmitted edits now persist per-device in
  // localStorage; a reload exercises the identical restore path a
  // sign-out/sign-in does. Client-side only — no server writes.
  test("unsubmitted edits and the uploaded resume survive a reload", async ({
    page,
  }) => {
    await page.getByLabel("Full name").fill("Draft Survivor");
    await page.getByLabel("Mobile number").fill("9876543210");
    await page.getByLabel("CGPA").fill("9.01");
    await page.getByLabel("Programme").selectOption("B.Tech");
    await page.getByLabel("Branch").selectOption("CS");
    await page.getByLabel("Year").selectOption("3rd year");
    await page.getByLabel("Skills").fill("Rust, Solidity");
    await page.locator('input[type="file"]').setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake resume content for e2e"),
    });
    await expect(page.getByText(/resume\.pdf uploaded/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();

    await expect(page.getByText(/welcome back/i)).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("Draft Survivor");
    await expect(page.getByLabel("Mobile number")).toHaveValue("9876543210");
    await expect(page.getByLabel("CGPA")).toHaveValue("9.01");
    await expect(page.getByLabel("Programme")).toHaveValue("B.Tech");
    await expect(page.getByLabel("Branch")).toHaveValue("CS");
    await expect(page.getByLabel("Year")).toHaveValue("3rd year");
    await expect(page.getByLabel("Skills")).toHaveValue("Rust, Solidity");
    await expect(
      page.getByText(/resume\.pdf is already on file/i),
    ).toBeVisible();
  });
});
