# Issue tracker: Linear

Issues and specs for this repo live in the Linear project **OpenPath**.

## Conventions

- Create and update work with the Linear CLI (`linear`) or the Linear GraphQL API, scoped to project OpenPath.
- Prefer creating issues in OpenPath (not a different team/project).
- When reading open work, list issues for project OpenPath.
- When writing tickets from `/to-tickets` or `/to-spec`, create them in OpenPath with a clear title and description.
- Labels map to Linear labels on that project/team.
- Do not use GitHub Issues or `.scratch/` for this repo's issue tracker.

## When a skill says "publish to the issue tracker"

Create a Linear issue in project OpenPath.

## When a skill says "fetch the relevant ticket"

Fetch the Linear issue by identifier or URL for project OpenPath.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single Linear issue with **child** issues as tickets, all in project OpenPath.

- **Map**: one issue labelled `wayfinder:map`, holding Notes / Decisions-so-far / Fog.
- **Child ticket**: a sub-issue (or linked child) of the map; label `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`).
- **Blocking**: use Linear's native blocking / dependency relations when available; otherwise a `Blocked by: <id>, <id>` line near the top of the child body.
- **Frontier**: open children of the map with no open blockers and unclaimed; first in map order wins.
- **Claim**: assign to the driving session/user before work.
- **Resolve**: comment the answer, mark done/cancelled as appropriate, then append a context pointer to the map's Decisions-so-far.
