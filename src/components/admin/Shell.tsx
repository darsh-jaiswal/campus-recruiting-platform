import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Console chrome.
 *
 * Denser than the public site — this is a working tool, not a brochure — but
 * the same system: navy, hairlines, tabular figures, one amber accent.
 */

export function ConsoleShell({
  nav,
  user,
  label = "Console",
  children,
}: {
  nav: ReactNode;
  user: ReactNode;
  /** Chrome badge — "Console" for organisers, "Portal" for recruiters. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-40 border-b border-hairline bg-surface">
        <div className="flex h-14 items-center justify-between gap-6 px-5 md:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-baseline gap-2.5">
              <span className="text-[0.9375rem] font-semibold tracking-tight text-navy">
                Aspire&nbsp;Quest
              </span>
              <span className="rounded-sm border border-hairline-strong px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-muted">
                {label}
              </span>
            </Link>
          </div>
          {user}
        </div>
        <nav aria-label="Console sections" className="px-5 md:px-8">
          <ul className="-mb-px flex gap-6 overflow-x-auto">{nav}</ul>
        </nav>
      </header>

      <main className="flex-1 px-5 py-8 md:px-8 md:py-10">{children}</main>
    </div>
  );
}

export function PageHeading({
  title,
  count,
  description,
  actions,
}: {
  title: string;
  count?: number;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-baseline gap-3 text-h2 font-semibold">
          {title}
          {count !== undefined ? (
            <span data-figure className="text-h3 font-normal text-muted">
              {count.toLocaleString("en-IN")}
            </span>
          ) : null}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[68ch] text-sm text-slate">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Status pill. Colour is semantic — it encodes pipeline stage, not decoration. */
export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "active" | "positive" | "critical" | "muted";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-hairline-strong text-slate bg-surface",
    active: "border-amber/40 text-amber bg-amber-wash",
    positive: "border-positive/30 text-positive bg-positive/5",
    critical: "border-critical/30 text-critical bg-critical/5",
    muted: "border-hairline text-muted bg-raised",
  };
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded border border-dashed border-hairline-strong px-6 py-16 text-center">
      <p className="font-semibold text-navy">{title}</p>
      <p className="mx-auto mt-2 max-w-[46ch] text-sm text-muted">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** Dashboard figure. Rules, not cards. */
export function StatBlock({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note?: string;
}) {
  return (
    <div className="border-t-2 border-navy pt-4">
      <p data-figure className="text-h1 font-semibold leading-none text-navy">
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>
      <p className="mt-2.5 text-sm font-semibold text-slate">{label}</p>
      {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
    </div>
  );
}
