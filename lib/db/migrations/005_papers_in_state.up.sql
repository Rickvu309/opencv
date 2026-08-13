-- `AppState` grew a `papers` array when cover letters arrived.
--
-- This is the migration note in WO-24 being honoured rather than quoted: the
-- browser used to discard a stored blob whose shape had moved on, because it
-- was demo data and the cost was a reseed. A row here is somebody's real work,
-- so a shape change is a migration and never a delete.
--
-- Guarded by `?`, so it is safe to run against rows that already have the key,
-- and it touches nothing else in the document.

update app_state
   set state = jsonb_set(state, '{papers}', '[]'::jsonb, true),
       updated_at = now()
 where not (state ? 'papers');
