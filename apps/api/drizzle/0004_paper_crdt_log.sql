CREATE TABLE "opencv_app"."paper_doc_updates" (
	"paper_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"origin" text NOT NULL,
	"edit_id" text,
	"update" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paper_doc_updates_paper_id_seq_pk" PRIMARY KEY("paper_id","seq")
);
--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD COLUMN "crdt_epoch" integer;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD COLUMN "crdt_base" "bytea";--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD COLUMN "crdt_base_seq" integer;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD COLUMN "crdt_document" jsonb;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_doc_updates" ADD CONSTRAINT "paper_doc_updates_paper_id_paper_docs_id_fk" FOREIGN KEY ("paper_id") REFERENCES "opencv_app"."paper_docs"("id") ON DELETE cascade ON UPDATE no action;