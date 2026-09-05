CREATE TYPE "public"."opening_status" AS ENUM('draft', 'live', 'closed');--> statement-breakpoint
CREATE TYPE "public"."payment_order_status" AS ENUM('created', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending_payment', 'paid', 'failed');--> statement-breakpoint
CREATE TABLE "job_applications" (
	"opening_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"interested" boolean,
	"score" integer,
	"score_rationale" text,
	"score_model" varchar(64),
	"prompt_hash" varchar(64),
	"scored_at" timestamp with time zone,
	CONSTRAINT "job_applications_opening_id_student_id_pk" PRIMARY KEY("opening_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "job_openings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"created_by" varchar(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"focus_area" "focus_area" NOT NULL,
	"description" text NOT NULL,
	"screening_prompt" text,
	"min_cgpa" numeric(4, 2),
	"eligible_branches" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"skills" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" "opening_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"razorpay_order_id" varchar(64),
	"event_type" varchar(64) NOT NULL,
	"signature_valid" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"razorpay_order_id" varchar(64) NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'INR' NOT NULL,
	"status" "payment_order_status" DEFAULT 'created' NOT NULL,
	"razorpay_payment_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "ref_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "clerk_user_id" varchar(64);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "payment_status" "payment_status" DEFAULT 'pending_payment' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "confirmation_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "reminders_sent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_opening_id_job_openings_id_fk" FOREIGN KEY ("opening_id") REFERENCES "public"."job_openings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_applications_student_idx" ON "job_applications" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "job_applications_opening_score_idx" ON "job_applications" USING btree ("opening_id","score");--> statement-breakpoint
CREATE INDEX "job_openings_company_idx" ON "job_openings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "job_openings_status_idx" ON "job_openings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_events_order_idx" ON "payment_events" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "payment_events_received_idx" ON "payment_events" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_razorpay_order_idx" ON "payment_orders" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "payment_orders_student_idx" ON "payment_orders" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "payment_orders_status_idx" ON "payment_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "students_clerk_user_idx" ON "students" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "students_payment_status_idx" ON "students" USING btree ("payment_status");