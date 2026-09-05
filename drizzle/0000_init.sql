CREATE TYPE "public"."audit_action" AS ENUM('view_student', 'view_resume', 'export_csv', 'view_bundle');--> statement-breakpoint
CREATE TYPE "public"."company_source" AS ENUM('self_serve', 'alumni_referral', 'placement_cell', 'research');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('lead', 'contacted', 'interested', 'committed', 'onboarded');--> statement-breakpoint
CREATE TYPE "public"."focus_area" AS ENUM('core_dev', 'aiml', 'robotics', 'other');--> statement-breakpoint
CREATE TYPE "public"."outreach_channel" AS ENUM('email', 'call', 'linkedin', 'meeting', 'referral', 'other');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('registered', 'screened', 'shortlisted', 'interviewed', 'selected', 'rejected');--> statement-breakpoint
CREATE TABLE "alumni_referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"alum_name" varchar(120) NOT NULL,
	"batch" varchar(16),
	"branch" varchar(16),
	"company" varchar(160),
	"role" varchar(120),
	"email" varchar(160),
	"linkedin" varchar(200),
	"hiring_interest" boolean DEFAULT false NOT NULL,
	"notes" text,
	"promoted_company_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" varchar(64) NOT NULL,
	"actor_role" varchar(24) NOT NULL,
	"action" "audit_action" NOT NULL,
	"student_id" integer,
	"company_id" integer,
	"detail" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundle_students" (
	"bundle_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"interested" boolean,
	"recruiter_note" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_students_bundle_id_student_id_pk" PRIMARY KEY("bundle_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "bundles" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"focus_area" "focus_area" NOT NULL,
	"cgpa_threshold" numeric(4, 2),
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"website" varchar(200),
	"contact_name" varchar(120),
	"contact_email" varchar(160),
	"contact_phone" varchar(20),
	"stipend_min" integer,
	"ppo_track" boolean DEFAULT false NOT NULL,
	"status" "company_status" DEFAULT 'lead' NOT NULL,
	"source" "company_source" DEFAULT 'self_serve' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"actor" varchar(64) NOT NULL,
	"channel" "outreach_channel" NOT NULL,
	"note" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "problem_statements" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"focus_area" "focus_area" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruiter_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"company_id" integer NOT NULL,
	"invited_by" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref_code" varchar(12) NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"email" varchar(160) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"branch" varchar(16) NOT NULL,
	"programme" varchar(16) NOT NULL,
	"year" varchar(16) NOT NULL,
	"cgpa" numeric(4, 2) NOT NULL,
	"focus_area" "focus_area" NOT NULL,
	"skills" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"resume_blob_key" text,
	"resume_filename" varchar(200),
	"resume_bytes" integer,
	"status" "student_status" DEFAULT 'registered' NOT NULL,
	"notes" text,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alumni_referrals" ADD CONSTRAINT "alumni_referrals_promoted_company_id_companies_id_fk" FOREIGN KEY ("promoted_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_students" ADD CONSTRAINT "bundle_students_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_students" ADD CONSTRAINT "bundle_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_log" ADD CONSTRAINT "outreach_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_statements" ADD CONSTRAINT "problem_statements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiter_memberships" ADD CONSTRAINT "recruiter_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alumni_referrals_hiring_idx" ON "alumni_referrals" USING btree ("hiring_interest");--> statement-breakpoint
CREATE INDEX "alumni_referrals_promoted_idx" ON "alumni_referrals" USING btree ("promoted_company_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor");--> statement-breakpoint
CREATE INDEX "audit_log_student_idx" ON "audit_log" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "audit_log_occurred_idx" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "bundle_students_student_idx" ON "bundle_students" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "bundles_company_idx" ON "bundles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bundles_released_idx" ON "bundles" USING btree ("released_at");--> statement-breakpoint
CREATE INDEX "companies_status_idx" ON "companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "companies_source_idx" ON "companies" USING btree ("source");--> statement-breakpoint
CREATE INDEX "outreach_log_company_idx" ON "outreach_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "outreach_log_occurred_idx" ON "outreach_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "problem_statements_company_idx" ON "problem_statements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "problem_statements_focus_area_idx" ON "problem_statements" USING btree ("focus_area");--> statement-breakpoint
CREATE UNIQUE INDEX "recruiter_memberships_user_company_idx" ON "recruiter_memberships" USING btree ("user_id","company_id");--> statement-breakpoint
CREATE INDEX "recruiter_memberships_user_idx" ON "recruiter_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_ref_code_idx" ON "students" USING btree ("ref_code");--> statement-breakpoint
CREATE UNIQUE INDEX "students_email_idx" ON "students" USING btree ("email");--> statement-breakpoint
CREATE INDEX "students_cgpa_idx" ON "students" USING btree ("cgpa");--> statement-breakpoint
CREATE INDEX "students_branch_idx" ON "students" USING btree ("branch");--> statement-breakpoint
CREATE INDEX "students_focus_area_idx" ON "students" USING btree ("focus_area");--> statement-breakpoint
CREATE INDEX "students_status_idx" ON "students" USING btree ("status");