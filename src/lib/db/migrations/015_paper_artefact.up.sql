-- Paper is one artefact. CVs lived in `resumes`, letters in `papers`. Both
-- become `paper[]`, with a `type` field. Photo rows follow the same rename.
--
-- Somebody's real work is in this JSON. A shape change is a rewrite, never a
-- delete. Ids stay so a photo still matches the CV it belongs to.
--
-- Safe to run twice: once `resumes` and `papers` are gone and `paper` is
-- present, the WHERE clause skips the row.

create or replace function migrate_paper_artefact(s jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  out_paper jsonb := '[]'::jsonb;
  seen text[] := '{}';
  elem jsonb;
  typed jsonb;
  id text;
  src jsonb;
begin
  src := coalesce(case when jsonb_typeof(s->'paper') = 'array' then s->'paper' end, '[]'::jsonb)
      || coalesce(case when jsonb_typeof(s->'resumes') = 'array' then s->'resumes' end, '[]'::jsonb)
      || coalesce(case when jsonb_typeof(s->'papers') = 'array' then s->'papers' end, '[]'::jsonb);

  for elem in select value from jsonb_array_elements(src)
  loop
    id := elem->>'id';
    if id is null or id = any(seen) then
      continue;
    end if;

    typed := case
      when elem->>'type' in ('cv', 'letter', 'write-up') then elem - 'kind'
      when elem ? 'sections' and elem ? 'header' then (elem - 'kind') || '{"type":"cv"}'::jsonb
      when elem->>'kind' = 'cover-letter' then (elem - 'kind') || '{"type":"letter"}'::jsonb
      when elem->>'kind' = 'project-write-up' then (elem - 'kind') || '{"type":"write-up"}'::jsonb
      else null
    end;

    if typed is null then
      continue;
    end if;

    seen := array_append(seen, id);
    out_paper := out_paper || jsonb_build_array(typed);
  end loop;

  return (s - 'resumes' - 'papers') || jsonb_build_object('paper', out_paper);
end;
$$;

update app_state
   set state = migrate_paper_artefact(state),
       updated_at = now()
 where state ? 'resumes'
    or state ? 'papers'
    or not (state ? 'paper');

drop function migrate_paper_artefact(jsonb);

alter table if exists cv_photos rename to paper_photos;
alter table if exists paper_photos rename column resume_id to paper_id;
