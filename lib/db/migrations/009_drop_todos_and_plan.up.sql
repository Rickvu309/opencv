-- Todo and Action Plan are retired (WO-58).
--
-- Both shipped and neither was part of the documented product: next-step
-- guidance belongs in the Coach's reply, not in a separate task list somebody
-- has to keep tidy alongside it.
--
-- A field-drop rather than a wipe. Everything else in the row is the user's
-- real work, and `jsonb - 'key'` removes exactly the one key. Idempotent: a
-- row that has already lost the key is unchanged.

update app_state
   set state = state - 'todos' - 'plan',
       updated_at = now()
 where state ? 'todos' or state ? 'plan';
