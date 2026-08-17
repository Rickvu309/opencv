# Profile

**Track:** Commodity — LinkedIn-style sectioned profile with inline editing and a completeness meter.

**Job:** the single store of what is true about the user. A fact is captured once and feeds every document, pitch, and fit read; nothing is ever re-entered.

**Layout:** Sectioned editor at `/profile` — identity first, completeness as a fact with its basis inside the first section, never a hero metric. Primary: fill the emptiest section, then the door to the first CV. The dock must not cover it ([layout.md](../layout.md)).

## Concept

Facts (education, experience, skills as context rows, links) and context (target role or "not sure yet", location, time available). Not a daily destination — the Coach fills it from conversation, onboarding seeds it, other features read it. The user can see, correct, and remove everything, including anything the Coach recorded.

## Screens

- Reached from the account control, not the core rail ([flows.md](../flows.md) edge-case nav).
- `/profile` — sections with inline editing: identity and context, experience, education, facts, links (LinkedIn, GitHub, portfolio). A completeness meter that reflects only what the user actually provided. The Coach dock travels here.

## Data

`profiles`, `profile_facts`, `profile_experiences`, `profile_education`, `profile_links` ([data.md](../data.md)).

## Commands

| Command | Agent | What |
|---|---|---|
| `profile.update` | yes | Identity and context scalars: name, target role, location, time available |
| `profile.addFact` / `profile.updateFact` / `profile.removeFact` | yes | Context rows; remove confirms |
| `profile.addExperience` / `profile.updateExperience` / `profile.removeExperience` | yes | Experience entries; detail lines are results, not duties |
| `profile.setEducation` | yes | School, major, year, GPA, courses |
| `profile.setLink` / `profile.removeLink` | yes | External links |

## Coach behaviour

When the user mentions a fact in conversation, the Coach may record it (`profile.addFact`, `profile.addExperience`) — one short confirmation, undo offered. When drafting anywhere, missing facts are asked for, never invented.

## Empty state

"This is what everything else is written from. Add what you have — school, one job or project, one link." One primary action: add the first fact.

## Out of scope

CV or letter slots on the profile (documents live in Paper), file uploads (Paper owns files), public profile pages (share owns `/u/:handle`).
