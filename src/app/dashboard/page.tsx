import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Section";
import {
  listApplicationsForStudent,
  type StudentApplication,
} from "@/db/queries/jobs";
import { listActiveResumes } from "@/db/queries/resumes";
import {
  getStudentAccountByClerkId,
  type StudentAccountRow,
} from "@/db/queries/students";
import { requireStudent } from "@/lib/auth";
import { FOCUS_AREAS } from "@/lib/content";
import { studentVisibleStatus } from "@/lib/student-status-display";
import { applicationWithdrawnAt } from "@/lib/withdrawal";
import { ResumeLibrary } from "./resumes/ResumeLibrary";
import { WithdrawRegistration } from "./WithdrawRegistration";

/**
 * The student's home: the durable version of the one-time success screen.
 * Every account state renders something useful — no row yet, a saved-but-
 * unpaid form, or a paid registration with its reference code — so the
 * header's "My application" link never needs to know payment state.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My application",
  description:
    "Your Aspire Quest registration: reference code, application status, and the openings you have applied to.",
};

const FOCUS_LABEL = Object.fromEntries(FOCUS_AREAS.map((a) => [a.code, a.name]));

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const STATUS_TONE_CLASS = {
  neutral: "border-hairline bg-raised text-slate",
  positive: "border-positive/30 bg-positive/5 text-navy",
  critical: "border-hairline-strong bg-amber-wash text-navy",
} as const;

export default async function DashboardPage() {
  await requireStudent();
  const user = await currentUser();
  const student = user ? await getStudentAccountByClerkId(user.id) : null;

  const [applications, resumes] =
    student && student.paymentStatus === "paid"
      ? await Promise.all([
          listApplicationsForStudent(student.id),
          listActiveResumes(student.id),
        ])
      : [[], []];

  return (
    // ClerkProvider keeps the 60s session JWT silently refreshed while the
    // page is open — same reason /register mounts it (see the note there).
    <ClerkProvider>
      <SiteHeader />

      <main id="main">
        <Container className="py-16 md:py-24">
          <div className="max-w-[68ch]">
            <Eyebrow>Students</Eyebrow>
            <h1 className="mt-5 text-h1 font-semibold">Your application.</h1>
          </div>

          <div className="mt-10 max-w-[76ch]">
            {!student ? (
              <EmptyState
                title="You haven't registered yet"
                body="One form and a PDF resume gets you a reference code and access to partner openings."
                cta="Start your registration"
              />
            ) : student.paymentStatus !== "paid" ? (
              <EmptyState
                title="Your registration isn't finished"
                body="Your details are saved, but a registration only counts once payment confirms. Pick up where you left off — the form restores everything you entered, including your resume."
                cta="Finish your registration"
              />
            ) : student.withdrawnAt ? (
              <WithdrawnDashboard student={student} />
            ) : (
              <PaidDashboard
                student={student}
                applications={applications}
                resumes={resumes.map((resume) => ({
                  id: resume.id,
                  filename: resume.filename,
                  bytes: resume.bytes,
                  isPrimary: resume.isPrimary,
                  createdAt: resume.createdAt.toISOString(),
                }))}
              />
            )}
          </div>
        </Container>
      </main>

      <SiteFooter />
    </ClerkProvider>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <div className="rounded border border-dashed border-hairline-strong px-8 py-14 text-center">
      <p className="text-h3 font-semibold text-navy">{title}</p>
      <p className="mx-auto mt-3 max-w-[52ch] text-slate">{body}</p>
      <div className="mt-8">
        <ButtonLink href="/register" variant="gradient" className="px-5 py-3">
          {cta}
        </ButtonLink>
      </div>
    </div>
  );
}

function WithdrawnDashboard({ student }: { student: StudentAccountRow }) {
  return (
    <div className="rounded border border-hairline bg-raised p-8 md:p-10">
      <p className="text-eyebrow font-semibold uppercase text-muted">
        Registration withdrawn
      </p>
      <p data-figure className="mt-4 inline-block rounded border border-hairline-strong bg-surface px-5 py-3 text-h3 font-semibold tracking-tight text-muted">
        {student.refCode}
      </p>
      <p className="mt-5 max-w-[52ch] text-slate">
        You withdrew your registration
        {student.withdrawnAt
          ? ` on ${DATE_FORMAT.format(student.withdrawnAt)}`
          : ""}
        . You are out of the screening pipeline, your opening applications
        show as withdrawn, and per the refund policy the fee is not returned.
      </p>
      <p className="mt-4 max-w-[52ch] text-sm text-muted">
        Changed your mind? Email the organising team quoting the reference
        code above — reinstatement is a manual step on their side.
      </p>
    </div>
  );
}

function PaidDashboard({
  student,
  applications,
  resumes,
}: {
  student: StudentAccountRow;
  applications: StudentApplication[];
  resumes: Array<{
    id: number;
    filename: string;
    bytes: number;
    isPrimary: boolean;
    createdAt: string;
  }>;
}) {
  const shown = studentVisibleStatus(student.status);

  const profile: Array<[string, string]> = [
    ["Name", student.fullName],
    ["Email", student.email],
    ["Phone", student.phone],
    ["Programme", `${student.programme} ${student.branch}, ${student.year}`],
    ["CGPA", student.cgpa],
    ["Focus area", FOCUS_LABEL[student.focusArea] ?? student.focusArea],
    ["Skills", student.skills.length ? student.skills.join(", ") : "—"],
    ["Resume", student.resumeFilename ?? "On file"],
  ];

  return (
    <>
      <section
        aria-labelledby="reference-code"
        className="rounded border border-hairline bg-raised p-8 md:p-10"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
          <div>
            <h2
              id="reference-code"
              className="text-eyebrow font-semibold uppercase text-muted"
            >
              Your reference code
            </h2>
            <p
              data-figure
              className="mt-4 inline-block rounded border-2 border-navy bg-surface px-6 py-4 text-h2 font-semibold tracking-tight text-navy"
            >
              {student.refCode}
            </p>
            <p className="mt-4 max-w-[46ch] text-sm text-muted">
              Quote this code in any email to the organising team — it is how
              your application is identified.
            </p>
          </div>

          <div className="max-w-[38ch]">
            <h2 className="text-eyebrow font-semibold uppercase text-muted">
              Status
            </h2>
            <p
              className={`mt-4 inline-block rounded border px-3 py-1.5 text-sm font-semibold ${STATUS_TONE_CLASS[shown.tone]}`}
            >
              {shown.label}
            </p>
            <p className="mt-3 text-sm text-muted">{shown.detail}</p>
            {student.paidAt ? (
              <p className="mt-3 text-sm text-muted">
                Registered {DATE_FORMAT.format(student.paidAt)} · fee paid
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="your-profile" className="mt-14">
        <h2
          id="your-profile"
          className="text-eyebrow font-semibold uppercase text-muted"
        >
          Profile on record
        </h2>
        <dl className="mt-4 border-t border-hairline-strong">
          {profile.map(([label, value]) => (
            <div
              key={label}
              className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-b border-hairline py-3"
            >
              <dt className="text-sm text-muted">{label}</dt>
              {/* An email or filename is one unbroken token — at 320px it
                  must break mid-token or it drags the page wide. */}
              <dd className="min-w-0 text-sm text-navy [overflow-wrap:anywhere]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted">
          Need a correction? Email the organising team quoting your reference
          code.
        </p>
      </section>

      <ResumeLibrary resumes={resumes} />

      <section aria-labelledby="dash-applications" className="mt-14">
        <h2
          id="dash-applications"
          className="flex items-baseline gap-3 text-eyebrow font-semibold uppercase text-muted"
        >
          Your applications
          <span data-figure className="font-normal normal-case">
            {applications.length}
          </span>
        </h2>

        {applications.length === 0 ? (
          <div className="mt-4 rounded border border-dashed border-hairline-strong px-6 py-12 text-center">
            <p className="font-semibold text-navy">No applications yet</p>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm text-muted">
              Applying to a partner opening takes one click — it uses this
              profile and resume.
            </p>
            <div className="mt-6">
              <ButtonLink href="/jobs" variant="gradient-soft" className="px-4 py-2.5">
                Browse openings
              </ButtonLink>
            </div>
          </div>
        ) : (
          <>
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
                    {applicationWithdrawnAt(application, student)
                      ? "Withdrawn"
                      : application.openingStatus === "closed"
                        ? "Closed"
                        : `Applied ${DATE_FORMAT.format(application.appliedAt)}`}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm">
              <Link
                href="/jobs"
                className="font-semibold text-slate underline-offset-4 hover:text-navy hover:underline"
              >
                Browse all openings
              </Link>
            </p>
          </>
        )}
      </section>

      <WithdrawRegistration />
    </>
  );
}
