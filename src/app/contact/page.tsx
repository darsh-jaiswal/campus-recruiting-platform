import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { CONTACT, PAYMENT_CONTACT, SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact",
  description: `How to reach the ${SITE.name} organising team and the ${SITE.institution} Placement Cell.`,
};

export default function ContactPage() {
  return (
    <LegalPage eyebrow="Contact" title="Get in touch." lastUpdated="23 August 2026">
      <section>
        <h2>Organising team</h2>
        <p>
          {SITE.name} is run out of {SITE.institutionFull}. For questions about
          registration, partner onboarding, or anything else about the event:
        </p>
        <ul>
          <li>
            Phone:{" "}
            <a href={`tel:${PAYMENT_CONTACT.phone.replace(/\s/g, "")}`}>
              {PAYMENT_CONTACT.phone}
            </a>
          </li>
          <li>
            Email:{" "}
            <a href={`mailto:${PAYMENT_CONTACT.email}`}>{PAYMENT_CONTACT.email}</a>
          </li>
        </ul>
      </section>

      <section>
        <h2>Placement Cell</h2>
        <p>
          For recruiter and corporate partnership queries specifically, the
          Placement Cell is the direct line:
        </p>
        <ul>
          <li>
            {CONTACT.placementCell.name}, {CONTACT.placementCell.role}
          </li>
          <li>
            Email:{" "}
            <a href={`mailto:${CONTACT.placementCell.email}`}>
              {CONTACT.placementCell.email}
            </a>
          </li>
          <li>
            Phone:{" "}
            <a href={`tel:${CONTACT.placementCell.phone.replace(/\s/g, "")}`}>
              {CONTACT.placementCell.phone}
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2>Campus address</h2>
        <p>
          {CONTACT.address.line1}
          <br />
          {CONTACT.address.line2}
          <br />
          {CONTACT.address.line3}
          <br />
          {CONTACT.address.line4}
        </p>
      </section>
    </LegalPage>
  );
}
