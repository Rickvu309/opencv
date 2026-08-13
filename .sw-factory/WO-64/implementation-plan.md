# Implementation Plan: WO-64

**Work Order:** WO-64 - Redesign Onboarding into a guided teach-by-doing tutorial

## What was already there, and what was missing

The goal-first flow and the live fit panel already shipped, and the work order
says so: this is a redesign, not a rebuild. What was missing was any idea, at
the end of it, of what the product does with the answers. The user finished
three screens of questions and was dropped into an empty chat.

## What was built

**The guided tour** (`components/onboarding/guided-tour.tsx`). Four cards
between finishing setup and meeting the Coach, skippable from the first one.

The order is the argument. Card one says the Coach edits your work, which is
the differentiator and also the alarming part. Card two is the undo promise,
because a reader who has just been told an agent will rewrite their CV needs
that sentence immediately rather than three cards later. Then where materials
live, then how jobs are found.

**App-led, not Coach-led**, which the work order fixes as a decision and which
is right for two reasons beyond that: a model call between the user and the
product at the moment they have least patience for latency, and introducing the
Coach by having it talk about itself rather than do something.

**The activation checklist** (`lib/onboarding/checklist.ts` and its component),
on the Coach's empty state. Four steps, each a question asked of the real store
rather than a stored tick, so the list cannot disagree with the product and
somebody who did these before seeing it arrives with them already done.

The document step accepts a CV, a letter *or* a pitch item. Insisting on a CV
would leave somebody who wrote a cover letter first staring at an unticked box
for work they had done.

**Dismissal lives in localStorage, not `AppState`.** `AppState` is what the
Coach reads and changes, and "I hid a panel" is not the Coach's business. The
cost is that hiding it on a laptop leaves it showing on a phone; acceptable,
because the list removes itself once the four steps are done.

## The fit panel

The work order asks for the live fit to be repointed off the Career Map
archetypes. It already scored against the goal the user states, and WO-60 kept
the role catalogue precisely so it could keep doing that. What changed is the
framing: the comment claiming this was "the same figure the career map shows"
named a screen that no longer exists. The calculation did not change.
