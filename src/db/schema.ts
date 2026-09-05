/**
 * Aspire Quest — database schema.
 *
 * Holds student PII (name, email, phone, CGPA) and resume pointers. Under the
 * DPDP Act, CGPA and phone are personal data; every read of a student row by
 * an admin or recruiter is written to `auditLog`. See src/db/README.md.
 */

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------
 * Enums
 * ---------------------------------------------------------------------- */

export const focusAreaEnum = pgEnum("focus_area", [
  "core_dev",
  "aiml",
  "robotics",
  "other",
  // Openings only — an opening may target every pool at once. Registration
  // validation never offers it to students, and the shared enum is the price
  // of keeping one vocabulary for both tables.
  "all",
]);

export const studentStatusEnum = pgEnum("student_status", [
  "registered",
  "screened",
  "shortlisted",
  "interviewed",
  "selected",
  "rejected",
]);

export const companyStatusEnum = pgEnum("company_status", [
  "lead",
  "contacted",
  "interested",
  "committed",
  "onboarded",
]);

/** How a company entered the pipeline — drives which outreach play to run. */
export const companySourceEnum = pgEnum("company_source", [
  "self_serve",
  "alumni_referral",
  "placement_cell",
  "research",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "view_student",
  "view_resume",
  "export_csv",
  // Retired 2026-08-24 (bundles removed) — kept because Postgres cannot
  // drop an enum value and historical audit rows may carry it.
  "view_bundle",
]);

/**
 * A student row's payment lifecycle. `pending_payment` is the default: the
 * form has been saved but no reference code exists yet. Only the webhook
 * handler ever moves a row to `paid` — see the compare-and-swap in
 * src/app/api/payments/razorpay/webhook/route.ts.
 */
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending_payment",
  "paid",
  "failed",
]);

/** One Razorpay order attempt. See paymentOrders below for why this is its own table. */
export const paymentOrderStatusEnum = pgEnum("payment_order_status", [
  "created",
  "paid",
  "failed",
]);

/**
 * A job opening's lifecycle. `draft` is invisible to students; `live` is
 * published and accepting applications; `closed` stops new applications but
 * keeps the applicant list readable.
 */
export const openingStatusEnum = pgEnum("opening_status", [
  "draft",
  "live",
  "closed",
]);

/* -------------------------------------------------------------------------
 * Students
 *
 * Students sign in with Google or Microsoft; `clerkUserId` below is the
 * one-application-per-account key that enforces it. `refCode` remains the
 * human-facing handle — the thing a student actually quotes in an email or
 * at a help desk, since nobody remembers a Clerk user id.
 * ---------------------------------------------------------------------- */

