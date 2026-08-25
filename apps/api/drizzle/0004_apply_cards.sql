CREATE TABLE "openpath_app"."apply_cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"stage" text NOT NULL,
	"position" text NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"job_url" text,
	"track_date" date NOT NULL,
	"track_kind" text NOT NULL,
	"fit" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "openpath_app"."paper_docs" ADD COLUMN "apply_card_id" uuid;--> statement-breakpoint
ALTER TABLE "openpath_app"."apply_cards" ADD CONSTRAINT "apply_cards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "openpath_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apply_cards_user_id_stage_position_idx" ON "openpath_app"."apply_cards" USING btree ("user_id","stage","position");--> statement-breakpoint
CREATE INDEX "apply_cards_user_id_track_date_idx" ON "openpath_app"."apply_cards" USING btree ("user_id","track_date");--> statement-breakpoint
ALTER TABLE "openpath_app"."paper_docs" ADD CONSTRAINT "paper_docs_apply_card_id_apply_cards_id_fk" FOREIGN KEY ("apply_card_id") REFERENCES "openpath_app"."apply_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paper_docs_apply_card_id_idx" ON "openpath_app"."paper_docs" USING btree ("apply_card_id");