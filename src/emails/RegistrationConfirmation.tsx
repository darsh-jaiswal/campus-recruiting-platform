import { Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

type Props = {
  fullName: string;
  refCode: string;
};

export function RegistrationConfirmationEmail({ fullName, refCode }: Props) {
  return (
    <EmailLayout preview={`You're registered — reference code ${refCode}`}>
      <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>Hi {fullName},</Text>
      <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>
        Your Aspire Quest registration was received. Keep this reference code
        &mdash; it&rsquo;s how the organising team identifies your application
        in any follow-up.
      </Text>

      <Section
        style={{
          backgroundColor: "#f5f4f0",
          padding: "16px 20px",
          margin: "20px 0",
          textAlign: "center",
        }}
      >
        <Text
          style={{
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "2px",
            margin: 0,
          }}
        >
          {refCode}
        </Text>
      </Section>

      <Text style={{ fontSize: "15px", lineHeight: "1.6" }}>
        Applications are screened as soon as partner onboarding closes.
        We&rsquo;ll email you again as the event date approaches.
      </Text>
    </EmailLayout>
  );
}

export default RegistrationConfirmationEmail;
