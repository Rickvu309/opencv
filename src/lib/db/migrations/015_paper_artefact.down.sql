-- Reverse of 015: photos go back to cv_photos/resume_id, and `paper[]` splits
-- into the old `resumes` + `papers` keys.

create or replace function revert_paper_artefact(s jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  cvs jsonb := '[]'::jsonb;
  letters jsonb := '[]'::jsonb;
  elem jsonb;
  stripped jsonb;
begin
  for elem in select value from jsonb_array_elements(coalesce(s->'paper', '[]'::jsonb))
  loop
    if elem->>'type' = 'cv' or (elem ? 'sections' and elem ? 'header') then
      stripped := (elem - 'type') ;
      cvs := cvs || jsonb_build_array(stripped);
    elsif elem->>'type' = 'letter' then
      letters := letters || jsonb_build_array((elem - 'type') || '{"kind":"cover-letter"}'::jsonb);
    elsif elem->>'type' = 'write-up' then
      letters := letters || jsonb_build_array((elem - 'type') || '{"kind":"project-write-up"}'::jsonb);
    elsif elem->>'kind' = 'cover-letter' or elem->>'kind' = 'project-write-up' then
      letters := letters || jsonb_build_array(elem);
    end if;
  end loop;

  return (s - 'paper')
      || jsonb_build_object('resumes', cvs, 'papers', letters);
end;
$$;

update app_state
   set state = revert_paper_artefact(state),
       updated_at = now()
 where state ? 'paper';

drop function revert_paper_artefact(jsonb);

alter table if exists paper_photos rename column paper_id to resume_id;
alter table if exists paper_photos rename to cv_photos;
