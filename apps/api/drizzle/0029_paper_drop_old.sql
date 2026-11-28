CREATE OR REPLACE FUNCTION "opencv_app"."sync_paper_photo_refs"() RETURNS trigger AS $fn$
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" IN (
			'paper_docs.snapshot:' || OLD."id"::text,
			'paper_docs.first_page:' || OLD."id"::text
		);
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" IN (
			SELECT 'activity.reversal_input:' || a."id"::text
			FROM "opencv_app"."activity" AS a
			WHERE a."reversal_input"->>'docId' = OLD."id"::text
		);
		RETURN OLD;
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
ALTER TABLE "opencv_app"."jobs" DROP CONSTRAINT "jobs_cv_package_id_paper_package_heads_doc_id_fk";--> statement-breakpoint
ALTER TABLE "opencv_app"."jobs" DROP CONSTRAINT "jobs_letter_package_id_paper_package_heads_doc_id_fk";--> statement-breakpoint
ALTER TABLE "opencv_app"."jobs" DROP COLUMN "cv_package_id";--> statement-breakpoint
ALTER TABLE "opencv_app"."jobs" DROP COLUMN "letter_package_id";--> statement-breakpoint
DROP TABLE "opencv_app"."paper_doc_updates" CASCADE;--> statement-breakpoint
DROP FUNCTION "opencv_app"."sync_update_photo_refs"();--> statement-breakpoint
DROP TRIGGER "paper_package_files_immutable" ON "opencv_app"."files";--> statement-breakpoint
DROP FUNCTION "opencv_app"."reject_package_file_update"();--> statement-breakpoint
DROP TABLE "opencv_app"."paper_package_candidates" CASCADE;--> statement-breakpoint
DROP TABLE "opencv_app"."paper_package_trash" CASCADE;--> statement-breakpoint
DROP TABLE "opencv_app"."paper_package_heads" CASCADE;--> statement-breakpoint
DROP TABLE "opencv_app"."paper_package_versions" CASCADE;--> statement-breakpoint
DROP FUNCTION "opencv_app"."reject_retained_word_update"();--> statement-breakpoint
DROP FUNCTION "opencv_app"."reject_retained_word_version_update"();--> statement-breakpoint
DELETE FROM "opencv_app"."files" WHERE "purpose" = 'package';--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" DROP COLUMN "crdt_epoch";--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" DROP COLUMN "crdt_base";--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" DROP COLUMN "crdt_base_seq";--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" DROP COLUMN "crdt_document";--> statement-breakpoint
DELETE FROM "opencv_app"."photo_refs" WHERE "source" LIKE 'paper_docs.crdt_document:%' OR "source" LIKE 'paper_doc_updates:%' OR "source" LIKE 'paper_doc_updates.released:%';
