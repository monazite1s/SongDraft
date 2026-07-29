CREATE TABLE "generation_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"object_key" text,
	"audio_url" text,
	"duration_ms" integer NOT NULL,
	"execution_kind" "execution_kind" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"saved_version_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_candidates" ADD CONSTRAINT "generation_candidates_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_candidates" ADD CONSTRAINT "generation_candidates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_candidates" ADD CONSTRAINT "generation_candidates_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_candidates" ADD CONSTRAINT "generation_candidates_saved_version_id_demo_versions_id_fk" FOREIGN KEY ("saved_version_id") REFERENCES "public"."demo_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidates_project_created_idx" ON "generation_candidates" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "candidates_job_idx" ON "generation_candidates" USING btree ("job_id");