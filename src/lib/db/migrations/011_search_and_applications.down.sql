-- Take the keys back out. The rest of the row is untouched.

update app_state
   set state = state - 'openings' - 'applications',
       updated_at = now()
 where state ? 'openings' or state ? 'applications';
