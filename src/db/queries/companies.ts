import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  problemStatements,
  recruiterMemberships,
} from "@/db/schema";

// Status vocabulary and labels live in @/lib/pipeline so client components can
// use them without pulling this server-only module into the browser bundle.
import type { CompanyStatus } from "@/lib/pipeline";

export async function listCompanies() {
  return db.select().from(companies).orderBy(desc(companies.updatedAt));
}

export async function getCompany(id: number) {
  const [row] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);
  return row ?? null;
}

export async function companyStatusCounts(): Promise<
  Record<CompanyStatus, number>
> {
  const rows = await db
    .select({ status: companies.status, value: sql<number>`count(*)::int` })
    .from(companies)
    .groupBy(companies.status);

  const out: Record<CompanyStatus, number> = {
    lead: 0,
    contacted: 0,
    interested: 0,
    committed: 0,
    onboarded: 0,
  };
  for (const row of rows) out[row.status] = row.value;
  return out;
}

/**
 * Companies waiting on an organiser: self-serve interest submissions (and
 * anything else moved to `interested`) that nobody has committed or
 * onboarded yet. The console overview lists these as work to action.
 */
export async function listInterestedCompanies() {
  return db
    .select({
      id: companies.id,
      name: companies.name,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .where(eq(companies.status, "interested"))
    .orderBy(desc(companies.updatedAt));
}

export async function getProblemStatements(companyId: number) {
  return db
    .select()
    .from(problemStatements)
    .where(eq(problemStatements.companyId, companyId))
    .orderBy(desc(problemStatements.createdAt));
}

/**
 * Recruiter memberships for one company — the database half of "who can log
 * in as this company's recruiter". The Clerk half (email, role) is resolved
 * by the caller, because emails live in the identity provider, not here.
 */
export async function listRecruiterMemberships(companyId: number) {
  return db
    .select({
      id: recruiterMemberships.id,
      userId: recruiterMemberships.userId,
      createdAt: recruiterMemberships.createdAt,
    })
    .from(recruiterMemberships)
    .where(eq(recruiterMemberships.companyId, companyId))
    .orderBy(desc(recruiterMemberships.createdAt));
}
