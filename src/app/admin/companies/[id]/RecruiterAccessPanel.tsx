"use client";

import { useActionState } from "react";
import {
  grantRecruiterAccess,
  revokeRecruiterAccess,
  type ActionState,
} from "../actions";

/**
 * Grant and revoke portal access for this company's recruiters.
 *
 * The email list arrives resolved from the server (emails live in Clerk, not
 * our database); this component only renders it and hosts the two forms.
 */

const INITIAL: ActionState = { status: "idle" };

export type RecruiterRow = {
  membershipId: number;
  email: string;
  addedAt: string;
};

export function RecruiterAccessPanel({
  companyId,
  recruiters,
}: {
  companyId: number;
  recruiters: RecruiterRow[];
}) {
  const [grantState, grantAction, grantPending] = useActionState(
    grantRecruiterAccess,
    INITIAL,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeRecruiterAccess,
    INITIAL,
  );

  return (
    <section aria-labelledby="recruiter-access">
      <h2
        id="recruiter-access"
        className="text-eyebrow font-semibold uppercase text-muted"
      >
        Recruiter access
      </h2>
      <p className="mt-3 text-sm text-muted">
        Grant portal access by email. They sign in at /portal with Google or
        Microsoft using that address — no password, no signup.
      </p>

      {recruiters.length > 0 ? (
        <ul className="mt-4 border-t border-hairline-strong">
          {recruiters.map((recruiter) => (
            <li
              key={recruiter.membershipId}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline py-3"
            >
              <div>
                <p className="text-sm font-semibold text-navy">
                  {recruiter.email}
                </p>
                <p className="text-xs text-muted">added {recruiter.addedAt}</p>
              </div>
              <form action={revokeAction}>
                <input
                  type="hidden"
                  name="membershipId"
                  value={recruiter.membershipId}
                />
                <button
                  type="submit"
                  disabled={revokePending}
                  className="text-sm text-muted underline-offset-4 transition-colors hover:text-critical hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Nobody from this company can sign in yet.
        </p>
      )}

      {revokeState.status !== "idle" ? (
        <p
          role="status"
          className={`mt-2 text-sm ${revokeState.status === "error" ? "font-semibold text-critical" : "text-muted"}`}
        >
          {revokeState.message}
        </p>
      ) : null}

      <form action={grantAction} className="mt-5">
        <input type="hidden" name="companyId" value={companyId} />
        <label
          htmlFor="recruiter-email"
          className="block text-sm font-semibold text-navy"
        >
          Recruiter email
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="recruiter-email"
            name="email"
            type="email"
            required
            placeholder="hr@company.com"
            className="w-full rounded border border-hairline-strong bg-surface px-3.5 py-2.5 text-sm text-slate focus:border-navy focus:outline-none"
          />
          <button
            type="submit"
            disabled={grantPending}
            className="whitespace-nowrap rounded border border-navy bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {grantPending ? "Granting…" : "Grant access"}
          </button>
        </div>
        {grantState.status !== "idle" ? (
          <p
            role="status"
            className={`mt-2 text-sm ${grantState.status === "error" ? "font-semibold text-critical" : "text-slate"}`}
          >
            {grantState.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
