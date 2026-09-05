import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Section";
import { requireStudent } from "@/lib/auth";
import { EDITION, REGISTRATION } from "@/lib/content";
import { RegistrationForm } from "./RegistrationForm";
import { savedDraftFrom, type SavedDraft } from "./saved-draft";

export const metadata: Metadata = {
  title: "Student registration",
  description:
    "Register for Aspire Quest. Sign in with Google or Microsoft, then submit one form with a PDF resume for a reference code on screen.",
};

/** Overrides the root layout's `light` for this dark-scoped page — see the
 * same note on the home page's viewport export. */
export const viewport: Viewport = {
  colorScheme: "dark",
};

const CHECKLIST = [
  "Your current CGPA",
  "Your branch and year of study",
  "The focus area you want to be considered for",
  `A resume as a PDF, under ${REGISTRATION.resumeMaxLabel}`,
];

export default async function RegisterPage() {
  await requireStudent();
  const user = await currentUser();

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const suggestedName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ");

  // A paid registration is done — this form has nothing left to offer it,
  // and the action refuses resubmission anyway. The dashboard is its home.
  // ONE query answers both questions this page has about the account's row:
  // a paid row means the dashboard is its home (the action refuses
  // resubmission anyway), and a pending_payment row is a saved-but-unpaid
  // attempt to restore into the form — resume included, whose stored blob
  // key is resubmittable as-is. Serial queries here were pure latency.
  let savedDraft: SavedDraft | null = null;
  if (user) {
    const [row] = await db
      .select({
        paymentStatus: students.paymentStatus,
        fullName: students.fullName,
        phone: students.phone,
        cgpa: students.cgpa,
        programme: students.programme,
        branch: students.branch,
        year: students.year,
        focusArea: students.focusArea,
        skills: students.skills,
        resumeBlobKey: students.resumeBlobKey,
        resumeFilename: students.resumeFilename,
        resumeBytes: students.resumeBytes,
      })
      .from(students)
      .where(eq(students.clerkUserId, user.id))
      .limit(1);

    if (row?.paymentStatus === "paid") redirect("/dashboard");
    savedDraft =
      row && row.paymentStatus === "pending_payment" ? savedDraftFrom(row) : null;
  }

  return (
    // Clerk's session cookie is a short-lived JWT (60s) that Clerk's client
    // SDK silently refreshes on a background timer — a refresh loop that
    // only runs where ClerkProvider is mounted. Every other authenticated
    // surface (admin, portal, sign-in, no-access) already mounts it for this
    // reason; this page is a fifth. Without it, a student who spends over a
    // minute filling the form — normal, given a resume upload — has their
    // session expire silently, and Submit fails with no way to recover
    // without losing everything typed. Confirmed live: decoding the session
    // JWT this branch's own sign-in issues shows exp - iat = 60s exactly.
    <ClerkProvider>
      {/* One of the three pages that opted into the dark "noir" scope by
          explicit request — see `.aq-noir` in globals.css. Every other
          authenticated page (dashboard, admin, portal, jobs) stays the
          original light default. */}
      <div className="aq-noir flex min-h-screen flex-col bg-surface text-slate">
        <SiteHeader dark />

        <main id="main">
          <Container className="grid gap-14 py-16 md:py-24 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <Eyebrow>Students</Eyebrow>
                <h1 className="mt-5 text-h1 font-semibold">Register.</h1>
                <p className="mt-5 text-lede text-slate">
                  One form. When you submit it you get a reference code on
                  screen — that code is your application.
                </p>

                <div className="mt-10">
                  <h2 className="text-eyebrow font-semibold uppercase text-muted">
                    Have ready
                  </h2>
                  <ul className="mt-4 border-t border-hairline">
                    {CHECKLIST.map((item) => (
                      <li
                        key={item}
                        className="border-b border-hairline py-3 text-sm text-slate"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {!EDITION.registrationOpen ? (
                  <p className="mt-8 rounded border border-hairline-strong bg-amber-wash px-4 py-3 text-sm text-slate">
                    <span className="font-semibold text-navy">
                      {EDITION.label} dates are not yet announced.
                    </span>{" "}
                    Applications submitted now are held and screened as soon
                    as partner onboarding closes.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="lg:col-span-8">
              <RegistrationForm
                email={email}
                suggestedName={suggestedName}
                savedDraft={savedDraft}
              />
            </div>
          </Container>
        </main>

        <SiteFooter />
      </div>
    </ClerkProvider>
  );
}
