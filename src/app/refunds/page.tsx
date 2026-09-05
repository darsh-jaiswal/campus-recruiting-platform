import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PAYMENT_CONTACT, SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "Cancellation & refunds",
  description: `The cancellation and refund policy for ${SITE.name} registration payments.`,
};

export default function RefundsPage() {
  return (
    <LegalPage
      eyebrow="Policy"
      title="Cancellation & refunds."
      lastUpdated="23 August 2026"
    >
      <section>
        <h2>Registration fee</h2>
        <p>
          Registering for {SITE.name} requires a one-time registration fee,
          paid online at the time of application. This fee covers screening
          and administration of your application against {SITE.parentEvent}
          &rsquo;s recruitment track and is separate from any stipend or offer
          a partner company may extend.
        </p>
      </section>

      <section>
        <h2>Cancellation by a student</h2>
        <p>
          Once a registration payment is confirmed, the fee is non-refundable.
          This applies whether you later decide not to participate, are not
          shortlisted by any partner company, or are unable to attend the
          event for any reason on your side.
        </p>
      </section>

      <section>
        <h2>Cancellation or postponement by the organisers</h2>
        <p>
          If {SITE.parentEvent} or the {SITE.name} track is cancelled by the
          organising team before it takes place, every student with a
          confirmed paid registration will receive a full refund of the
          registration fee. If the event is postponed rather than cancelled,
          an existing paid registration carries over to the new date with no
          further action or payment required.
        </p>
      </section>

      <section>
        <h2>Payment failures</h2>
        <p>
          If a payment is deducted from your account but your registration
          does not show as confirmed, do not attempt to pay again. Contact
          the organising team with your payment reference and we will confirm
          the status directly; a failed or duplicate charge that never
          resulted in a confirmed registration is refunded in full.
        </p>
      </section>

      <section>
        <h2>How refunds are processed</h2>
        <p>
          Approved refunds are issued to the original payment method via
          Razorpay, our payment processor, and typically reflect within 5–7
          business days of approval, depending on your bank or card issuer.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          For anything about a specific payment or refund, contact{" "}
          <a href={`mailto:${PAYMENT_CONTACT.email}`}>{PAYMENT_CONTACT.email}</a>{" "}
          with your registration reference code.
        </p>
      </section>
    </LegalPage>
  );
}
