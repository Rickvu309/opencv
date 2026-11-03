CREATE TABLE "opencv_app"."photo_refs" (
	"user_id" text NOT NULL,
	"file_id" uuid NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "photo_refs_source_file_id_pk" PRIMARY KEY("source","file_id"),
	CONSTRAINT "photo_refs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "opencv_app"."files"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "photo_refs_file_id_idx" ON "opencv_app"."photo_refs" ("file_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."photo_text"(p_json jsonb) RETURNS text AS $fn$
BEGIN
	IF p_json IS NULL THEN
		RETURN '';
	END IF;
	IF jsonb_typeof(p_json) = 'object' THEN
		RETURN (p_json - 'previousDocument' - 'previousPaper')::text;
	END IF;
	RETURN p_json::text;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."activity_photo_text"(p_json jsonb) RETURNS text AS $fn$
BEGIN
	IF p_json IS NULL THEN
		RETURN '';
	END IF;
	IF jsonb_typeof(p_json) = 'object' THEN
		RETURN (p_json - 'document' - 'paper' - 'previousDocument' - 'previousPaper')::text;
	END IF;
	RETURN p_json::text;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."replace_photo_refs"(p_source text, p_user text, p_text text, p_live boolean) RETURNS void AS $fn$
DECLARE
	ids uuid[];
	inserted int;
	missing int;
BEGIN
	DELETE FROM "opencv_app"."photo_refs" WHERE "source" = p_source;
	IF NOT p_live OR p_text IS NULL OR p_text = '' THEN
		RETURN;
	END IF;
	IF p_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
		ids := ARRAY[p_text::uuid];
	ELSE
		SELECT COALESCE(array_agg(DISTINCT file_id), ARRAY[]::uuid[]) INTO ids
		FROM (
			SELECT (hit.item)[1]::uuid AS file_id
			FROM regexp_matches(p_text, 'file:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'gi') AS hit(item)
			UNION
			SELECT (hit.item)[1]::uuid
			FROM regexp_matches(p_text, '"fileId"[[:space:]]*:[[:space:]]*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"', 'gi') AS hit(item)
		) AS found;
	END IF;
	IF current_setting('opencv.photo_refs_backfill', true) = '1' THEN
		INSERT INTO "opencv_app"."photo_refs" ("user_id", "file_id", "source")
		SELECT DISTINCT p_user, f."id", p_source
		FROM unnest(ids) AS found(file_id)
		JOIN "opencv_app"."files" AS f
			ON f."id" = found.file_id AND f."user_id" = p_user;
		RETURN;
	END IF;
	WITH found AS (
		SELECT DISTINCT found_id AS file_id
		FROM unnest(ids) AS found_id
	),
	present AS MATERIALIZED (
		SELECT f."id", f."user_id"
		FROM "opencv_app"."files" AS f
		WHERE f."id" IN (SELECT found.file_id FROM found)
		FOR KEY SHARE OF f
	),
	ins AS (
		INSERT INTO "opencv_app"."photo_refs" ("user_id", "file_id", "source")
		SELECT DISTINCT p_user, present."id", p_source
		FROM present
		WHERE present."user_id" = p_user
		ON CONFLICT DO NOTHING
		RETURNING "file_id"
	)
	SELECT
		(SELECT count(*) FROM ins),
		(SELECT count(*) FROM found
			WHERE NOT EXISTS (
				SELECT 1 FROM present WHERE present."id" = found.file_id
			))
	INTO inserted, missing;
	IF missing > 0 THEN
		RAISE EXCEPTION 'Photo file not found' USING ERRCODE = 'no_data_found';
	END IF;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."sync_paper_photo_refs"() RETURNS trigger AS $fn$
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" IN (
			'paper_docs.document:' || OLD."id"::text,
			'paper_docs.crdt_document:' || OLD."id"::text,
			'paper_doc_updates:' || OLD."id"::text
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
BEGIN
	SELECT "user_id", "crdt_document" INTO doc
	FROM "opencv_app"."paper_docs"
	WHERE "id" = NEW."paper_id";
	IF doc."crdt_document" IS NOT NULL THEN
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" = 'paper_doc_updates:' || NEW."paper_id"::text;
		RETURN NEW;
	END IF;
	PERFORM "opencv_app"."replace_photo_refs"(
		'paper_doc_updates:' || NEW."paper_id"::text,
		doc."user_id",
		encode(NEW."update", 'escape'),
		true
	);
	RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."sync_activity_photo_refs"() RETURNS trigger AS $fn$
DECLARE
	live boolean;
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" IN (
			'activity.reversal_input:' || OLD."id"::text,
			'activity.result:' || OLD."id"::text
		);
		RETURN OLD;
	END IF;
	live := NEW."undone_at" IS NULL;
	PERFORM "opencv_app"."replace_photo_refs"(
		'activity.reversal_input:' || NEW."id"::text,
		NEW."user_id",
		COALESCE(NEW."reversal_input"::text, ''),
		live AND (
			NEW."reversal_input"->>'docId' IS NULL
			OR EXISTS (
				SELECT 1 FROM "opencv_app"."paper_docs" AS d
				WHERE d."id"::text = NEW."reversal_input"->>'docId'
			)
		)
	);
	PERFORM "opencv_app"."replace_photo_refs"(
		'activity.result:' || NEW."id"::text,
		NEW."user_id",
		"opencv_app"."activity_photo_text"(NEW."result"),
		live
	);
	RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."sync_pending_photo_refs"() RETURNS trigger AS $fn$
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "opencv_app"."photo_refs"
		WHERE "source" = 'pending_actions.input:' || OLD."id"::text;
		RETURN OLD;
	END IF;
	PERFORM "opencv_app"."replace_photo_refs"(
		'pending_actions.input:' || NEW."id"::text,
		NEW."user_id",
		NEW."input"::text,
		NEW."status" = 'pending'
	);
	RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."sync_idempotency_photo_refs"() RETURNS trigger AS $fn$
DECLARE
	source text;
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "opencv_app"."photo_refs" WHERE "source" = 'idempotency.result:' || OLD."user_id" || ':' || OLD."key";
		RETURN OLD;
	END IF;
	source := 'idempotency.result:' || NEW."user_id" || ':' || NEW."key";
	PERFORM "opencv_app"."replace_photo_refs"(
		source,
		NEW."user_id",
		"opencv_app"."photo_text"(NEW."result"),
		true
	);
	RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."sync_profile_photo_refs"() RETURNS trigger AS $fn$
BEGIN
	PERFORM "opencv_app"."replace_photo_refs"(
		'user.image:' || NEW."id",
		NEW."id",
		COALESCE(NEW."image", ''),
		true
	);
	RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "opencv_app"."drop_user_photo_refs"() RETURNS trigger AS $fn$
BEGIN
	DELETE FROM "opencv_app"."photo_refs" WHERE "user_id" = OLD."id";
	RETURN OLD;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "photo_refs_paper_docs"
AFTER INSERT OR UPDATE OR DELETE ON "opencv_app"."paper_docs"
FOR EACH ROW EXECUTE FUNCTION "opencv_app"."sync_paper_photo_refs"();
--> statement-breakpoint
CREATE TRIGGER "photo_refs_paper_doc_updates"
AFTER INSERT OR UPDATE ON "opencv_app"."paper_doc_updates"
FOR EACH ROW EXECUTE FUNCTION "opencv_app"."sync_update_photo_refs"();
--> statement-breakpoint
CREATE TRIGGER "photo_refs_activity"
AFTER INSERT OR UPDATE OR DELETE ON "opencv_app"."activity"
FOR EACH ROW EXECUTE FUNCTION "opencv_app"."sync_activity_photo_refs"();
--> statement-breakpoint
CREATE TRIGGER "photo_refs_pending_actions"
AFTER INSERT OR UPDATE OR DELETE ON "opencv_app"."pending_actions"
FOR EACH ROW EXECUTE FUNCTION "opencv_app"."sync_pending_photo_refs"();
--> statement-breakpoint
CREATE TRIGGER "photo_refs_idempotency"
AFTER INSERT OR UPDATE OR DELETE ON "opencv_app"."idempotency"
FOR EACH ROW EXECUTE FUNCTION "opencv_app"."sync_idempotency_photo_refs"();
--> statement-breakpoint
CREATE TRIGGER "photo_refs_user_image"
AFTER INSERT OR UPDATE OF "image" ON "opencv_app"."user"
FOR EACH ROW EXECUTE FUNCTION "opencv_app"."sync_profile_photo_refs"();
--> statement-breakpoint
CREATE TRIGGER "photo_refs_before_user_delete"
BEFORE DELETE ON "opencv_app"."user"
FOR EACH ROW EXECUTE FUNCTION "opencv_app"."drop_user_photo_refs"();
--> statement-breakpoint
SELECT set_config('opencv.photo_refs_backfill', '1', true);
--> statement-breakpoint
UPDATE "opencv_app"."paper_docs" SET "document" = "document";
--> statement-breakpoint
UPDATE "opencv_app"."activity" SET "result" = "result";
--> statement-breakpoint
UPDATE "opencv_app"."pending_actions" SET "input" = "input";
--> statement-breakpoint
UPDATE "opencv_app"."idempotency" SET "result" = "result";
--> statement-breakpoint
UPDATE "opencv_app"."user" SET "image" = "image";
--> statement-breakpoint
SELECT set_config('opencv.photo_refs_backfill', '', true);
