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
CREATE UNIQUE INDEX "paper_changes_doc_edit_uidx" ON "opencv_app"."paper_changes" USING btree ("doc_id","edit_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."sync_paper_photo_refs"() RETURNS trigger AS $fn$
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" IN (
			'paper_docs.crdt_document:' || OLD."id"::text,
			'paper_docs.snapshot:' || OLD."id"::text,
			'paper_docs.first_page:' || OLD."id"::text,
			'paper_doc_updates:' || OLD."id"::text,
			'paper_doc_updates.released:' || OLD."id"::text
		);
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" IN (
			SELECT 'activity.reversal_input:' || a."id"::text
			FROM "opencv_app"."activity" AS a
			WHERE a."reversal_input"->>'docId' = OLD."id"::text
		);
		RETURN OLD;
	END IF;
	PERFORM "opencv_app"."replace_photo_refs"(
		'paper_docs.crdt_document:' || NEW."id"::text,
		NEW."user_id",
		COALESCE(NEW."crdt_document"::text, ''),
		true
	);
	IF NEW."crdt_document" IS NOT NULL THEN
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" = 'paper_doc_updates:' || NEW."id"::text;
	END IF;
	IF TG_OP = 'INSERT' OR NEW."snapshot" IS DISTINCT FROM OLD."snapshot" OR NEW."user_id" IS DISTINCT FROM OLD."user_id" THEN
		PERFORM "opencv_app"."replace_photo_refs"(
			'paper_docs.snapshot:' || NEW."id"::text,
			NEW."user_id",
			COALESCE(NEW."snapshot"::text, ''),
			true
		);
	END IF;
	IF TG_OP = 'INSERT' OR NEW."first_page" IS DISTINCT FROM OLD."first_page" OR NEW."user_id" IS DISTINCT FROM OLD."user_id" THEN
		PERFORM "opencv_app"."replace_photo_refs"(
			'paper_docs.first_page:' || NEW."id"::text,
			NEW."user_id",
			COALESCE(NEW."first_page"::text, ''),
			true
		);
	END IF;
	RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."sync_change_photo_refs"() RETURNS trigger AS $fn$
DECLARE
	gone text;
	kept text;
	owner text;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		gone := OLD."doc_id"::text || ':' || OLD."from_version"::text;
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" IN (
			'paper_changes.steps:' || gone,
			'paper_changes.inverse:' || gone,
			'paper_changes.commands:' || gone
		);
	END IF;
	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	SELECT "user_id" INTO owner FROM "opencv_app"."paper_docs" WHERE "id" = NEW."doc_id";
	kept := NEW."doc_id"::text || ':' || NEW."from_version"::text;
	PERFORM "opencv_app"."replace_photo_refs"('paper_changes.steps:' || kept, owner, NEW."steps"::text, true);
	PERFORM "opencv_app"."replace_photo_refs"('paper_changes.inverse:' || kept, owner, NEW."inverse"::text, true);
	PERFORM "opencv_app"."replace_photo_refs"('paper_changes.commands:' || kept, owner, NEW."commands"::text, true);
	RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "photo_refs_paper_changes"
AFTER INSERT OR UPDATE OR DELETE ON "opencv_app"."paper_changes"
FOR EACH ROW EXECUTE FUNCTION "opencv_app"."sync_change_photo_refs"();
