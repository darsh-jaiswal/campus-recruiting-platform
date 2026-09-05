import { clerkClient } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, Pill } from "@/components/admin/Shell";
import {
  getCompany,
  getProblemStatements,
  listRecruiterMemberships,
} from "@/db/queries/companies";
import { requireAdmin } from "@/lib/auth";
import { FOCUS_AREAS } from "@/lib/content";
import { COMPANY_SOURCE_LABEL, COMPANY_STATUS_LABEL } from "@/lib/pipeline";
import { RecruiterAccessPanel, type RecruiterRow } from "./RecruiterAccessPanel";

export const dynamic = "force-dynamic";

const FOCUS_LABEL = Object.fromEntries(FOCUS_AREAS.map((a) => [a.code, a.name]));

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const company = await getCompany(companyId);
  if (!company) notFound();

  const [problems, memberships] = await Promise.all([
    getProblemStatements(companyId),
    listRecruiterMemberships(companyId),
  ]);

  // Emails live in Clerk, not our database — resolve each membership's user.
  // A lookup that fails (deleted account) still renders, labelled as such.
  const clerk = await clerkClient();
  const recruiters: RecruiterRow[] = await Promise.all(
    memberships.map(async (membership) => {
      let email = "account not found";
      try {
        const user = await clerk.users.getUser(membership.userId);
        email =
          user.primaryEmailAddress?.emailAddress ??
          user.emailAddresses[0]?.emailAddress ??
          "no email on account";
      } catch {
        // keep the fallback label
      }
      return {
        membershipId: membership.id,
        email,
        addedAt: membership.createdAt.toLocaleDateString("en-IN"),
      };
    }),
  );

  const details: [string, string | null][] = [
    ["Status", COMPANY_STATUS_LABEL[company.status]],
    ["Source", COMPANY_SOURCE_LABEL[company.source] ?? company.source],
    ["Website", company.website],
    ["Contact", company.contactName],
    ["Email", company.contactEmail],
    ["Phone", company.contactPhone],
    [
      "Stipend",
      company.stipendMin
        ? `₹${company.stipendMin.toLocaleString("en-IN")}/mo`
        : null,
    ],
    ["PPO track", company.ppoTrack ? "Yes" : "No"],
  ];

  return (
    <>
      <Link
        href="/admin/companies"
        className="mb-6 inline-block text-sm text-muted underline-offset-4 hover:text-navy hover:underline"
      >
        ← Back to pipeline
      </Link>

      <PageHeading
        title={company.name}
        actions={<Pill tone="active">{COMPANY_STATUS_LABEL[company.status]}</Pill>}
      />

      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <h2 className="text-eyebrow font-semibold uppercase text-muted">
            Details
          </h2>
          <dl className="mt-4 border-t border-hairline-strong">
            {details.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[9rem_1fr] gap-4 border-b border-hairline py-3"
              >
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="text-sm font-semibold tabular text-navy">
                  {value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-12 text-eyebrow font-semibold uppercase text-muted">
            Problem statements
          </h2>
          {problems.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {problems.map((problem) => (
                <li
                  key={problem.id}
                  className="rounded border border-hairline p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-semibold text-navy">{problem.title}</h3>
                    <Pill tone="neutral">
                      {FOCUS_LABEL[problem.focusArea] ?? problem.focusArea}
                    </Pill>
                  </div>
                  <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-slate">
                    {problem.description}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">
              None submitted. Interviews need one before onboarding closes.
            </p>
          )}

        </div>

        <div className="lg:col-span-5">
          <RecruiterAccessPanel companyId={companyId} recruiters={recruiters} />
        </div>
      </div>
    </>
  );
}
