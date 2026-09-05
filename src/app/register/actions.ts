"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { db } from "@/db";
import { paymentOrders, students } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { RegistrationConfirmationEmail } from "@/emails/RegistrationConfirmation";
import { generateRefCode } from "@/lib/ref-code";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { ensurePrimaryResume } from "@/db/queries/resumes";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";
import { REGISTRATION_FEE } from "@/lib/content";
import { fieldErrors, studentRegistrationSchema } from "@/lib/validation";

/**
 * What the student typed, echoed back on error.
 *
 * React resets uncontrolled form fields once a `<form action>` completes —
 * success or failure. Without this, any single validation mistake (or a
 * transient server error) forces retyping the entire form, resume upload
 * included. Deliberately excludes the resume fields: that state already
 * survives independently in RegistrationForm's `file` useState.
 */
export type SubmittedValues = {
  fullName: string;
  phone: string;
  cgpa: string;
  programme: string;
  branch: string;
  year: string;
  focusArea: string;
  skills: string;
  consent: boolean;
};

export type RegisterState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      errors?: Record<string, string>;
      values?: SubmittedValues;
    }
  /** Fee is unset (EDITION-style TBA) — registration completed with no payment step. */
  | { status: "success"; refCode: string }
  /**
   * Fee is set. The student row is saved as pending_payment and a Razorpay
   * order exists; the client opens Checkout next. Nothing here is a
   * registration yet — see the "no payment, no registration" rule in the
   * design spec.
   */
  | {
      status: "awaiting_payment";
      studentId: number;
      razorpayOrderId: string;
      amountPaise: number;
      keyId: string;
      fullName: string;
      email: string;
      phone: string;
    };

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = "23505";

type PgErrorLike = { code?: string; constraint?: string; message?: string; cause?: unknown };

function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as PgErrorLike;

  // Drizzle wraps the real Postgres error (with `code`/`constraint`) inside
  // a "Failed query" error's `.cause` — check both, cause first since that's
  // where the fields actually live for a query built with the query builder.
  const layers = [candidate.cause, candidate].filter(
    (layer): layer is PgErrorLike => typeof layer === "object" && layer !== null,
  );

  for (const layer of layers) {
    const matchesCode =
      layer.code === UNIQUE_VIOLATION ||
      // neon-http surfaces the code inside the message in some paths.
      layer.message?.includes(UNIQUE_VIOLATION);
    if (!matchesCode) continue;
    if (!constraint) return true;
    if (layer.constraint?.includes(constraint) || layer.message?.includes(constraint)) {
      return true;
    }
  }

  return false;
}

function submittedValuesFrom(formData: FormData): SubmittedValues {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    cgpa: String(formData.get("cgpa") ?? ""),
    programme: String(formData.get("programme") ?? ""),
    branch: String(formData.get("branch") ?? ""),
    year: String(formData.get("year") ?? ""),
    focusArea: String(formData.get("focusArea") ?? ""),
    skills: String(formData.get("skills") ?? ""),
    consent: formData.get("consent") === "on",
  };
}

/** Best-effort — the row already saved. A failed confirmation email must never fail a registration. */
function sendConfirmationEmail(studentId: number, email: string, fullName: string, refCode: string) {
  waitUntil(
    sendEmail({
      to: email,
      subject: `You're registered for Aspire Quest — ${refCode}`,
      react: RegistrationConfirmationEmail({ fullName, refCode }),
      idempotencyKey: `registration-confirmation/${refCode}`,
    })
      .then((sent) => {
        if (!sent) return;
        return db
          .update(students)
          .set({ confirmationEmailSentAt: new Date() })
          .where(eq(students.id, studentId));
      })
      .catch((error) => {
        console.error("[register] confirmation email follow-up failed:", error);
      }),
  );
}

