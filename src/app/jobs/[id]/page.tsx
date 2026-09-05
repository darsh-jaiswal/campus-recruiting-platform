import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Section";
import {
  getApplication,
  getPaidStudentByClerkId,
  getPublicOpening,
} from "@/db/queries/jobs";
import { listActiveResumes } from "@/db/queries/resumes";
import { OPENING_FOCUS_AREAS } from "@/lib/content";
import { checkEligibility } from "@/lib/openings";
import { applicationWithdrawnAt, canReapply } from "@/lib/withdrawal";
import { ApplyForm, type ApplyResumeOption } from "./ApplyForm";
import { AppliedPanel, ReapplyPanel } from "./WithdrawControls";

/**
 * One opening, publicly readable. The apply area tells the viewer's truth:
 * sign in, register, ineligible-with-reason, applied, or the one-click form.
 * The Server Action re-derives all of it — this page only renders honestly.
 */

export const dynamic = "force-dynamic";

const FOCUS_LABEL = Object.fromEntries(
  OPENING_FOCUS_AREAS.map((a) => [a.code, a.name]),
);

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const CLERK_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const openingId = Number(id);
  if (!Number.isInteger(openingId) || openingId <= 0) return {};
  const opening = await getPublicOpening(openingId);
  return opening
    ? { title: `${opening.title} · ${opening.companyName}` }
    : {};
}

type Viewer =
  | { kind: "anonymous" }
  | { kind: "unregistered" }
  | { kind: "registration_withdrawn" }
  | { kind: "applied"; appliedAt: Date }
  | { kind: "withdrawn"; canReapply: boolean; resumes: ApplyResumeOption[] }
  | { kind: "ineligible"; reason: string }
  | { kind: "eligible"; resumes: ApplyResumeOption[] };