export const students = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    /**
     * Nullable: issued only when payment confirms (see paymentStatus below).
     * A `pending_payment` row genuinely has no reference code — that rule is
     * enforced here, not just in the UI. The unique index still holds:
     * Postgres allows any number of NULLs through a unique index, so many
     * unpaid rows coexisting is fine.
     */
    refCode: varchar("ref_code", { length: 12 }),

    /**
     * The Clerk account that submitted this application.
     *
     * Nullable because rows created before accounts existed have none. Unique
     * so one account yields one application — this is the duplicate check,
     * replacing email, because an account id is stable and an email is typed.
     */
    clerkUserId: varchar("clerk_user_id", { length: 64 }),

    fullName: varchar("full_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),

    branch: varchar("branch", { length: 16 }).notNull(),
    programme: varchar("programme", { length: 16 }).notNull(),
    year: varchar("year", { length: 16 }).notNull(),

    /** numeric(4,2) — 0.00 to 10.00. Never a float: CGPA is compared exactly. */
    cgpa: numeric("cgpa", { precision: 4, scale: 2 }).notNull(),

    focusArea: focusAreaEnum("focus_area").notNull(),
    skills: text("skills").array().notNull().default(sql`ARRAY[]::text[]`),

    /** Opaque key into the PRIVATE blob store. Never a public URL. */
    resumeBlobKey: text("resume_blob_key"),
    resumeFilename: varchar("resume_filename", { length: 200 }),
    resumeBytes: integer("resume_bytes"),

    status: studentStatusEnum("status").notNull().default("registered"),
    notes: text("notes"),

    /**
     * Separates a started application from a real one. Only the webhook
     * handler's compare-and-swap UPDATE ever moves this to `paid` — see
     * docs/superpowers/specs/2026-08-22-student-accounts-and-payment-design.md.
     */
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("pending_payment"),
    /** Receipt trail. Set in the same statement that sets paymentStatus='paid'. */
    paidAt: timestamp("paid_at", { withTimezone: true }),

    /** Explicit, timestamped consent. Required before any resume sharing. */
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),

    /**
     * A withdrawn registration: hidden from screening, exports,
     * reminders and new applications, but the row (and its payment record)
     * is kept — the fee is non-refundable by policy and the data-retention
     * promise in /privacy still applies. Reversal is a manual organiser
     * action. Application rows derive withdrawal from EITHER their own
     * withdrawnAt or this one (src/lib/withdrawal.ts), so the two-statement
     * withdrawal write needs no transaction.
     */
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),

    /** Set once the registration-confirmation email has been sent. */
    confirmationEmailSentAt: timestamp("confirmation_email_sent_at", {
      withTimezone: true,
    }),
    /**
     * How many of the pre-event reminder emails this student has received,
     * in order. The reminder cron only ever sends the next one — never
     * re-sends or skips ahead. See src/lib/reminders.ts.
     */
    remindersSent: integer("reminders_sent").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("students_ref_code_idx").on(table.refCode),
    uniqueIndex("students_email_idx").on(table.email),
    uniqueIndex("students_clerk_user_idx").on(table.clerkUserId),
    index("students_cgpa_idx").on(table.cgpa),
    index("students_branch_idx").on(table.branch),
    index("students_focus_area_idx").on(table.focusArea),
    index("students_status_idx").on(table.status),
    index("students_payment_status_idx").on(table.paymentStatus),
  ],
);

/* -------------------------------------------------------------------------
 * Resumes — a student's CV library
 *
 * Up to three ACTIVE rows per student (enforced in the write, not here —
 * see src/lib/resume-library.ts), exactly one of them primary. The primary
 * is what registration submits and what the admin console reads; applications
 * snapshot whichever row was chosen at apply time via
 * jobApplications.resumeId, and that reference is permanent.
 *
 * Deletion is ALWAYS soft (`deletedAt`) — one code path, no FK race with a
 * concurrent apply, and an application's snapshot survives the library
 * losing the entry. The blob itself is reaped by the orphan sweep only once
 * nothing references it; the sweep's referenced set unions this table, so
 * adding blob columns elsewhere means updating orphaned-resumes.ts.
 *
 * `students.resume*` stays as a mirror of the primary row so existing
 * readers (admin console, CSV export) keep working unchanged.
 * ---------------------------------------------------------------------- */

export const resumes = pgTable(
  "resumes",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** Opaque key into the PRIVATE blob store — same rules as students.resumeBlobKey. */
    blobKey: text("blob_key").notNull(),
    filename: varchar("filename", { length: 200 }).notNull(),
    bytes: integer("bytes").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Soft delete: hidden from the library, kept for application snapshots. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    /**
     * Unique per student, not globally: legacy seed rows share blob keys
     * across students, and nothing in the snapshot model needs global
     * uniqueness — the sweep protects by key regardless of who owns it.
     * Per-student uniqueness is what keeps re-adding the same file (and the
     * backfill) idempotent.
     */
    uniqueIndex("resumes_student_blob_idx").on(table.studentId, table.blobKey),
    index("resumes_student_idx").on(table.studentId),
  ],
);

