-- Take the key back out, so the shape matches the code this rolls back to.
--
-- This does delete data: a cover letter written after the migration ran is
-- inside `papers` and goes with it. That is what rolling back a field means,
-- and it is the reason a rollback is something a person does while watching.

update app_state
   set state = state - 'papers',
       updated_at = now()
 where state ? 'papers';
