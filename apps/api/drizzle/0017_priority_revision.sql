ALTER TABLE "opencv_app"."jobs" ADD COLUMN "priority_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "opencv_app"."pending_actions" ADD COLUMN "basis_revision" integer;