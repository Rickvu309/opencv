-- Put the keys back, empty.
--
-- The content cannot come back: it was removed, not archived. What this
-- restores is the shape, so a rolled-back build's shape check passes and the
-- rest of the row is still readable.

update app_state
   set state = state
       || jsonb_build_object('todos', '[]'::jsonb)
       || jsonb_build_object('plan', jsonb_build_object('stages', '[]'::jsonb)),
       updated_at = now()
 where not (state ? 'todos') or not (state ? 'plan');
