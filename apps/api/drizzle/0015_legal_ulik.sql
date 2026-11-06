ALTER TABLE "opencv_app"."activity" ADD COLUMN "input_hash" text;--> statement-breakpoint
ALTER TABLE "opencv_app"."idempotency" ADD COLUMN "input_hash" text;