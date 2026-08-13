# Implementation Plan: WO-60

**Work Order:** WO-60 - Retire Career Map, preserving the Fit Scoring calculator
**Blueprints:** Action Registry & Store, Fit Scoring

## Why

My Search replaces the "where am I headed" surface with real openings. The
hand-authored archetype map was a diagram of roles nobody had applied to.

## The sensitive part

Fit Scoring must survive. `#FitCalculator` and `#FitRanker` are used by
onboarding today, for the live fit score, and by My Search later, against
`Opening` requirements. The work order is explicit: **the calculator must not be
removed.**

So the line is drawn between the map's furniture and the role catalogue:

| Removed | Kept |
|---|---|
| `/career-map` and `components/career/` | `lib/career-fit.ts`, untouched |
| `pathEdges`, the routes between roles | `pathNodes`, the roles themselves |
| `originNode`, `originTitle`, `youNode` | `stages`, which groups roles in onboarding's picker |
| `path.setTarget/addNode/updateNode/removeNode` | `Requirement` and `PathNode`, which Fit scores against |
| `AppState.paths` | `profile.identity.targetRole` |

`pathNodes` is not "the map's data" once the map is gone: it is the list
onboarding offers as goals and the thing the fit score is scored against. The
work order's "the archetype target data the map fed them is removed" is read as
the map's own furniture, since removing the roles outright would take Fit
Scoring with them, which the same work order forbids.

## The target role

`path.setTarget` wrote two things: the map's `targetId` and the profile's
`targetRole`. Onboarding called it for exactly that reason. With the map gone
there is one place for the goal, so onboarding writes `profile.setIdentity`
alone and the duplication that made `path.setTarget` necessary is gone with it.

## The stored rows

`010_drop_paths` removes the key. Nothing is lost: the only thing in `paths`
worth keeping was the target role, and that was always written to the profile
at the same instant.

## Verification

Onboarding still has to work, which the work order asks to be confirmed
explicitly: the goal picker still lists roles, the live fit score still moves,
and finishing still writes a target role to the profile.
