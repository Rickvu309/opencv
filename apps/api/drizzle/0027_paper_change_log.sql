CREATE TABLE "opencv_app"."paper_changes" (
	"doc_id" uuid NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"edit_id" text NOT NULL,
	"client_id" text NOT NULL,
	"origin_kind" text NOT NULL,
	"origin_actor" text NOT NULL,
	"proposal_id" text,
	"activity_id" uuid,
	"steps" jsonb NOT NULL,
	"inverse" jsonb NOT NULL,
	"commands" jsonb NOT NULL,
	"released_file_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paper_changes_doc_id_from_version_pk" PRIMARY KEY("doc_id","from_version"),
	CONSTRAINT "paper_changes_versions_ascend" CHECK ("opencv_app"."paper_changes"."to_version" > "opencv_app"."paper_changes"."from_version")
);
--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD COLUMN "engine" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD COLUMN "head_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD COLUMN "snapshot_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD COLUMN "first_page" jsonb;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_changes" ADD CONSTRAINT "paper_changes_doc_id_paper_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "opencv_app"."paper_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paper_changes_doc_edit_uidx" ON "opencv_app"."paper_changes" USING btree ("doc_id","edit_id");