/* -------------------------------------------------------------------------
 * Payment orders — one row per Razorpay order attempt
 *
 * Deliberately NOT a column on `students`. A student can abandon a payment
 * popup, edit their form, and resubmit — which creates a second order. If the
 * order id lived on `students`, resubmitting would overwrite it, and a late
 * webhook for the first (superseded) order would arrive, find no matching
 * row, and the payment would be lost with no way to recover it. Every order
 * this table has ever seen, however old, still resolves back to its student.
 * See payment-flow-review.md, Defect 1.
 * ---------------------------------------------------------------------- */

export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** How a webhook resolves back to a student. */
    razorpayOrderId: varchar("razorpay_order_id", { length: 64 }).notNull(),
    /**
     * Integer paise, never a float — the same discipline this codebase
     * applies to CGPA. The amount quoted for THIS order specifically; the
     * webhook verifies against this column, not against current config, so a
     * fee change mid-flight never invalidates a payment already quoted.
     */
    amountPaise: integer("amount_paise").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    status: paymentOrderStatusEnum("status").notNull().default("created"),
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_orders_razorpay_order_idx").on(table.razorpayOrderId),
    index("payment_orders_student_idx").on(table.studentId),
    index("payment_orders_status_idx").on(table.status),
  ],
);

/* -------------------------------------------------------------------------
 * Payment events — append-only webhook audit log
 *
 * Every webhook Razorpay ever sends, valid or not, parseable or not. Never
 * deleted. If a student disputes a charge, this shows exactly what Razorpay
 * sent and when — independent of whatever state paymentOrders/students ended
 * up in.
 * ---------------------------------------------------------------------- */

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: serial("id").primaryKey(),
    /** Nullable: an unparseable payload may carry no recoverable order id. */
    razorpayOrderId: varchar("razorpay_order_id", { length: 64 }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    signatureValid: boolean("signature_valid").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payment_events_order_idx").on(table.razorpayOrderId),
    index("payment_events_received_idx").on(table.receivedAt),
  ],
);

/* -------------------------------------------------------------------------
 * Companies — the CRM pipeline
 * ---------------------------------------------------------------------- */

export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    website: varchar("website", { length: 200 }),

    contactName: varchar("contact_name", { length: 120 }),
    contactEmail: varchar("contact_email", { length: 160 }),
    contactPhone: varchar("contact_phone", { length: 20 }),

    /** Monthly stipend floor in INR. Null when not yet discussed. */
    stipendMin: integer("stipend_min"),
    ppoTrack: boolean("ppo_track").notNull().default(false),

    status: companyStatusEnum("status").notNull().default("interested"),
    source: companySourceEnum("source").notNull().default("self_serve"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("companies_status_idx").on(table.status),
    index("companies_source_idx").on(table.source),
  ],
);

/* -------------------------------------------------------------------------
 * Problem statements — what a partner's interviews are built around
 * ---------------------------------------------------------------------- */

export const problemStatements = pgTable(
  "problem_statements",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    focusArea: focusAreaEnum("focus_area").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("problem_statements_company_idx").on(table.companyId),
    index("problem_statements_focus_area_idx").on(table.focusArea),
  ],
);

/* -------------------------------------------------------------------------
 * Alumni referrals — promotes into a company lead
 * ---------------------------------------------------------------------- */

