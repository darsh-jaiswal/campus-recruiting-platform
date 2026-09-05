"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { companies, problemStatements } from "@/db/schema";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { fieldErrors, partnerSchema } from "@/lib/validation";

export type PartnerState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      errors?: Record<string, string>;
      /** What was submitted, echoed back so a failed submit never wipes the form (React 19 resets fields after every action). */
      values?: Record<string, string>;
      /** Focus area is multi-select, so it's echoed separately from the scalar fields above. */
      focusAreas?: string[];
    }
  | { status: "success"; company: string };

/** The honeypot is deliberately excluded — it must never be echoed back. */
const ECHO_FIELDS = [
  "companyName",
  "website",
  "contactName",
  "contactEmail",
  "contactPhone",
  "stipendMin",
  "ppoTrack",
  "problemTitle",
  "problemDescription",
] as const;

function echoValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of ECHO_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

function echoFocusAreas(formData: FormData): string[] {
  return formData.getAll("focusArea").filter((v): v is string => typeof v === "string");
}

export async function submitPartner(
  _prev: PartnerState,
  formData: FormData,
): Promise<PartnerState> {
  const requestHeaders = await headers();
  const limit = await checkRateLimit("partner", clientIp(requestHeaders));

  if (!limit.ok) {
    return {
      status: "error",
      message:
        limit.reason === "rate_limited"
          ? "This form has been submitted several times from your connection. Please wait a few minutes."
          : "The form is temporarily unavailable. Please try again shortly.",
      values: echoValues(formData),
      focusAreas: echoFocusAreas(formData),
    };
  }

  const parsed = partnerSchema.safeParse({
    companyName: formData.get("companyName"),
    website: formData.get("website") ?? "",
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone") ?? "",
    stipendMin: formData.get("stipendMin") ?? "",
    ppoTrack: formData.get("ppoTrack") === "on",
    problemTitle: formData.get("problemTitle"),
    problemDescription: formData.get("problemDescription"),
    focusArea: formData.getAll("focusArea"),
    companyFax: formData.get("companyFax") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Some details need fixing before we can record your interest.",
      errors: fieldErrors(parsed.error),
      values: echoValues(formData),
      focusAreas: echoFocusAreas(formData),
    };
  }

  const input = parsed.data;

  try {
    // A self-serve submission enters the pipeline as `interested`, not `lead`:
    // the company has already raised its hand.
    const [company] = await db
      .insert(companies)
      .values({
        name: input.companyName,
        website: input.website,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone || null,
        stipendMin: input.stipendMin,
        ppoTrack: input.ppoTrack,
        status: "interested",
        source: "self_serve",
      })
      .returning({ id: companies.id });

    if (company) {
      // One row per selected focus area, sharing the same problem statement —
      // the schema keeps a single focus area per row, and a company already
      // has a one-to-many relationship to its problem statements.
      await db.insert(problemStatements).values(
        input.focusArea.map((focusArea) => ({
          companyId: company.id,
          title: input.problemTitle,
          description: input.problemDescription,
          focusArea: focusArea as "core_dev" | "aiml" | "robotics" | "other",
        })),
      );
    }

    return { status: "success", company: input.companyName };
  } catch (error) {
    console.error("[partners] insert failed:", error);
    return {
      status: "error",
      message:
        "Something went wrong recording your details. Please try again in a moment.",
      values: echoValues(formData),
      focusAreas: echoFocusAreas(formData),
    };
  }
}
