import { expect, test } from "@playwright/test";
import { signInAsStudent, TEST_PREFILL_STUDENT_EMAIL } from "./support/clerk";
import { clerkUserIdFor, sqlClient } from "./support/seed";

/**
 * The read-back half of the abandoned-attempt flow: a student who saved
 * details (a `pending_payment` row) but never paid must find the form
 * prefilled — resume included — after signing back in, not blank. This was a
 * real report: a student re-signed in and concluded their application was
 * lost, when the row was sitting saved the whole time.
 *
 * Seeds the row directly in the database, which is why this suite uses its
 * own Clerk account (see TEST_PREFILL_STUDENT_EMAIL) — the other suites
 * assert a BLANK form for the shared account and run in parallel workers.
 * The seeded row is deleted afterwards; if a crash leaks it, it has no
 * payment order, so the daily sweep cron removes it within 24 hours anyway.
 */

const SAVED = {
  fullName: "Prefill Tester",
  phone: "9876501234",
  cgpa: "8.15",
  programme: "B.Tech",
  branch: "CS",
  year: "3rd year",
  focusArea: "aiml",
  skills: "{Python,PyTorch}",
  resumeBlobKey: "resumes/e2e-prefill-fixture.pdf",
  resumeFilename: "prefill-resume.pdf",
  resumeBytes: 12_345,
};

test.describe("registration prefill", () => {
  let clerkUserId: string;

  test.beforeAll(async () => {
    clerkUserId = await clerkUserIdFor(TEST_PREFILL_STUDENT_EMAIL);
    const sql = sqlClient();
    // Idempotent: a previous crashed run may have left the row behind.
    await sql`
      DELETE FROM students
      WHERE clerk_user_id = ${clerkUserId} OR email = ${TEST_PREFILL_STUDENT_EMAIL}
    `;
    await sql`
      INSERT INTO students (
        clerk_user_id, full_name, email, phone, branch, programme, year,
        cgpa, focus_area, skills, resume_blob_key, resume_filename,
        resume_bytes, consent_at
      ) VALUES (
        ${clerkUserId}, ${SAVED.fullName}, ${TEST_PREFILL_STUDENT_EMAIL},
        ${SAVED.phone}, ${SAVED.branch}, ${SAVED.programme}, ${SAVED.year},
        ${SAVED.cgpa}, ${SAVED.focusArea}, ${SAVED.skills}::text[],
        ${SAVED.resumeBlobKey}, ${SAVED.resumeFilename}, ${SAVED.resumeBytes},
        now()
      )
    `;
  });

  test.afterAll(async () => {
    await sqlClient()`
      DELETE FROM students WHERE clerk_user_id = ${clerkUserId}
    `;
  });

  test("a returning student's saved details and resume are restored", async ({
    page,
  }) => {
    await signInAsStudent(page, TEST_PREFILL_STUDENT_EMAIL);
    await page.goto("/register");
    await expect(page).toHaveURL(/\/register$/);

    await expect(page.getByText(/welcome back/i)).toBeVisible();

    await expect(page.getByLabel("Full name")).toHaveValue(SAVED.fullName);
    await expect(page.getByLabel("Mobile number")).toHaveValue(SAVED.phone);
    await expect(page.getByLabel("CGPA")).toHaveValue(SAVED.cgpa);
    await expect(page.getByLabel("Programme")).toHaveValue(SAVED.programme);
    await expect(page.getByLabel("Branch")).toHaveValue(SAVED.branch);
    await expect(page.getByLabel("Year")).toHaveValue(SAVED.year);
    await expect(
      page.locator('input[name="focusArea"][value="aiml"]'),
    ).toBeChecked();
    await expect(page.getByLabel("Skills")).toHaveValue("Python, PyTorch");
    await expect(page.getByRole("checkbox")).toBeChecked();

    // The stored resume is on file and resubmittable — no re-upload demanded.
    await expect(
      page.getByText(/prefill-resume\.pdf is already on file/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue to review/i }),
    ).toBeEnabled();
  });
});
