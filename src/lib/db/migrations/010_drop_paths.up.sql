-- Career Map is retired (WO-60).
--
-- My Search replaces the "where am I headed" surface with real openings, so
-- the hand-authored archetype map is gone. The Fit Scoring calculator it fed
-- stays: onboarding still scores a live fit, and My Search will score against
-- openings.
--
-- The one thing worth keeping from `paths` was the target role, and that was
-- always written to `profile.identity.targetRole` at the same time, so nothing
-- is lost by dropping the key.

update app_state
   set state = state - 'paths',
       updated_at = now()
 where state ? 'paths';
