CREATE TABLE "creative_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creative_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"event_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lyric_revision" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "artist_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "artist_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "creative_context" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "current_lyrics" text;--> statement-breakpoint
ALTER TABLE "creative_conversations" ADD CONSTRAINT "creative_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_conversations" ADD CONSTRAINT "creative_conversations_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_messages" ADD CONSTRAINT "creative_messages_conversation_id_creative_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."creative_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_project_idx" ON "creative_conversations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "conversations_owner_updated_idx" ON "creative_conversations" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "creative_messages" USING btree ("conversation_id","created_at");