export async function submitRegistration(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const values = submittedValuesFrom(formData);

  // Identity comes from the verified OAuth session, never from the form. This
  // is what makes a mistyped or non-existent address impossible. The page is
  // already gated; this re-check exists because a Server Action is reachable
  // independently of the page that renders it.
  const { userId } = await auth();
  if (!userId) {
    return {
      status: "error",
      message: "Your session has expired. Sign in again to submit your application.",
      values,
    };
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return {
      status: "error",
      message:
        "We could not read a verified email address from your account. Sign out and sign in again.",
      values,
    };
  }

  const requestHeaders = await headers();
  const limit = await checkRateLimit("register", clientIp(requestHeaders));

  if (!limit.ok) {
    return {
      status: "error",
      message:
        limit.reason === "rate_limited"
          ? "You have submitted this form several times already. Please wait a few minutes and try again."
          : "Registration is temporarily unavailable. Please try again shortly.",
      values,
    };
  }

  const raw = {
    fullName: formData.get("fullName"),
    email,
    phone: formData.get("phone"),
    branch: formData.get("branch"),
    programme: formData.get("programme"),
    year: formData.get("year"),
    cgpa: formData.get("cgpa"),
    focusArea: formData.get("focusArea"),
    skills: String(formData.get("skills") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    resumeBlobKey: formData.get("resumeBlobKey"),
    resumeFilename: formData.get("resumeFilename") ?? undefined,
    resumeBytes: Number(formData.get("resumeBytes") ?? 0),
    consent: formData.get("consent") === "on",
    website: formData.get("website") ?? "",
  };

  const parsed = studentRegistrationSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Some details need fixing before we can accept your application.",
      errors: fieldErrors(parsed.error),
      values,
    };
  }

  const input = parsed.data;
  const feeAmount = REGISTRATION_FEE.amountPaise;

  if (feeAmount !== null && !isRazorpayConfigured()) {
    console.error("[register] a fee is set but Razorpay is not configured.");
    return {
      status: "error",
      message: "Registration is temporarily unavailable. Please try again shortly.",
      values,
    };
  }

  // Insert or, if this account already has a row, update it — but ONLY while
  // that row is still pending_payment. `setWhere` makes the update a no-op
  // (returns nothing) against a row that is already paid, which is what lets
  // us tell "editing an abandoned attempt" apart from "trying to re-register
  // after paying" below. See payment-flow-review.md — this is the mechanism
  // that lets a student return to an abandoned attempt and resubmit.
  const editableFields = {
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    branch: input.branch,
    programme: input.programme,
    year: input.year,
    cgpa: input.cgpa,
    focusArea: input.focusArea as "core_dev" | "aiml" | "robotics" | "other",
    skills: input.skills,
    resumeBlobKey: input.resumeBlobKey,
    resumeFilename: input.resumeFilename,
    resumeBytes: input.resumeBytes,
    consentAt: new Date(),
  };

  let studentId: number;
  try {
    const [row] = await db
      .insert(students)
      .values({ clerkUserId: userId, ...editableFields })
      .onConflictDoUpdate({
        target: students.clerkUserId,
        set: { ...editableFields, updatedAt: new Date() },
        setWhere: eq(students.paymentStatus, "pending_payment"),
      })
      .returning({ id: students.id });

    if (!row) {
      // Conflict occurred but setWhere excluded it — the existing row is
      // already paid. One application per account; nothing to resubmit.
      return {
        status: "error",
        message:
          "This account already has an application on record. Contact the organising team if you need to change it.",
        values,
      };
    }

    studentId = row.id;
  } catch (error) {
    if (isUniqueViolation(error, "students_email_idx")) {
      return {
        status: "error",
        message: "An application already exists for this email address.",
        errors: {
          email:
            "This email has already been registered. Contact the organising team if you need to change your application.",
        },
        values,
      };
    }

    console.error("[register] save failed:", error);
    return {
      status: "error",
      message: "Something went wrong saving your application. Please try again in a moment.",
      values,
    };
  }

  // The submitted file becomes (or refreshes) the primary entry in the
  // student's resume library. Best-effort AFTER the student row is saved:
  // the students.resume* columns above are the authoritative pointer during
  // registration, and a failure here is healed by the next submit (or the
  // backfill), so it must never fail the registration itself.
  try {
    await ensurePrimaryResume(studentId, {
      blobKey: input.resumeBlobKey,
      filename: input.resumeFilename ?? "resume.pdf",
      bytes: input.resumeBytes,
    });
  } catch (error) {
    console.error("[register] resume-library sync failed:", error);
  }

  // No fee configured (EDITION-style TBA) — registration completes exactly
  // as it did before payment existed: issue a code immediately.
  if (feeAmount === null) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const refCode = generateRefCode();
      try {
        await db
          .update(students)
          .set({ paymentStatus: "paid", refCode, paidAt: new Date() })
          .where(eq(students.id, studentId));

        sendConfirmationEmail(studentId, input.email, input.fullName, refCode);
        return { status: "success", refCode };
      } catch (error) {
        if (isUniqueViolation(error, "students_ref_code_idx")) continue;
        console.error("[register] free-flow finalize failed:", error);
        return {
          status: "error",
          message: "Something went wrong saving your application. Please try again in a moment.",
          values,
        };
      }
    }
    return {
      status: "error",
      message: "Something went wrong saving your application. Please try again in a moment.",
      values,
    };
  }

  // Fee is set — create a fresh Razorpay order for this attempt. A prior
  // abandoned order (if any) is left exactly as it is; it stays independently
  // resolvable by any webhook that eventually arrives for it. See Defect 1.
  try {
    const { razorpayOrderId } = await createRazorpayOrder({
      amountPaise: feeAmount,
      receipt: `aq-${studentId}-${Date.now()}`,
    });

    await db.insert(paymentOrders).values({
      studentId,
      razorpayOrderId,
      amountPaise: feeAmount,
      currency: "INR",
      status: "created",
    });

    return {
      status: "awaiting_payment",
      studentId,
      razorpayOrderId,
      amountPaise: feeAmount,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
    };
  } catch (error) {
    console.error("[register] Razorpay order creation failed:", error);
    return {
      status: "error",
      message:
        "We could not start the payment for your application. Your details are saved — please try again.",
      values,
    };
  }
}
