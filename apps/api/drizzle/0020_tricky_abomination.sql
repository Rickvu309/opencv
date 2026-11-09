DO $migration$
BEGIN
CREATE TABLE "opencv_app"."paper_package_candidates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"doc_id" uuid NOT NULL,
	"incarnation" uuid NOT NULL,
	"basis_revision" uuid NOT NULL,
	"forward_revision" uuid NOT NULL,
	"restore_revision" uuid NOT NULL,
	"seal" jsonb NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "opencv_app"."paper_package_candidates" ADD CONSTRAINT "paper_package_candidates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "opencv_app"."paper_package_candidates" ADD CONSTRAINT "paper_package_candidate_basis_fk" FOREIGN KEY ("doc_id","user_id","incarnation","basis_revision") REFERENCES "opencv_app"."paper_package_versions"("doc_id","user_id","incarnation","revision") ON DELETE no action ON UPDATE no action;
ALTER TABLE "opencv_app"."paper_package_candidates" ADD CONSTRAINT "paper_package_candidate_forward_fk" FOREIGN KEY ("doc_id","user_id","incarnation","forward_revision") REFERENCES "opencv_app"."paper_package_versions"("doc_id","user_id","incarnation","revision") ON DELETE no action ON UPDATE no action;
ALTER TABLE "opencv_app"."paper_package_candidates" ADD CONSTRAINT "paper_package_candidate_restore_fk" FOREIGN KEY ("doc_id","user_id","incarnation","restore_revision") REFERENCES "opencv_app"."paper_package_versions"("doc_id","user_id","incarnation","revision") ON DELETE no action ON UPDATE no action;
CREATE INDEX "paper_package_candidates_owner_idx" ON "opencv_app"."paper_package_candidates" USING btree ("user_id");
CREATE FUNCTION "opencv_app"."reject_retained_word_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Retained Word versions and candidates cannot be changed';
END;
$$;
CREATE TRIGGER "paper_package_candidates_immutable" BEFORE UPDATE ON "opencv_app"."paper_package_candidates" FOR EACH ROW EXECUTE FUNCTION "opencv_app"."reject_retained_word_update"();
CREATE FUNCTION "opencv_app"."reject_retained_word_version_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "opencv_app"."paper_package_candidates" WHERE OLD.revision IN (basis_revision, forward_revision, restore_revision)) THEN
    RAISE EXCEPTION 'Retained Word versions and candidates cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "paper_package_versions_immutable" BEFORE UPDATE ON "opencv_app"."paper_package_versions" FOR EACH ROW EXECUTE FUNCTION "opencv_app"."reject_retained_word_version_update"();
CREATE FUNCTION "opencv_app"."reject_package_file_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "opencv_app"."paper_package_versions" v JOIN "opencv_app"."paper_package_candidates" c ON v.revision IN (c.basis_revision, c.forward_revision, c.restore_revision) WHERE v.file_id = OLD.id) THEN
    RAISE EXCEPTION 'Retained Word files cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "paper_package_files_immutable" BEFORE UPDATE ON "opencv_app"."files" FOR EACH ROW EXECUTE FUNCTION "opencv_app"."reject_package_file_update"();
END;
$migration$;
