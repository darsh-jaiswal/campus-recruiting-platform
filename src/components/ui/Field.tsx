import type { ReactNode } from "react";

/**
 * Form primitives.
 *
 * Errors are wired with `aria-describedby` + `aria-invalid` and announced via
 * a live region, because a student on a phone with a screen reader is a real
 * user of this form, not a hypothetical one.
 */

const CONTROL =
  "w-full rounded border border-hairline-strong bg-surface px-3.5 py-2.5 " +
  "text-slate placeholder:text-muted/70 transition-colors " +
  "hover:border-muted focus:border-navy " +
  "aria-[invalid=true]:border-critical";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-navy"
      >
        {label}
        {required ? (
          <span className="ml-1 text-amber" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-muted">
            optional
          </span>
        )}
      </label>

      {hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}

      <div className="mt-2">{children}</div>

      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="mt-1.5 text-sm text-critical"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string) {
  const parts = [hint ? `${id}-hint` : null, error ? `${id}-error` : null];
  const value = parts.filter(Boolean).join(" ");
  return value || undefined;
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${className}`} />;
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${CONTROL} ${className}`}>
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`${CONTROL} min-h-32 ${className}`} />
  );
}

export function Checkbox({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          {...props}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 size-4 shrink-0 accent-[var(--color-navy)]"
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-slate">
          {label}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-critical" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Off-screen but focusable-adjacent honeypot. Bots fill it; humans never see it. */
export function Honeypot({ name }: { name: string }) {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
      <label htmlFor={name}>Leave this field blank</label>
      <input id={name} name={name} type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
