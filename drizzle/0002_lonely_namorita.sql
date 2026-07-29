CREATE TYPE "public"."inspiration_record_kind" AS ENUM('audio', 'image', 'text');--> statement-breakpoint
CREATE TYPE "public"."inspiration_snapshot_reason" AS ENUM('autosave', 'manual', 'restore', 'attach');--> statement-breakpoint
CREATE TABLE "inspiration_record_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"reason" "inspiration_snapshot_reason" DEFAULT 'autosave' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspiration_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text,
	"primary_kind" "inspiration_record_kind" NOT NULL,
	"summary" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current_content_hash" text NOT NULL,
	"version_count" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspiration_assets" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inspiration_assets" ADD COLUMN "record_id" uuid;--> statement-breakpoint
ALTER TABLE "inspiration_record_versions" ADD CONSTRAINT "inspiration_record_versions_record_id_inspiration_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."inspiration_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspiration_record_versions" ADD CONSTRAINT "inspiration_record_versions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspiration_records" ADD CONSTRAINT "inspiration_records_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspiration_records" ADD CONSTRAINT "inspiration_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inspiration_record_versions_number_idx" ON "inspiration_record_versions" USING btree ("record_id","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "inspiration_record_versions_hash_idx" ON "inspiration_record_versions" USING btree ("record_id","content_hash");--> statement-breakpoint
CREATE INDEX "inspiration_records_owner_updated_idx" ON "inspiration_records" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "inspiration_records_owner_project_updated_idx" ON "inspiration_records" USING btree ("owner_id","project_id","updated_at");--> statement-breakpoint
CREATE INDEX "inspiration_records_owner_kind_updated_idx" ON "inspiration_records" USING btree ("owner_id","primary_kind","updated_at");--> statement-breakpoint
ALTER TABLE "inspiration_assets" ADD CONSTRAINT "inspiration_assets_record_id_inspiration_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."inspiration_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_record_created_idx" ON "inspiration_assets" USING btree ("record_id","created_at");--> statement-breakpoint
ALTER TABLE "inspiration_assets" ADD CONSTRAINT "assets_project_or_record_check" CHECK ("inspiration_assets"."project_id" IS NOT NULL OR "inspiration_assets"."record_id" IS NOT NULL);