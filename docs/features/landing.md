# Landing

**Track:** Commodity — single-promise SaaS landing with two doors: start now, or leave an email.

**Job:** turn a skeptical, anxious visitor — "is this another career-quiz app?" — into someone who starts, or at least leaves an email.

## Concept

Lead with the message, not a feature list. The promise: the Coach does real career work with you — builds your CV, finds openings that fit, tells you honestly what is missing — and you stay in control of every word. Who it is for is named plainly: students and new graduates. The voice sells the way the product talks: evidence over hype, no invented claims, no testimonials we do not have, no statistics nobody measured.

## Screens

- `/` — in order: the promise in one headline; the differentiator in one sentence (it operates the app with you, everything undoable); how it works at a glance (prepare yourself → find what fits → go after it, with the Coach alongside); who it is for; the two doors. Primary: start now (`/sign-up`). Secondary: the waitlist form.
- Fast on a mid-range Android phone: minimal JS, images sized, no animation walls.

## Mechanics

Waitlist submit is a public server function (no session, so not a bus command): valid email lands in `waitlist` and confirms; an email already on the list gets the same confirmation (no enumeration); a store failure says the submission did not complete rather than lying. Validation errors name the fix.

## Data

`waitlist` ([data.md](../data.md)).

## Empty-state copy register

"You don't need to know your direction yet. That's the point." — the tone the whole page holds: calm, second person, no exclamation marks.

## Out of scope

Pricing (no monetization in v1), blog, testimonials, multi-page marketing site, language switcher (English first; the page is written so Vietnamese can slot in later).
