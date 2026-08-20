# Onboarding

**Track:** Commodity — goal-first wizard with live payback and an activation checklist, the pattern of Linear / Duolingo first-runs. Teach by doing, never a passive demo.

**Job:** a first-time user leaves knowing what OpenPath is for, how the Coach works with them, and where to go next — having already set up something real.

**Layout:** Wizard at `/onboarding` — no rail, no dock. One question per step, payback in the same frame. Primary: Continue; Skip always visible ([layout.md](../design-system/layout.md)).

## Concept

Three jobs woven together: capture enough to make the product useful (goal first, then starting facts), teach the app by having the user perform real setup steps, and orient with a short skippable tour (what the Coach does, where materials live, how openings are found). Every answer pays back visibly — the profile fills, a readiness signal moves — so setup feels worth it rather than like a form. Skip and finish land on dump if they have no proofs.

## Screens

- `/onboarding` — 3–5 steps, each skippable, full keyboard support. A four-step track (Goal / School / Work / Coach) sits above the question. Payback sits in the same frame as the answer (a muted sentence plus an **On your profile** card that fills as they type):
  1. Goal: "What are you aiming for?" — free text, with an explicit honest option: "I'm not sure yet."
  2. Where you are: school, year, major.
  3. What you have: one experience or project, one link if any (kind + URL).
  4. A short tour beat: the Coach operates the app with you, and you can undo anything it does.
- Continue writes everything to the profile through profile commands. Skip and finish use the same after-sign-in home as auth: no log entries open the dump editor, a real log opens `/paper`. Never `/coach`. Never the empty proof list.
- After onboarding, the empty Coach is mark, composer, and three starters. The old activation checklist is not shown.

## Data

No tables of its own. Writes through `profile.*` commands; `users.onboarding_completed_at` marks completion (returning users never see the wizard again); checklist progress is derived from real state (a CV exists, a conversation exists), not tracked flags.

## Commands

| Command | Agent | What |
|---|---|---|
| `onboarding.complete` | no | Stamp completion, whatever was skipped |
| `onboarding.dismissChecklist` | no | Hide the checklist for good |

## Empty-state stance

Onboarding is the reason other screens are never truly empty: the profile is seeded. A user who skipped everything lands on the dump box.

## Out of scope

Blocking questions (everything is skippable), personality quizzes, more than five steps, running the tutorial inside the Coach conversation (the Coach is introduced, not the narrator).
