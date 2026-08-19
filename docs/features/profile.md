# Profile

**Track:** Commodity — LinkedIn-style sectioned profile. Four blocks: identity, school, work, links.

**Job:** the single store of what is true about the user. Onboarding writes name, goal, school, and one link; work is the fifth field because Paper needs a role. A fact is captured once and feeds every document, pitch, and fit read; nothing is ever re-entered.

**Layout:** Sectioned editor at `/profile` — identity, school, work, links. Band title **Profile**; one line under it: "Paper and Coach read this." No global primary. The dock must not cover the fields ([layout.md](../design-system/layout.md)).

## Concept

Identity (name, target role), school, work, and three links. Not a daily destination — the Coach fills it from conversation, onboarding seeds it, other features read it. The user can see, correct, and remove everything, including anything the Coach recorded.

## Screens

- Reached from the account control, not the core rail ([flows.md](../flows.md) edge-case nav).
- `/profile` — Lab form layout, stacked sections, `max-w-xl`, never columns. Band title **Profile**, meta "Paper and Coach read this." Identity is FieldRows (name, target role) that autosave on blur. School is empty until **Add school**, then School / major / year FieldRows in place — no view/edit mode. Work is a list of `org · role` with Edit / Remove; empty is outline **Add experience**, which inserts blank org + role and focuses org. Links are three always-visible FieldRows (LinkedIn, GitHub, Portfolio). Completeness is not shown here. Destructive experience removes confirm. The Coach dock travels here.

## Data

`profiles`, `profile_facts`, `profile_experiences`, `profile_education`, `profile_links` ([data.md](../data.md)). Completeness still exists as a helper for Search and onboarding; this page does not render it.

## Commands

| Command | Agent | What |
|---|---|---|
| `profile.update` | yes | Identity scalars. Blank target role stores `null` |
| `profile.addFact` / `profile.updateFact` / `profile.removeFact` | yes | Context rows the Coach may record; not edited on this page |
| `profile.addExperience` / `profile.updateExperience` / `profile.removeExperience` | yes | Experience entries; add inserts empty org + role; remove confirms |
| `profile.setEducation` | yes | School, major, year (GPA and courses preserved, not shown here) |
| `profile.setLink` / `profile.removeLink` | yes | External links; this page sets LinkedIn, GitHub, and Portfolio, empty URL allowed |

## Coach behaviour

When the user mentions a fact in conversation, the Coach may record it (`profile.addFact`, `profile.addExperience`) — one short confirmation, undo offered. When drafting anywhere, missing facts are asked for, never invented.

## Empty state

A short line only when name, target role, school, work, and links are all empty: "Name, school, one job, one link. That's the start." School empty is **Add school**. Work empty is **Add experience**.

## Out of scope

CV or letter slots on the profile (documents live in Paper), file uploads (Paper owns files), public profile pages (share owns `/u/:handle`), completeness meter, facts / location / time available / summary / GPA / courses on this page.
