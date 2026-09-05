import { Eyebrow, Section } from "@/components/ui/Section";
import { FAQ } from "@/lib/content";

/**
 * Native <details> — keyboard-operable and screen-reader correct with no
 * client JavaScript and no ARIA to get wrong.
 */
export function Faq() {
  return (
    <Section
      id="faq"
      labelledBy="faq-heading"
      rhythm="loose"
      className="border-t border-hairline bg-raised"
    >
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <Eyebrow>Questions</Eyebrow>
          <h2 id="faq-heading" className="mt-5 text-h1 font-semibold">
            Before you register.
          </h2>
        </div>

        <div className="lg:col-span-8">
          <dl className="border-t border-hairline-strong">
            {FAQ.map((item) => (
              <div key={item.question} className="border-b border-hairline">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                    <dt className="text-h3 font-semibold text-navy">
                      {item.question}
                    </dt>
                    <span
                      aria-hidden="true"
                      className="mt-1.5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M8 2v12M2 8h12" />
                      </svg>
                    </span>
                  </summary>
                  <dd className="max-w-[68ch] pb-6 pr-10 text-slate">
                    {item.answer}
                  </dd>
                </details>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  );
}
