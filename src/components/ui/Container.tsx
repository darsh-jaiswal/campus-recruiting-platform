import type { ReactNode } from "react";

/** The single measure the whole site is set to. Nothing sits outside it. */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[76rem] px-6 md:px-10 ${className}`}>
      {children}
    </div>
  );
}
