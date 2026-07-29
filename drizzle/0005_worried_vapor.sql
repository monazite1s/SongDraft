ALTER TABLE "creative_briefs" ADD COLUMN "prompt_version" text;--> statement-breakpoint
ALTER TABLE "generation_candidates" ADD COLUMN "prompt_version" text;--> statement-breakpoint
ALTER TABLE "generation_candidates" ADD COLUMN "model_version" text;