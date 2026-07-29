CREATE TABLE "share_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"accessor_user_id" uuid NOT NULL,
	"granted_by" uuid NOT NULL,
	"first_accessed_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "share_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "share_access_grants" ADD CONSTRAINT "share_access_grants_share_id_share_links_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_access_grants" ADD CONSTRAINT "share_access_grants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_access_grants" ADD CONSTRAINT "share_access_grants_accessor_user_id_profiles_id_fk" FOREIGN KEY ("accessor_user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_access_grants" ADD CONSTRAINT "share_access_grants_granted_by_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "share_grants_share_accessor_idx" ON "share_access_grants" USING btree ("share_id","accessor_user_id") WHERE "share_access_grants"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "share_grants_accessor_project_idx" ON "share_access_grants" USING btree ("accessor_user_id","project_id");