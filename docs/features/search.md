# Search

**Track:** Commodity — Teal / Huntr patterns: a focused, fit-ranked list rather than a job board flood.

**Job:** a short set of real openings ranked against the user's profile, each with an honest read of what is met and what is missing — so the gap reads as a to-do, not a verdict.

**Layout:** Drive list at `/search`; an opening's detail is in-page state in the same column, not a URL. Primary: the query; on a detail, Save to Apply. The dock must not cover either ([layout.md](../design-system/layout.md)).

## Concept

Focus and honesty over volume. Openings arrive two ways: the user pastes a posting (text or link), or ingestion jobs bring in openings matched to the profile (worker-fed, source adapters added over time). Every opening gets requirement lines extracted and a fit read computed against the profile. Fit is never a bare number: it is met-versus-total with the missing requirements named, and a requirement that no profile could evidence is excluded rather than counted as failed.

## Screens

- Reached from Opportunities in the rail, next to Apply ([flows.md](../flows.md)).
- `/search` — the ranked list, best fit first, with text search and simple filters (location, kind). Each row: title, company, fit as a sentence ("Fit 4 of 6 — misses Excel."). Opening detail is in-page state in the same column (no detail URL): Back returns to the list; requirement lines, met and missing marked, the gap named; primary is Save to Apply; the Coach door opens the dock with a prefilled intent to close the gap.

## Data

`openings` ([data.md](../data.md)): `raw_text` as pasted, `requirements` JSONB (extracted lines), `fit` JSONB (per-requirement met/missing plus the summary — the working is stored, not just the score).

## Commands

| Command | Agent | What |
|---|---|---|
| `opening.add` | yes | Paste a posting as text or link; extraction and scoring run on it. The Coach passes text verbatim — the requirement lines are what gets scored |
| `opening.refresh` | yes | Re-score after the profile changed |
| `opening.remove` | yes | Destructive: confirm first |

Saving an opening is `application.create` ([application.md](application.md)) — the moment an opening graduates into something the user works.

## AI

`ai.server.ts`: extract requirement lines from posting text (`extraction` role); score fit against the profile with per-requirement working (`scoring` role). Ingestion jobs run both on the worker.

## Coach behaviour

When the user sends a posting or link, `opening.add` with the text as sent — no summarising first. On fit, the Coach's job is what is missing and how to close it, not reassurance. It never softens a gap and never inflates a score.

## Empty states

- Profile too thin to rank: "Fit needs something to read. Add a fact or set a goal first." One door: open Profile (both live there).
- No openings: "Paste a posting you're looking at, and you'll see how you match." Primary action: paste one.

## Out of scope

Scraping at scale, hundreds of listings, alerts and saved searches (notifications handles deadline nudges), employer-side postings.
