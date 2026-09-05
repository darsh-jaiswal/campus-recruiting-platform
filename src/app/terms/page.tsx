import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PAYMENT_CONTACT, SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description: `The terms governing use of ${SITE.name} and student registration.`,
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms & conditions."
      lastUpdated="23 August 2026"
    >
      <section>
        <h2>About this site</h2>
        <p>
          {SITE.name} is the industry and careers track of {SITE.parentEvent},
          the annual technical fest of {SITE.institutionFull}. This site is
          used to promote {SITE.name} to recruiters and alumni, capture
          corporate partners, and collect and screen student registrations.
        </p>
      </section>

      <section>
        <h2>Eligibility</h2>
        <p>
          Student registration is open to students of {SITE.institution}{" "}
          across the programmes and branches listed on the registration form.
          You must sign in with a Google or Microsoft account you control, and
          the information you submit must be accurate — CGPA and academic
          details are used directly to screen your application.
        </p>
      </section>

      <section>
        <h2>Registration and payment</h2>
        <p>
          Registering requires payment of a registration fee, processed
          through Razorpay. Your application is not complete, and no
          reference code is issued, until payment is confirmed — see our{" "}
          <a href="/refunds">cancellation &amp; refunds policy</a> for what
          happens after that point.
        </p>
      </section>

      <section>
        <h2>No guarantee of an interview or offer</h2>
        <p>
          Registering, and being screened, does not guarantee an interview
          slot or a job offer. Partner companies set their own requirements
          and review applications independently; meeting the published
          CGPA threshold makes you eligible for consideration, not for a
          guaranteed outcome.
        </p>
      </section>

      <section>
        <h2>Accuracy of information</h2>
        <p>
          You are responsible for the accuracy of the information and resume
          you submit. Misrepresenting your CGPA, branch, or other academic
          details may result in your application being withdrawn from
          consideration.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms, or the fee and screening criteria
          described elsewhere on the site, between editions of{" "}
          {SITE.parentEvent}. Changes do not apply retroactively to a
          registration already paid for and confirmed.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${PAYMENT_CONTACT.email}`}>{PAYMENT_CONTACT.email}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