export default async function OpeningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const openingId = Number(id);
  if (!Number.isInteger(openingId) || openingId <= 0) notFound();

  const opening = await getPublicOpening(openingId);
  if (!opening) notFound();

  let viewer: Viewer = { kind: "anonymous" };
  if (CLERK_CONFIGURED) {
    const { userId } = await auth();
    if (userId) {
      const student = await getPaidStudentByClerkId(userId);
      if (!student) {
        viewer = { kind: "unregistered" };
      } else {
        // One round-trip instead of two: whichever branch below renders, it
        // needs at most the application row and the resume list — fetch both
        // together rather than serially (Neon HTTP pays per query).
        const [application, resumeRows] = await Promise.all([
          getApplication(opening.id, student.id),
          listActiveResumes(student.id),
        ]);
        // Primary-first ordering makes resumes[0] the picker default.
        const resumes = resumeRows.map((resume) => ({
          id: resume.id,
          filename: resume.filename,
          isPrimary: resume.isPrimary,
        }));
        const withdrawnAt = application
          ? applicationWithdrawnAt(application, student)
          : null;

        if (application && withdrawnAt) {
          const reapplyAllowed = canReapply(opening.status, application, student);
          viewer = {
            kind: "withdrawn",
            canReapply: reapplyAllowed,
            resumes: reapplyAllowed ? resumes : [],
          };
        } else if (application) {
          viewer = { kind: "applied", appliedAt: application.appliedAt };
        } else if (student.withdrawnAt) {
          viewer = { kind: "registration_withdrawn" };
        } else {
          const eligibility = checkEligibility(opening, student);
          viewer = eligibility.eligible
            ? { kind: "eligible", resumes }
            : { kind: "ineligible", reason: eligibility.reason };
        }
      }
    }
  }

  return (
    <>
      <SiteHeader />

      <main id="main">
        <Container className="grid gap-14 py-16 md:py-24 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <Link
              href="/jobs"
              className="mb-6 inline-block text-sm text-muted underline-offset-4 hover:text-navy hover:underline"
            >
              ← All openings
            </Link>

            <Eyebrow>{opening.companyName}</Eyebrow>
            <h1 className="mt-5 text-h1 font-semibold">{opening.title}</h1>
            <p className="mt-3 text-sm text-muted">
              {FOCUS_LABEL[opening.focusArea] ?? opening.focusArea}
              {opening.publishedAt
                ? ` · posted ${DATE_FORMAT.format(opening.publishedAt)}`
                : ""}
            </p>

            <div className="mt-8 max-w-[68ch] whitespace-pre-line text-slate">
              {opening.description}
            </div>

            {opening.hasJd ? (
              <p className="mt-6 text-sm text-muted">
                Full JD document:{" "}
                <a
                  href={`/api/openings/jd/download?openingId=${opening.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-navy underline-offset-4 hover:underline"
                >
                  view / download
                </a>
                {viewer.kind === "anonymous" ? " (sign in required)" : null}
              </p>
            ) : null}
          </div>

          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-10">
              <dl className="border-t border-hairline-strong">
                <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3.5">
                  <dt className="text-sm text-muted">Minimum CGPA</dt>
                  <dd data-figure className="text-sm font-semibold text-navy">
                    {opening.minCgpa ?? "None"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3.5">
                  <dt className="text-sm text-muted">Eligible branches</dt>
                  <dd className="text-sm font-semibold text-navy">
                    {opening.eligibleBranches.length > 0
                      ? opening.eligibleBranches.join(", ")
                      : "All branches"}
                  </dd>
                </div>
                {opening.skills.length > 0 ? (
                  <div className="border-b border-hairline py-3.5">
                    <dt className="text-sm text-muted">Skills</dt>
                    <dd className="mt-2 flex flex-wrap gap-1.5">
                      {opening.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-sm border border-hairline bg-raised px-2 py-0.5 text-xs text-slate"
                        >
                          {skill}
                        </span>
                      ))}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-8">
                {opening.status === "closed" ? (
                  <div className="rounded border border-hairline bg-raised px-4 py-3.5">
                    <p className="text-sm font-semibold text-navy">
                      Applications closed
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      This opening is no longer accepting applications.
                    </p>
                  </div>
                ) : viewer.kind === "anonymous" ? (
                  <>
                    <ButtonLink
                      href={`/sign-in?redirect_url=${encodeURIComponent(`/jobs/${opening.id}`)}`}
                    >
                      Sign in to apply
                    </ButtonLink>
                    <p className="mt-2 text-xs text-muted">
                      Sign in with Google or Microsoft; your application uses
                      the profile and resume from your registration.
                    </p>
                  </>
                ) : viewer.kind === "unregistered" ? (
                  <>
                    <ButtonLink href="/register">
                      Complete registration to apply
                    </ButtonLink>
                    <p className="mt-2 text-xs text-muted">
                      Applications use your registered profile and resume, so
                      registration comes first.
                    </p>
                  </>
                ) : viewer.kind === "registration_withdrawn" ? (
                  <div className="rounded border border-hairline bg-raised px-4 py-3.5">
                    <p className="text-sm font-semibold text-navy">
                      Registration withdrawn
                    </p>
                    <p className="mt-1 text-sm text-slate">
                      New applications are closed to a withdrawn registration.
                      Contact the organising team to reinstate it.
                    </p>
                  </div>
                ) : viewer.kind === "applied" ? (
                  <AppliedPanel
                    openingId={opening.id}
                    appliedOn={DATE_FORMAT.format(viewer.appliedAt)}
                  />
                ) : viewer.kind === "withdrawn" ? (
                  <ReapplyPanel
                    openingId={opening.id}
                    canReapply={viewer.canReapply}
                    resumes={viewer.resumes}
                  />
                ) : viewer.kind === "ineligible" ? (
                  <div className="rounded border border-hairline bg-raised px-4 py-3.5">
                    <p className="text-sm font-semibold text-navy">
                      Not eligible for this opening
                    </p>
                    <p className="mt-1 text-sm text-slate">{viewer.reason}</p>
                  </div>
                ) : (
                  <ApplyForm openingId={opening.id} resumes={viewer.resumes} />
                )}
              </div>
            </div>
          </aside>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
