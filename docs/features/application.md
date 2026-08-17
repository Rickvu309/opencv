# Application

**Track:** Commodity — Teal / Huntr tracker patterns: a status pipeline with notes, deadlines, and per-application materials.

**Job:** turn a decision to pursue an opening into a managed process with a clear state and a clear next action, through to an outcome.

**Layout:** Drive list at `/applications`, grouped by status; the row is the unit and status is a control on it, not a second page. No global primary. The dock must not cover row actions ([layout.md](../layout.md)).

## Concept

The place is **Apply** (verb). The feature module stays `application`; the route stays `/applications` until a later rename. The word Applications does not appear in the UI.

An application is a saved opening the user is working. It carries a status, notes, a deadline, and links to the tailored CV and letter made for it. Tailoring always copies from the master in Paper — the original never changes underneath the user. The Coach suggests the next step per application but never moves a status on its own; status changes only when the user says reality changed.

In the rail, Apply sits under **Opportunities** next to Search ([flows.md](../flows.md)). Saving an opening is a C3 hand-off from Search; tailoring is a C3 hand-off into Paper.

## Screens

- Reached from Opportunities in the rail, from Search (save), from a Coach card, or from a deadline notification.
- `/applications` — the pipeline: one column of rows grouped by status (interested, applied, interviewing, offer, rejected). Status is a dropdown on the row. Tailoring and Open CV live in a row menu so no row has two competing buttons. Each row shows role, company, and its next step. Opening a card is not a second page in this pass — notes and the fit read stay on the row. "Open CV" goes to `/paper/$paperId`. Empty state points to Search.
- Empty state points to Search.

## Data

`applications` ([data.md](../data.md)): nullable `opening_id` (a user can track an application OpenPath never saw the posting for), denormalized role and company, `cv_paper_id`, `letter_paper_id`.

## Commands

| Command | Agent | What |
|---|---|---|
| `application.create` | yes | From an opening (the Save action in Search) or manual (role + company) |
| `application.setStatus` | yes | Forward one step at a time, backward freely, `rejected` from anywhere. The Coach calls this only when the user says it changed |
| `application.setNotes` | yes | Notes against the application |
| `application.setDeadline` | yes | `YYYY-MM-DD`; feeds deadline notifications |
| `application.tailorCv` / `application.tailorLetter` | yes | `paper.duplicate` the master, name the copy after the role, link it here, open it |
| `application.remove` | yes | Destructive: confirm first |

## Coach behaviour

Suggests the concrete next step from the status (interested: tailor and send; applied: prepare the intro; interviewing: rehearse answers from Pitch). Tailors on request and edits the copy, never the master. Honest about a rejection: acknowledge it plainly, then the next opening.

## Notifications

Deadline approaching and long-idle application nudges go through `core/notifications` — the bell and, where it matters, email.

## Empty state

"Nothing in motion yet. Save an opening from Search and work it here." One door: go to Search.

## Out of scope

Auto-submitting applications anywhere, scraping application portals, email sending on the user's behalf (v1 prepares materials; the user sends them), kanban drag as the only affordance (status is a control, drag is sugar).
