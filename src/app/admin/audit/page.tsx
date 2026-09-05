import { desc } from "drizzle-orm";
import { db } from "@/db";
import { EmptyState, PageHeading, Pill } from "@/components/admin/Shell";
import { auditLog } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Audit" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

const ACTION_LABEL: Record<string, string> = {
  view_student: "Viewed candidate data",
  view_resume: "Opened a resume",
  export_csv: "Exported CSV",
  view_bundle: "Viewed a bundle",
};

const ACTION_TONE: Record<
  string,
  "neutral" | "active" | "positive" | "critical" | "muted"
> = {
  view_student: "neutral",
  view_resume: "active",
  export_csv: "critical",
  view_bundle: "muted",
};

/**
 * The access trail.
 *
 * Deliberately read-only — there is no delete control anywhere in this
 * console. An audit log an administrator can edit is not an audit log.
 */
export default async function AuditPage() {
  await requireAdmin();

  const entries = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.occurredAt))
    .limit(PAGE_SIZE);

  return (
    <>
      <PageHeading
        title="Audit trail"
        count={entries.length}
        description="Every read of student personal data by an organiser or a partner recruiter. Under the DPDP Act, CGPA and phone number are personal data — this is the record that answers 'who saw my application?'"
      />

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          body="Entries appear as soon as anyone opens a candidate or a resume, or runs an export."
        />
      ) : (
        <div className="overflow-x-auto rounded border border-hairline">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Most recent {PAGE_SIZE} access events
            </caption>
            <thead>
              <tr className="border-b border-hairline-strong bg-raised">
                {["When", "Who", "Role", "Action", "Detail"].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-4 py-2.5 text-eyebrow font-semibold uppercase text-muted"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-hairline transition-colors last:border-0 hover:bg-raised"
                >
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <time
                      dateTime={entry.occurredAt.toISOString()}
                      className="tabular text-xs text-slate"
                    >
                      {entry.occurredAt.toLocaleString("en-IN")}
                    </time>
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="text-xs text-muted">{entry.actor}</code>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate">
                    {entry.actorRole}
                  </td>
                  <td className="px-4 py-2.5">
                    <Pill tone={ACTION_TONE[entry.action] ?? "neutral"}>
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </Pill>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {entry.detail ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entries.length === PAGE_SIZE ? (
        <p className="mt-4 text-sm text-muted">
          Showing the most recent {PAGE_SIZE} events.
        </p>
      ) : null}
    </>
  );
}