export const alumniReferrals = pgTable(
  "alumni_referrals",
  {
    id: serial("id").primaryKey(),
    alumName: varchar("alum_name", { length: 120 }).notNull(),
    batch: varchar("batch", { length: 16 }),
    branch: varchar("branch", { length: 16 }),
    company: varchar("company", { length: 160 }),
    role: varchar("role", { length: 120 }),
    email: varchar("email", { length: 160 }),
    linkedin: varchar("linkedin", { length: 200 }),
    hiringInterest: boolean("hiring_interest").notNull().default(false),
    notes: text("notes"),

    /** Set once this referral has been promoted into `companies`. */
    promotedCompanyId: integer("promoted_company_id").references(
      () => companies.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("alumni_referrals_hiring_idx").on(table.hiringInterest),
    index("alumni_referrals_promoted_idx").on(table.promotedCompanyId),
  ],
);

/* -------------------------------------------------------------------------
 * Job openings — recruiter-authored postings students apply to
 *
 * The marketplace flow: a recruiter publishes an opening, students apply
 * from their login, and the applicant list is ranked by AI against the
 * opening's private screening prompt. Publishing is self-serve by
 * deliberate product decision (2026-08-23) — there is no organiser
 * approval gate.
 * ---------------------------------------------------------------------- */

export const jobOpenings = pgTable(
  "job_openings",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** Clerk user id of the recruiter who created it. */
    createdBy: varchar("created_by", { length: 64 }).notNull(),

    title: varchar("title", { length: 200 }).notNull(),
    focusArea: focusAreaEnum("focus_area").notNull(),
    /** Student-visible. Role, responsibilities, stipend, location. */
    description: text("description").notNull(),
    /**
     * The recruiter's private description of who they actually want. Fed to
     * the AI scorer alongside the description; NEVER rendered to students.
     */
    screeningPrompt: text("screening_prompt"),

    /**
     * Optional uploaded JD document (PDF or .docx), private blob store —
     * same handling discipline as resumes: opaque key, never a public URL.
     * The scorer reads it as additional context; students get a download
     * link once the student side exists.
     */
    jdBlobKey: text("jd_blob_key"),
    jdFilename: varchar("jd_filename", { length: 200 }),
    jdBytes: integer("jd_bytes"),
    jdContentType: varchar("jd_content_type", { length: 80 }),

    /** Eligibility floor. Null = no CGPA requirement. Same numeric discipline as students.cgpa. */
    minCgpa: numeric("min_cgpa", { precision: 4, scale: 2 }),
    /** Branch codes from content.ts. Empty = all branches eligible. */
    eligibleBranches: text("eligible_branches")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    skills: text("skills").array().notNull().default(sql`ARRAY[]::text[]`),

    status: openingStatusEnum("status").notNull().default("draft"),
    /** Set when the opening first goes live. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("job_openings_company_idx").on(table.companyId),
    index("job_openings_status_idx").on(table.status),
  ],
);

/**
 * One student's application to one opening, plus the AI score it earned.
 *
 * The score lives here rather than in its own table because it is a property
 * of exactly this (opening, student) pair, and `promptHash` records which
 * version of the opening's description + screening prompt produced it — a
 * changed prompt makes the stored score stale, and re-scoring skips rows whose
 * hash still matches.
 */
export const jobApplications = pgTable(
  "job_applications",
  {
    openingId: integer("opening_id")
      .notNull()
      .references(() => jobOpenings.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),

    appliedAt: timestamp("applied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /**
     * The CV this application was submitted with — a permanent snapshot.
     * Replacing or soft-deleting the library entry never changes what the
     * recruiter (or the scorer) sees here. Nullable only for rows that
     * predate the resumes table; the backfill script sets it.
     */
    resumeId: integer("resume_id").references(() => resumes.id),

    /**
     * Student-initiated withdrawal of THIS application. The row stays —
     * the recruiter sees a withdrawn candidate, not a vanished one — and
     * re-applying (only while the opening is live) clears it. A withdrawn
     * REGISTRATION also withdraws every application derivedly; read
     * withdrawal through src/lib/withdrawal.ts, never this column alone.
     */
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),

    /** Recruiter-set interest flag. Null = not yet reviewed. */
    interested: boolean("interested"),

    /** 0–100. Null = not yet scored (or scoring skipped: no resume). */
    score: integer("score"),
    /** Short written justification. Shown to the recruiter, never the student. */
    scoreRationale: text("score_rationale"),
    scoreModel: varchar("score_model", { length: 64 }),
    /** sha256 of the scoring inputs (description + screening prompt) at scoring time. */
    promptHash: varchar("prompt_hash", { length: 64 }),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.openingId, table.studentId] }),
    index("job_applications_student_idx").on(table.studentId),
    index("job_applications_opening_score_idx").on(
      table.openingId,
      table.score,
    ),
  ],
);

