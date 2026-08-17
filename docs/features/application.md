# Application

**Track:** Commodity — Teal / Huntr tracker patterns: a status pipeline with notes, deadlines, and per-application materials.

**Job:** turn a decision to pursue an opening into a managed process with a clear state and a clear next action, through to an outcome.

## Concept

An application is a saved opening the user is working. It carries a status, notes, a deadline, and links to the tailored CV and letter made for it. Tailoring always copies from the master in Paper — the original never changes underneath the user. The Coach suggests the next step per application but never moves a status on its own; status changes only when the user says reality changed.

## Screens

- `/applications` — the pipeline: applications grouped by status (interested, applied, interviewing, offer, rejected), each card showing role, company, deadline, and its next step. Opening a card shows notes, linked materials ("Open CV" goes to `/paper/$paperId` — nobody edits on a card), and the fit read carried over from Search.
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
