ALTER TABLE "opencv_app"."paper_doc_updates" ADD COLUMN "based_on" integer;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_doc_updates" ADD COLUMN "touched" jsonb;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_doc_updates" ADD COLUMN "rebuilt" jsonb;