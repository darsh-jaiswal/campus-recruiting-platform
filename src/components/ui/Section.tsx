import type { ReactNode } from "react";
import { Container } from "./Container";

/**
 * Section rhythm is deliberately uneven.
 *
 * Narrative sections breathe (`loose`); the proof band is compressed (`tight`)
 * so the numbers land harder against the prose either side of them. Uniform
 * padding everywhere is what makes a page read like a template.
 */
type Rhythm = "tight" | "normal" | "loose";

const RHYTHM: Record<Rhythm, string> = {
  tight: "py-12 md:py-16",
  normal: "py-16 md:py-24",
  loose: "py-20 md:py-32",
};

export function Section({
  id,
  rhythm = "normal",
  bleed = false,
  className = "",
  labelledBy,
  children,
}: {
  id?: string;
  rhythm?: Rhythm;
  /** Skip the container — for full-width bands that manage their own measure. */
  bleed?: boolean;
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  const inner = bleed ? children : <Container>{children}</Container>;

  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`${RHYTHM[rhythm]} ${className}`}
    >
      {inner}
    </section>
  );
}

/** Small caps label that sits above a heading. Sets the grid, not decoration. */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-eyebrow font-semibold uppercase text-muted ${className}`}
    >
      {children}
    </p>
  );
}
