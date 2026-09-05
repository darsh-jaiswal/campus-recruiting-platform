import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, Pill } from "@/components/admin/Shell";
import { getPaidOrderForStudent } from "@/db/queries/payments";
import { getStudent } from "@/db/queries/students";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { BRANCHES, FOCUS_AREAS } from "@/lib/content";

export const dynamic = "force-dynamic";

const FOCUS_LABEL = Object.fromEntries(FOCUS_AREAS.map((a) => [a.code, a.name]));
const BRANCH_LABEL = Object.fromEntries(BRANCHES.map((b) => [b.code, b.name]));

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;

  const studentId = Number(id);
  if (!Number.isInteger(studentId) || studentId <= 0) notFound();

  const student = await getStudent(studentId);
  if (!student) notFound();

  const paidOrder =
    student.paymentStatus === "paid" ? await getPaidOrderForStudent(studentId) : null;

  // A single-candidate read, including phone — audited individually.
  await recordAudit({
    actor,
    action: "view_student",
    studentId,
    detail: `Detail view · ${student.refCode}`,
  });

  const fields: [string, string | null][] = [
    ["Reference", student.refCode],
    ["Email", student.email],
    ["Phone", student.phone],
    ["Programme", student.programme],
    ["Branch", BRANCH_LABEL[student.branch] ?? student.branch],
    ["Year", student.year],
    ["CGPA", student.cgpa],
    ["Focus area", FOCUS_LABEL[student.focusArea] ?? student.focusArea],
    ["Registered", student.createdAt.toLocaleString("en-IN")],
    ["Consent given", student.consentAt.toLocaleString("en-IN")],
  ];

  return (
    <>
      <Link
        href="/admin/students"
        className="mb-6 inline-block text-sm text-muted underline-offset-4 hover:text-navy hover:underline"
      >
        ← Back to screening
      </Link>

      <PageHeading
        title={student.fullName}
        actions={
          student.resumeBlobKey ? (
            <a
              href={`/api/resume/download?studentId=${student.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-navy bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-hover"
            >
              Open resume
            </a>
          ) : (
            <Pill tone="critical">No resume on file</Pill>
          )
        }
      />

      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <h2 className="text-eyebrow font-semibold uppercase text-muted">
            Application
          </h2>
          <dl className="mt-4 border-t border-hairline-strong">
            {fields.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[10rem_1fr] gap-4 border-b border-hairline py-3"
              >
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="text-sm font-semibold tabular text-navy">
                  {value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:col-span-5">
          <h2 className="text-eyebrow font-semibold uppercase text-muted">
            Status
          </h2>
          <div className="mt-4">
            <Pill tone="active">{student.status}</Pill>
          </div>

          <h2 className="mt-10 text-eyebrow font-semibold uppercase text-muted">
            Payment
          </h2>
          <div className="mt-4">
            <Pill tone={student.paymentStatus === "paid" ? "positive" : "critical"}>
              {student.paymentStatus === "pending_payment"
                ? "Unpaid"
                : student.paymentStatus}
            </Pill>
          </div>
          {paidOrder ? (
            <dl className="mt-4 border-t border-hairline-strong">
              <div className="grid grid-cols-[10rem_1fr] gap-4 border-b border-hairline py-3">
                <dt className="text-sm text-muted">Amount paid</dt>
                <dd className="text-sm font-semibold tabular text-navy">
                  ₹{(paidOrder.amountPaise / 100).toFixed(2)}
                </dd>
              </div>
              <div className="grid grid-cols-[10rem_1fr] gap-4 border-b border-hairline py-3">
                <dt className="text-sm text-muted">Paid at</dt>
                <dd className="text-sm font-semibold tabular text-navy">
                  {student.paidAt?.toLocaleString("en-IN") ?? "—"}
                </dd>
              </div>
            </dl>
          ) : null}

          <h2 className="mt-10 text-eyebrow font-semibold uppercase text-muted">
            Skills
          </h2>
          {student.skills.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {student.skills.map((skill) => (
                <li
                  key={skill}
                  className="rounded border border-hairline px-2.5 py-1 text-xs text-slate"
                >
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">None listed.</p>
          )}

          <p className="mt-10 rounded border border-hairline bg-raised px-4 py-3 text-xs leading-relaxed text-muted">
            Opening this page recorded an audit entry against your account.
            Resume reads are logged separately.
          </p>
        </div>
      </div>
    </>
  );
}
