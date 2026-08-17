-- Take the key back out. This deletes any pitch item written since the
-- migration ran, which is what rolling back a field means.

update app_state
   set state = state - 'pitch',
       updated_at = now()
 where state ? 'pitch';
