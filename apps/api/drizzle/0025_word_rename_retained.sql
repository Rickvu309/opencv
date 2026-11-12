CREATE OR REPLACE FUNCTION "opencv_app"."reject_retained_word_version_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'name') IS DISTINCT FROM (to_jsonb(OLD) - 'name') AND EXISTS (SELECT 1 FROM "opencv_app"."paper_package_candidates" WHERE OLD.revision IN (basis_revision, forward_revision, restore_revision)) THEN
    RAISE EXCEPTION 'Retained Word versions and candidates cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
