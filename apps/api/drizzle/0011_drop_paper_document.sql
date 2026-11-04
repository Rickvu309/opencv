CREATE OR REPLACE FUNCTION "opencv_app"."sync_paper_photo_refs"() RETURNS trigger AS $fn$
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" IN (
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
DELETE FROM "opencv_app"."photo_refs"
WHERE "source" LIKE 'paper_docs.document:%';
--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" DROP COLUMN "document";