/* -------------------------------------------------------------------------
 * Audit log — every read of student PII
 * ---------------------------------------------------------------------- */

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    /** Clerk user id. */
    actor: varchar("actor", { length: 64 }).notNull(),
    actorRole: varchar("actor_role", { length: 24 }).notNull(),
    action: auditActionEnum("action").notNull(),
    /** Target student, when the action concerns one. */
    studentId: integer("student_id").references(() => students.id, {
      onDelete: "set null",
    }),
    /** Company on whose behalf a recruiter acted. */
    companyId: integer("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    detail: text("detail"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_log_actor_idx").on(table.actor),
    index("audit_log_student_idx").on(table.studentId),
    index("audit_log_occurred_idx").on(table.occurredAt),
  ],
);

/* -------------------------------------------------------------------------
 * Recruiter ↔ company membership
 *
 * The authorisation spine: a recruiter may only ever read candidates who
 * to the company they are a member of. Enforced in the query, not the UI.
 * ---------------------------------------------------------------------- */

export const recruiterMemberships = pgTable(
  "recruiter_memberships",
  {
    id: serial("id").primaryKey(),
    /** Clerk user id. */
    userId: varchar("user_id", { length: 64 }).notNull(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    invitedBy: varchar("invited_by", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("recruiter_memberships_user_company_idx").on(
      table.userId,
      table.companyId,
    ),
    index("recruiter_memberships_user_idx").on(table.userId),
  ],
);

/* -------------------------------------------------------------------------
 * Relations
 * ---------------------------------------------------------------------- */

export const companiesRelations = relations(companies, ({ many }) => ({
  problemStatements: many(problemStatements),
  recruiters: many(recruiterMemberships),
  jobOpenings: many(jobOpenings),
}));

export const jobOpeningsRelations = relations(jobOpenings, ({ one, many }) => ({
  company: one(companies, {
    fields: [jobOpenings.companyId],
    references: [companies.id],
  }),
  applications: many(jobApplications),
}));

export const jobApplicationsRelations = relations(
  jobApplications,
  ({ one }) => ({
    opening: one(jobOpenings, {
      fields: [jobApplications.openingId],
      references: [jobOpenings.id],
    }),
    student: one(students, {
      fields: [jobApplications.studentId],
      references: [students.id],
    }),
  }),
);

export const studentsRelations = relations(students, ({ many }) => ({
  paymentOrders: many(paymentOrders),
  resumes: many(resumes),
}));

export const resumesRelations = relations(resumes, ({ one }) => ({
  student: one(students, {
    fields: [resumes.studentId],
    references: [students.id],
  }),
}));

export const paymentOrdersRelations = relations(paymentOrders, ({ one }) => ({
  student: one(students, {
    fields: [paymentOrders.studentId],
    references: [students.id],
  }),
}));

export const problemStatementsRelations = relations(
  problemStatements,
  ({ one }) => ({
    company: one(companies, {
      fields: [problemStatements.companyId],
      references: [companies.id],
    }),
  }),
);

export const recruiterMembershipsRelations = relations(
  recruiterMemberships,
  ({ one }) => ({
    company: one(companies, {
      fields: [recruiterMemberships.companyId],
      references: [companies.id],
    }),
  }),
);

/* -------------------------------------------------------------------------
 * Inferred types
 * ---------------------------------------------------------------------- */

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;
export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type NewPaymentOrder = typeof paymentOrders.$inferInsert;
export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type NewPaymentEvent = typeof paymentEvents.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type ProblemStatement = typeof problemStatements.$inferSelect;
export type AlumniReferral = typeof alumniReferrals.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type JobOpening = typeof jobOpenings.$inferSelect;
export type NewJobOpening = typeof jobOpenings.$inferInsert;
export type JobApplication = typeof jobApplications.$inferSelect;
