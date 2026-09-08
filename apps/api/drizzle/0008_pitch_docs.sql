CREATE TABLE "openpath_app"."pitch_docs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content_kind" text NOT NULL,
	"content" jsonb NOT NULL,
	"content_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "openpath_app"."pitch_docs" ADD CONSTRAINT "pitch_docs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "openpath_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pitch_docs_user_id_uidx" ON "openpath_app"."pitch_docs" USING btree ("user_id");