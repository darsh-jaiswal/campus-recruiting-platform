import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Section";

export function LegalPage({
  eyebrow,
  title,
  lastUpdated,
  children,
}: {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />

      <main id="main">
        <Container className="max-w-[68ch] py-16 md:py-24">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-5 text-h1 font-semibold text-navy">{title}</h1>
          <p className="mt-3 text-sm text-muted">Last updated {lastUpdated}</p>

          <div className="mt-10 space-y-8 border-t border-hairline pt-10 text-slate [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:text-navy [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:leading-relaxed [&_a]:font-semibold [&_a]:text-navy [&_a]:underline [&_a]:underline-offset-4">
            {children}
          </div>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
