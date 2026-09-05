import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Section";
import {
  getPaidStudentByClerkId,
  listApplicationsForStudent,
  listLiveOpenings,
  type StudentApplication,
} from "@/db/queries/jobs";
import { OPENING_FOCUS_AREAS } from "@/lib/content";
import { applicationWithdrawnAt } from "@/lib/withdrawal";

/**
 * The jobs board. Browsing is public — the site-wide rule that only acting
 * requires an account. Signed-in registered students additionally see their
 * own applications at the top.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Openings",
  description:
    "Live internship openings from Aspire Quest partner companies. Apply with the profile and resume from your registration.",
};

const FOCUS_LABEL = Object.fromEntries(
  OPENING_FOCUS_AREAS.map((a) => [a.code, a.name]),
);

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Public pages must survive a deployment with no auth configured at all. */
const CLERK_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export default async function JobsPage() {
  // The public list does not depend on who is asking — fetch it alongside
  // the signed-in viewer's own data instead of before it (Neon HTTP pays
  // latency per query, so serial awaits add up).
  const viewerData = async () => {
    if (!CLERK_CONFIGURED) return null;
    const { userId } = await auth();
    if (!userId) return null;
    const student = await getPaidStudentByClerkId(userId);
    if (!student) return null;
    return {
      withdrawnAt: student.withdrawnAt,
      applications: await listApplicationsForStudent(student.id),
    };
  };

  const [openings, viewer] = await Promise.all([listLiveOpenings(), viewerData()]);
  const applications: StudentApplication[] = viewer?.applications ?? [];
  const registrationWithdrawnAt: Date | null = viewer?.withdrawnAt ?? null;

  return (
    <>
      <SiteHeader />

      <main id="main">
        <Container className="py-16 md:py-24">
          <div className="max-w-[68ch]">
            <Eyebrow>Students</Eyebrow>
            <h1 className="mt-5 text-h1 font-semibold">Openings.</h1>
            <p className="mt-5 text-lede text-slate">
              Roles posted by Aspire Quest partner companies. Applying takes
              one click — it uses the profile and resume from your
              registration, so there is no second form.
            </p>
          </div>

          {applications.length > 0 ? (
            <section aria-labelledby="your-applications" className="mt-14">
              <h2
                id="your-applications"
                className="text-eyebrow font-semibold uppercase text-muted"
              >
                Your applications
              </h2>
              <ul className="mt-4 border-t border-hairline-strong">
                {applications.map((application) => (
                  <li
                    key={application.openingId}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-hairline py-3.5"
                  >
                    <p className="text-sm">
                      <Link
                        href={`/jobs/${application.openingId}`}
                        className="font-semibold text-navy underline-offset-4 hover:underline"
                      >
                        {application.title}
                      </Link>{" "}
                      <span className="text-muted">
                        · {application.companyName}
                      </span>
                    </p>
                    <p className="text-sm text-muted">
                      {applicationWithdrawnAt(application, {
                        withdrawnAt: registrationWithdrawnAt,
                      })
                        ? "Withdrawn"
                        : application.openingStatus === "closed"
                          ? "Closed"
                          : `Applied ${DATE_FORMAT.format(application.appliedAt)}`}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="live-openings" className="mt-14">
            <h2
              id="live-openings"
              className="flex items-baseline gap-3 text-eyebrow font-semibold uppercase text-muted"
            >
              Live openings
              <span data-figure className="font-normal normal-case">
                {openings.length}
              </span>
            </h2>

            {openings.length === 0 ? (
              <div className="mt-4 rounded border border-dashed border-hairline-strong px-6 py-16 text-center">
                <p className="font-semibold text-navy">No openings yet</p>
                <p className="mx-auto mt-2 max-w-[46ch] text-sm text-muted">
                  Partner companies are still posting roles. Register now and
                  you can apply the moment the first opening goes live.
                </p>
              </div>
            ) : (
              <ul className="mt-4 border-t border-hairline-strong">
                {openings.map((opening) => (
                  <li key={opening.id} className="border-b border-hairline">
                    <Link
                      href={`/jobs/${opening.id}`}
                      className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5 transition-colors hover:bg-raised"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-navy underline-offset-4 group-hover:underline">
                          {opening.title}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {opening.companyName} ·{" "}
                          {FOCUS_LABEL[opening.focusArea] ?? opening.focusArea}
                          {opening.publishedAt
                            ? ` · posted ${DATE_FORMAT.format(opening.publishedAt)}`
                            : ""}
                        </p>
                      </div>
                      <p className="text-sm text-muted">
                        {opening.minCgpa ? (
                          <span data-figure>CGPA ≥ {opening.minCgpa}</span>
                        ) : (
                          "No CGPA floor"
                        )}
                        {opening.eligibleBranches.length > 0
                          ? ` · ${opening.eligibleBranches.join(", ")}`
                          : " · all branches"}
                        <span aria-hidden="true" className="ml-4 text-hairline-strong">
                          ›
                        </span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
