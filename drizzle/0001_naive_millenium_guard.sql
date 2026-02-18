ALTER TABLE "pr_analyses" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "pr_queue" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "pr_queue" ADD COLUMN "embedding_stored_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "contributed_at";