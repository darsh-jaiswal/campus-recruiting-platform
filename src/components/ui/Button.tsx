import Link from "next/link";
import type { ReactNode } from "react";

/**
 * `accent` is amber and is reserved for THE single primary call to action on a
 * page. If a second amber button appears on the same screen, one of them is
 * wrong — amber is semantic here, not decorative.
 */
type Variant =
  | "accent"
  | "primary"
  | "outline"
  | "outline-invert"
  | "gradient"
  | "gradient-soft"
  | "gradient-invert"
  | "glass-invert";

const VARIANTS: Record<Variant, string> = {
  /* bg-navy/bg-amber are a dark fill in the default (light) era and a light
     fill inside the `.aq-noir` scope — `text-on-navy`/`text-on-amber` flip
     white/ink to match whichever fill is active, so these two variants
     render correctly on every page without knowing which era they're in. */
  accent:
    "bg-amber text-on-amber border-amber hover:bg-amber-hover hover:border-amber-hover active:translate-y-px",
  primary:
    "bg-navy text-on-navy border-navy hover:bg-navy-hover hover:border-navy-hover active:translate-y-px",
  outline:
    "bg-transparent text-navy border-hairline-strong hover:border-navy hover:bg-raised active:translate-y-px",
  /* outline's paper-side counterpart, for a secondary action that sits on
     ink or on the glass header rather than on paper. Hardcoded white/black —
     only ever used inside the always-dark header (plus the masthead's own
     dark-scoped CTAs), so it doesn't need to track the era. Frosted rather
     than fully transparent so it reads as glass against the header's own
     blur, not as bare text with a border. */
  "outline-invert":
    "border-white/20 bg-white/5 text-white backdrop-blur-md hover:border-white/35 hover:bg-white/10 active:translate-y-px",
  /* Tonal gradients, not hue gradients — the palette is monochrome by
     design, so depth comes from a shift along the ink ramp rather than from
     introducing a colour the system does not have. */
  gradient:
    "border-transparent text-white bg-gradient-to-b from-navy-soft via-navy to-navy " +
    "hover:from-navy hover:via-navy-hover hover:to-navy-soft " +
    "shadow-sm hover:shadow active:translate-y-px",
  "gradient-soft":
    "border-hairline-strong text-navy bg-gradient-to-b from-surface via-raised to-sunken " +
    "hover:from-raised hover:via-sunken hover:to-sunken " +
    "active:translate-y-px",
  /* The paper-side gradient, for the emphatic action when it sits on ink —
     inverting keeps it the loudest thing in the bar instead of the quietest. */
  "gradient-invert":
    "border-transparent text-navy bg-gradient-to-b from-white via-surface to-sunken " +
    "hover:from-surface hover:via-sunken hover:to-sunken " +
    "shadow-sm hover:shadow active:translate-y-px",
  /* outline-invert's brighter sibling: the header's one primary action
     (For students / My application), hardcoded white/black like
     outline-invert for the same reason. Used to carry a borrowed
     violet-to-pink identity; dropped in favour of staying hue-free like
     every other variant — a brighter, more opaque glass than
     outline-invert is what now marks it as the primary of the two. */
  "glass-invert":
    "border-white/30 bg-white/20 text-white backdrop-blur-md " +
    "hover:bg-white/30 hover:border-white/45 active:translate-y-px",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded border px-5 py-3 " +
  "text-sm font-semibold tracking-tight transition-all duration-150 " +
  "motion-reduce:transition-none";

export function ButtonLink({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      className={`${BASE} ${VARIANTS[variant]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
