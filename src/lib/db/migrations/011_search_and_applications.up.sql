-- `AppState` grew two arrays: real postings, and the applications made from
-- them (WO-55, WO-48).
--
-- The same field-fill as 005 and 006. Guarded by `?`, safe to run against rows
-- that already have the keys, and it touches nothing else in the document.
--
-- `openings` is filled empty rather than with the seed set. The seed belongs to
-- a new account, and pushing four example postings into the row of somebody
-- who has been using the product for a month would read as the app inventing
-- jobs they never looked at. `reviveState` merges the seed for a row that has
-- no key at all, which is the case this leaves for it.

update app_state
   set state = jsonb_set(state, '{openings}', '[]'::jsonb, true),
       updated_at = now()
 where not (state ? 'openings');

update app_state
   set state = jsonb_set(state, '{applications}', '[]'::jsonb, true),
       updated_at = now()
 where not (state ? 'applications');
