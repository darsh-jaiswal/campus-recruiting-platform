import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "Shipping policy",
  description: `${SITE.name} does not ship any physical goods.`,
};

export default function ShippingPage() {
  return (
    <LegalPage
      eyebrow="Policy"
      title="Shipping."
      lastUpdated="23 August 2026"
    >
      <section>
        <h2>No physical goods</h2>
        <p>
          {SITE.name} is a digital registration and recruitment service. We do
          not sell, ship, or deliver any physical products. Registering for
          the event and paying the registration fee do not involve shipping
          of any kind.
        </p>
      </section>

      <section>
        <h2>What you receive</h2>
        <p>
          On successful payment, your registration is confirmed instantly and
          a reference code is shown on screen and emailed to the address on
          your account. Nothing physical is sent, and there is no delivery
          timeline to track.
        </p>
      </section>
    </LegalPage>
  );
}
