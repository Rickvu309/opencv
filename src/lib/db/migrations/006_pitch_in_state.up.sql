-- `AppState` grew a `pitch` array when the bio, the self-introduction and the
-- interview answer bank arrived.
--
-- Same shape as 005, and the same reason: a field appearing is a migration,
-- never a reason to drop somebody's row. Guarded by `?` so it is safe to run
-- twice, and it touches nothing else in the document.

update app_state
   set state = jsonb_set(state, '{pitch}', '[]'::jsonb, true),
       updated_at = now()
 where not (state ? 'pitch');
