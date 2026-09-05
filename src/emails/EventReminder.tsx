import { Text } from "@react-email/components";
import { EmailLayout } from "./layout";

type Props = {
  fullName: string;
  refCode: string;
  /** e.g. "in 7 days", "in 3 days", "tomorrow" */
  whenLabel: string;
  dateLabel: string;
};

export function EventReminderEmail({
  fullName,
  refCode,
  whenLabel,
  dateLabel,
}: Props) {
  return (
    <EmailLayout preview={`Aspire Quest is ${whenLabel} — ${dateLabel}`}>
      <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>Hi {fullName},</Text>
      <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>
        Aspire Quest is {whenLabel} ({dateLabel}). Your reference code is{" "}
        <strong>{refCode}</strong> — have it ready if the organising team
        needs to look up your application.
      </Text>
      <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>
        No action is needed from you unless you&rsquo;re contacted directly
        about next steps.
      </Text>
    </EmailLayout>
  );
}

export default EventReminderEmail;
