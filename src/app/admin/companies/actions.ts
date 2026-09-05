"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, recruiterMemberships } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { parseCsvRecords, pick } from "@/lib/csv";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const companyId = z.coerce.number().int().positive();

/** Only the two stages the UI still offers — see COMPANY_STATUSES in @/lib/pipeline. */
const statusSchema = z.enum(["interested", "onboarded"]);

/** Move a company along the pipeline. */
export async function setCompanyStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = companyId.safeParse(formData.get("companyId"));
  const status = statusSchema.safeParse(formData.get("status"));

  if (!id.success || !status.success) {
    return { status: "error", message: "Could not read that change." };
  }

  try {
    await db
      .update(companies)
      .set({ status: status.data, updatedAt: new Date() })
      .where(eq(companies.id, id.data));

    revalidatePath("/admin/companies");
    revalidatePath(`/admin/companies/${id.data}`);
    revalidatePath("/admin");

    return { status: "success", message: `Moved to ${status.data}.` };
  } catch (error) {
    console.error("[admin/companies] status update failed:", error);
    return { status: "error", message: "Could not update that company." };
  }
}

/**
 * Bulk import of the Placement Cell recruiter list or an alumni company list.
 *
 * Header names are normalised, so "Company", "company name" and "COMPANY_NAME"
 * all work — these files come from spreadsheets maintained by hand, and
 * rejecting the whole file over a header spelling helps nobody.
 */
export async function importCompanies(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a CSV file to import." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { status: "error", message: "That file is larger than 2 MB." };
  }

  const source = formData.get("source");
  const parsedSource = z
    .enum(["placement_cell", "alumni_referral", "research"])
    .safeParse(source);
  if (!parsedSource.success) {
    return { status: "error", message: "Pick where this list came from." };
  }

  let records: Record<string, string>[];
  try {
    records = parseCsvRecords(await file.text());
  } catch (error) {
    console.error("[admin/companies] csv parse failed:", error);
    return { status: "error", message: "Could not read that file as CSV." };
  }

  const rows = records
    .map((record) => ({
      name: pick(record, "company", "company name", "name", "organisation"),
      website: pick(record, "website", "url", "site"),
      contactName: pick(record, "contact", "contact name", "hr", "recruiter"),
      contactEmail: pick(record, "email", "contact email", "e mail"),
      contactPhone: pick(record, "phone", "contact phone", "mobile"),
    }))
    .filter((row): row is typeof row & { name: string } => Boolean(row.name));

  if (rows.length === 0) {
    return {
      status: "error",
      message:
        "No rows had a company name. Check the file has a 'Company' column.",
    };
  }

  try {
    await db.insert(companies).values(
      rows.map((row) => ({
        name: row.name,
        website: row.website,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        // "lead" is no longer reachable from the move-to select (see
        // COMPANY_STATUSES) — importing here would strand the row.
        status: "interested" as const,
        source: parsedSource.data,
      })),
    );

    revalidatePath("/admin/companies");
    revalidatePath("/admin");

    return {
      status: "success",
      message: `Imported ${rows.length} compan${rows.length === 1 ? "y" : "ies"}${
        records.length > rows.length
          ? ` · skipped ${records.length - rows.length} row(s) with no company name`
          : ""
      }.`,
    };
  } catch (error) {
    console.error("[admin/companies] import failed:", error);
    return { status: "error", message: "Could not save those companies." };
  }
}

/* -------------------------------------------------------------------------
 * Recruiter access — the "accept a recruiter" flow
 *
 * Turning a partner contact into a working portal login is two grants: the
 * recruiter role on their Clerk account, and a membership row binding them to
 * this company. Both happen here, keyed by email, so onboarding a company's
 * recruiter is an organiser action instead of dashboard-and-SQL work.
 *
 * If no Clerk account exists for the email yet, one is created; when the
 * person first clicks "Continue with Google" with that email, Clerk links the
 * sign-in to it. No password ever exists either way.
 * ---------------------------------------------------------------------- */

const recruiterEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .pipe(z.email("Enter the recruiter's email address."));

export async function grantRecruiterAccess(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  const id = companyId.safeParse(formData.get("companyId"));
  const email = recruiterEmailSchema.safeParse(formData.get("email"));
  if (!id.success || !email.success) {
    return {
      status: "error",
      message: email.success
        ? "Could not read that request."
        : email.error.issues[0]!.message,
    };
  }

  try {
    const clerk = await clerkClient();

    const existing = await clerk.users.getUserList({
      emailAddress: [email.data],
    });
    let user = existing.data[0] ?? null;

    // Never silently demote an organiser to a recruiter.
    if (user && user.publicMetadata?.role === "admin") {
      return {
        status: "error",
        message: "That email belongs to an organiser account.",
      };
    }

    if (user) {
      await clerk.users.updateUserMetadata(user.id, {
        publicMetadata: { role: "recruiter" },
      });
    } else {
      user = await clerk.users.createUser({
        emailAddress: [email.data],
        skipPasswordRequirement: true,
        publicMetadata: { role: "recruiter" },
      });
    }

    // Idempotent: granting twice is a no-op, not an error.
    await db
      .insert(recruiterMemberships)
      .values({
        userId: user.id,
        companyId: id.data,
        invitedBy: actor.userId,
      })
      .onConflictDoNothing();

    revalidatePath(`/admin/companies/${id.data}`);
    return {
      status: "success",
      message: `${email.data} can now sign in at /portal with Google or Microsoft using that address.`,
    };
  } catch (error) {
    console.error("[admin/companies] grant recruiter failed:", error);
    return {
      status: "error",
      message: "Could not grant access. Check the email and try again.",
    };
  }
}

export async function revokeRecruiterAccess(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const membershipId = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(formData.get("membershipId"));
  if (!membershipId.success) {
    return { status: "error", message: "Could not read that request." };
  }

  try {
    const [removed] = await db
      .delete(recruiterMemberships)
      .where(eq(recruiterMemberships.id, membershipId.data))
      .returning({ userId: recruiterMemberships.userId, companyId: recruiterMemberships.companyId });

    if (!removed) {
      return { status: "error", message: "That access was already removed." };
    }

    // If this was their last company, take the role too — an account with the
    // recruiter role but no membership is a confusing half-state.
    const remaining = await db
      .select({ id: recruiterMemberships.id })
      .from(recruiterMemberships)
      .where(eq(recruiterMemberships.userId, removed.userId))
      .limit(1);

    if (remaining.length === 0) {
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(removed.userId, {
        publicMetadata: { role: null },
      });
    }

    revalidatePath(`/admin/companies/${removed.companyId}`);
    return { status: "success", message: "Access removed." };
  } catch (error) {
    console.error("[admin/companies] revoke recruiter failed:", error);
    return { status: "error", message: "Could not remove that access." };
  }
}
