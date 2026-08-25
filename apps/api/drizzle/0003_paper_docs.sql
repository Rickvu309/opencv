CREATE TABLE "openpath_app"."paper_docs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"content_kind" text NOT NULL,
	"content" jsonb NOT NULL,
	"content_version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "openpath_app"."paper_docs" ADD CONSTRAINT "paper_docs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "openpath_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paper_docs_user_id_updated_at_idx" ON "openpath_app"."paper_docs" USING btree ("user_id","updated_at");