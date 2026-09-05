import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { CONTACT, SITE } from "@/lib/content";

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f5f4f0", fontFamily: "Georgia, serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "0 auto",
            padding: "32px",
            maxWidth: "480px",
          }}
        >
          <Text style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px" }}>
            {SITE.name}
          </Text>
          <Text style={{ fontSize: "13px", color: "#666666", margin: "0 0 24px" }}>
            {SITE.institution}
          </Text>

          {children}

          <Hr style={{ borderColor: "#e5e3dd", margin: "32px 0 16px" }} />
          <Text style={{ fontSize: "12px", color: "#888888", margin: 0 }}>
            {CONTACT.campusEmail} · {CONTACT.campusPhone}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
