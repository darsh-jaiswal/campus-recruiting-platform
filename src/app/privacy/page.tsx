import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PAYMENT_CONTACT, SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${SITE.name} collects, stores and shares your data.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Policy" title="Privacy." lastUpdated="23 August 2026">
      <section>
        <h2>What we collect</h2>
        <p>If you register as a student, we collect:</p>
        <ul>
          <li>
            Your name and email address, from the Google or Microsoft account
            you sign in with — never typed directly, so it is always a
            verified address you control.
          </li>
          <li>Your phone number, CGPA, branch, programme, and year of study.</li>
          <li>Your declared focus area and a free-text list of skills.</li>
          <li>Your resume, uploaded as a PDF.</li>
          <li>
            Payment details for the registration fee — we receive only the
            payment status, amount, and Razorpay&rsquo;s own transaction
            identifiers. Card and UPI details are handled entirely by
            Razorpay and never reach our servers.
          </li>
        </ul>
        <p>
          If you use the corporate partner form, we collect the contact and
          company details you submit there.
        </p>
      </section>

      <section>
        <h2>Why we collect it</h2>
        <p>
          To run {SITE.name}&rsquo;s recruitment track: to screen
          registrations, share your application with the partner companies
          whose openings you apply to, confirm your registration payment, and
          send you the reference code and event-related emails.
        </p>
      </section>

      <section>
        <h2>Who can see it</h2>
        <p>
          Your application is visible to the {SITE.name} organising team. Your
          resume and application details are shared with a partner company
          only when you apply to one of that company&rsquo;s openings —
          applying is your act of sharing — and every such access is
          individually logged. Partner companies never see the full pool of
          registrations, only the students who applied to them.
        </p>
      </section>

      <section>
        <h2>Where it&rsquo;s stored</h2>
        <p>
          Application data is stored in a Postgres database (Neon). Resumes
          are stored in private object storage (Vercel Blob) that is never
          publicly accessible — every read goes through a short-lived,
          logged access link. Authentication is handled by Clerk; we never
          see or store your Google/Microsoft password.
        </p>
      </section>

      <section>
        <h2>Third parties we use</h2>
        <p>
          Clerk (sign-in), Vercel (hosting, database, resume storage), Razorpay
          (payment processing), and Resend (transactional email). Each
          processes only the data necessary for its function, under its own
          privacy terms.
        </p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          We keep your application for as long as it is relevant to the
          current edition of {SITE.parentEvent}&rsquo;s recruitment cycle. An
          incomplete application — one where payment was never attempted — is
          automatically deleted after 24 hours. To request deletion of a
          completed application, or to ask what data we hold about you,
          contact us at{" "}
          <a href={`mailto:${PAYMENT_CONTACT.email}`}>{PAYMENT_CONTACT.email}</a>.
        </p>
      </section>

      <section>
        <h2>Your consent</h2>
        <p>
          You explicitly consent to this handling of your data at the point
          of registration, via the consent checkbox on the registration form.
          Browsing the rest of the site never requires an account or any
          personal data.
        </p>
      </section>
    </LegalPage>
  );
}
