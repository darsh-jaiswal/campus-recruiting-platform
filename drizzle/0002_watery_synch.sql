ALTER TABLE "job_openings" ADD COLUMN "jd_blob_key" text;--> statement-breakpoint
ALTER TABLE "job_openings" ADD COLUMN "jd_filename" varchar(200);--> statement-breakpoint
ALTER TABLE "job_openings" ADD COLUMN "jd_bytes" integer;--> statement-breakpoint
ALTER TABLE "job_openings" ADD COLUMN "jd_content_type" varchar(80);