"use client";

import { useActionState } from "react";
import { Pill } from "@/components/admin/Shell";
import { toggleValue, type Interest } from "@/lib/interest";
import { BAND_LABELS, scoreBand } from "@/lib/openings";
import { setApplicantInterest, type OpeningActionState } from "../actions";

/**
 * One applicant: rank, profile, AI assessment, and the recruiter's two
 * affordances — the same tri-state interest mark as candidate sets, and the
 * audited resume read.
 */

const INITIAL: OpeningActionState = { status: "idle" };

type Props = {
  openingId: number;
  studentId: number;
  rank: number;
  refCode: string | null;
  fullName: string;
  branch: string;
  programme: string;
  year: string;
  cgpa: string;
  skills: readonly string[];
  hasResume: boolean;
  interested: Interest;
  score: number | null;
  scoreRationale: string | null;
  /** True when the stored score predates the current prompt text. */
  scoreStale: boolean;
  /** Set when the candidate withdrew — this application or their whole
   *  registration. The row stays, greyed: a withdrawal is information. */
  withdrawnAt: Date | null;
};

export function ApplicantRow({
  openingId,
  studentId,
  rank,
  refCode,
  fullName,
  branch,
  programme,
  year,
  cgpa,
  skills,
  hasResume,
  interested,
  score,
  scoreRationale,
  scoreStale,
  withdrawnAt,
}: Props) {
  const [, interestAction, interestPending] = useActionState(
    setApplicantInterest,
    INITIAL,
  );

  const band = score !== null ? scoreBand(score) : null;

  return (
    <li
      className={`flex gap-5 border-b border-hairline py-5${withdrawnAt ? " opacity-55" : ""}`}
    >
      <p
        aria-label="Rank"
        data-figure
        className="w-7 flex-shrink-0 pt-0.5 text-sm font-semibold text-muted"
      >
        {rank}
      </p>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-semibold text-navy">{fullName}</h2>
          {refCode ? (
            <span data-figure className="text-xs text-muted">
              {refCode}
            </span>
          ) : null}
          {withdrawnAt ? <Pill tone="muted">Withdrawn</Pill> : null}
          {interested === true ? <Pill tone="positive">Interested</Pill> : null}
          {interested === false ? <Pill tone="muted">Passed</Pill> : null}
        </div>

        <p className="mt-1.5 text-sm text-slate">
          {branch} · {programme} · {year} ·{" "}
          <span data-figure className="font-semibold text-navy">
            {cgpa}
          </span>{" "}
          CGPA
        </p>

        {skills.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <li
                key={skill}
                className="rounded-sm border border-hairline bg-raised px-2 py-0.5 text-xs text-slate"
              >
                {skill}
              </li>
            ))}
          </ul>
        ) : null}

        {scoreRationale ? (
          <div className="mt-3 max-w-[70ch]">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-muted">
              AI assessment{scoreStale ? " · stale — re-run scoring" : ""}
            </p>
            <p className="mt-1 text-sm text-slate">{scoreRationale}</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-2.5">
        <div className="flex items-center gap-3">
          {score !== null ? (
            <p className="text-sm text-muted">
              <span
                data-figure
                className="text-h3 font-semibold tracking-tight text-navy"
              >
                {score}
              </span>
              /100
            </p>
          ) : (
            <p className="text-sm text-muted">Not scored</p>
          )}
          {band === "strong" ? (
            <span className="rounded-sm bg-navy px-2 py-0.5 text-xs font-semibold text-white">
              {BAND_LABELS.strong}
            </span>
          ) : band === "possible" ? (
            <Pill tone="neutral">{BAND_LABELS.possible}</Pill>
          ) : band === "weak" ? (
            <Pill tone="muted">{BAND_LABELS.weak}</Pill>
          ) : null}
        </div>

        {hasResume ? (
          <a
            href={`/api/resume/download?studentId=${studentId}&openingId=${openingId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-hairline-strong px-3 py-1.5 text-sm font-semibold text-navy transition-colors hover:border-navy"
          >
            Resume
          </a>
        ) : null}

        <form action={interestAction} className="flex gap-1.5">
          <input type="hidden" name="openingId" value={openingId} />
          <input type="hidden" name="studentId" value={studentId} />
          <button
            type="submit"
            name="interested"
            value={toggleValue(interested, true)}
            disabled={interestPending}
            aria-pressed={interested === true}
            className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              interested === true
                ? "border-navy bg-navy text-white"
                : "border-hairline-strong bg-transparent text-navy hover:border-navy"
            }`}
          >
            Interested
          </button>
          <button
            type="submit"
            name="interested"
            value={toggleValue(interested, false)}
            disabled={interestPending}
            aria-pressed={interested === false}
            className={`rounded border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              interested === false
                ? "border-hairline-strong bg-raised font-semibold text-slate"
                : "border-hairline-strong bg-transparent text-muted hover:border-navy hover:text-navy"
            }`}
          >
            Pass
          </button>
        </form>
      </div>
    </li>
  );
}
