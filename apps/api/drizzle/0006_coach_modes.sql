ALTER TABLE "openpath_app"."coach_usage" ADD COLUMN "mode" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "openpath_app"."user" ADD COLUMN "coach_mode" text DEFAULT 'free' NOT NULL;