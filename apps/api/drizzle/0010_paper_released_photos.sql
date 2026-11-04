ALTER TABLE "opencv_app"."paper_doc_updates" ADD COLUMN "released_photo_refs" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."sync_paper_photo_refs"() RETURNS trigger AS $fn$
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" IN (
			'paper_docs.document:' || OLD."id"::text,
			'paper_docs.crdt_document:' || OLD."id"::text,
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
		'paper_docs.document:' || NEW."id"::text,
		NEW."user_id",
		NEW."document"::text,
		true
	);
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
	RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."sync_update_photo_refs"() RETURNS trigger AS $fn$
DECLARE
	doc record;
	paper uuid;
	released text;
BEGIN
	paper := CASE WHEN TG_OP = 'DELETE' THEN OLD."paper_id" ELSE NEW."paper_id" END;
	SELECT "user_id", "crdt_document" INTO doc
	FROM "opencv_app"."paper_docs"
	WHERE "id" = paper;
	IF NOT FOUND THEN
		RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
	END IF;
	IF doc."crdt_document" IS NOT NULL THEN
		IF TG_OP = 'DELETE' AND COALESCE(cardinality(OLD."released_photo_refs"), 0) = 0 THEN
			RETURN OLD;
		END IF;
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" = 'paper_doc_updates:' || paper::text;
		SELECT string_agg('file:' || file_id::text, ' ')
		INTO released
		FROM (
			SELECT DISTINCT unnest(COALESCE(u."released_photo_refs", ARRAY[]::uuid[])) AS file_id
			FROM "opencv_app"."paper_doc_updates" AS u
			WHERE u."paper_id" = paper
		) AS ids;
		PERFORM "opencv_app"."replace_photo_refs"(
			'paper_doc_updates.released:' || paper::text,
			doc."user_id",
			COALESCE(released, ''),
			true
		);
		RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
	END IF;
	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	PERFORM "opencv_app"."replace_photo_refs"(
		'paper_doc_updates:' || paper::text,
		doc."user_id",
		encode(NEW."update", 'escape'),
		true
	);
	RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "photo_refs_paper_doc_updates_delete"
AFTER DELETE ON "opencv_app"."paper_doc_updates"
FOR EACH ROW EXECUTE FUNCTION "opencv_app"."sync_update_photo_refs"();
