import { Section, Text } from "@react-email/components";
import type { DecisionStatus } from "@/lib/status-emails";
import { EmailLayout } from "./layout";

type Props = {
  fullName: string;
  refCode: string;
  status: DecisionStatus;
};

const BODY: Record<DecisionStatus, { preview: string; lead: string; detail: string }> = {
  shortlisted: {
    preview: "You've been shortlisted",
    lead: "Good news — partner companies have shortlisted your profile.",
    detail:
      "Interview details follow in a separate email once schedules are set. There is nothing you need to do right now.",
  },
  selected: {
    preview: "Congratulations — you've been selected",
    lead: "Congratulations — a partner company has selected you.",
    detail:
      "The organising team will contact you with the offer details and next steps. If anything looks off, reply quoting your reference code.",
  },
  rejected: {
    preview: "An update on your application",
    lead: "After review, your application was not selected this time.",
    detail:
      "This decision covers the current screening round only — openings on the jobs board remain open to you, and applying to them is separate from this outcome.",
  },
};

export function StatusUpdateEmail({ fullName, refCode, status }: Props) {
  const copy = BODY[status];

  return (
    <EmailLayout preview={copy.preview}>
      <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>Hi {fullName},</Text>
      <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>{copy.lead}</Text>
      <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>{copy.detail}</Text>

      <Section
        style={{
          backgroundColor: "#f5f4f0",
          padding: "12px 20px",
          margin: "20px 0",
          textAlign: "center",
        }}
      >
        <Text style={{ fontSize: "13px", margin: 0, color: "#555" }}>
          Reference code
        </Text>
        <Text
          style={{
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "2px",
            margin: "4px 0 0",
          }}
        >
          {refCode}
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default StatusUpdateEmail;
