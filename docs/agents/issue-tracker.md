# Issue tracker: Linear

Issues and specs for this repo live in the Linear project **OpenCV** (renamed in place; the URL slug `opencv-2f6ea8fa4fa8` and the team key `QVE` are unchanged). The GitHub repo is `quanvu309/opencv`.

## Conventions

- Create and update work with the Linear CLI (`linear`) or the Linear GraphQL API, scoped to project OpenCV.
- Prefer creating issues in OpenCV (not a different team/project).
- When reading open work, list issues for project OpenCV.
- When writing tickets from `/to-tickets` or `/to-spec`, create them in OpenCV with a clear title and description.
- Labels map to Linear labels on that project/team.
- Do not use GitHub Issues or `.scratch/` for this repo's issue tracker.

## When a skill says "publish to the issue tracker"

Create a Linear issue in project OpenCV.

## When a skill says "fetch the relevant ticket"

Fetch the Linear issue by identifier or URL for project OpenCV.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single Linear issue with **child** issues as tickets, all in project OpenCV.

- **Map**: one issue labelled `wayfinder:map`, holding Notes / Decisions-so-far / Fog.
- **Child ticket**: a sub-issue (or linked child) of the map; label `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`).
- **Blocking**: use Linear's native blocking / dependency relations when available; otherwise a `Blocked by: <id>, <id>` line near the top of the child body.
- **Frontier**: open children of the map with no open blockers and unclaimed; first in map order wins.
- **Claim**: assign to the driving session/user before work.
- **Resolve**: comment the answer, mark done/cancelled as appropriate, then append a context pointer to the map's Decisions-so-far.
