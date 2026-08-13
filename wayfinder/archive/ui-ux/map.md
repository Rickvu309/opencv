# Map, OpenPath at a production UI/UX bar

`wayfinder:map` · **archived 2026-08-04, with two tickets still open**

> Archived to clear the way for [Map, OpenPath backend on Eve](../../backend/map.md), not
> because the destination was reached. Four of the eight surfaces in *Screens* were never
> brought to the bar, and *Consistency* recorded only a partial resolution. What was left
> open is listed under **Unfinished at archive** below, so reviving this is a matter of
> moving the directory back, not re-deriving the work.

## Destination

Every flow and screen of OpenPath evaluated against Emil Kowalski's design-engineering
taste and the `better-*` floors, with the fixes **landed in code**, so that nothing
about the interface, its motion, or its Vietnamese copy is still undecided.

Reached when all three tickets are closed and each screen has been verified in the
browser at both desktop and 375px.

## Notes

**Domain**, Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui. Vietnamese-language
product for young Vietnamese jobseekers. All data is mock (`lib/data.ts`); there is no
backend, and none is being built here.

**This map changes code.** It overrides Wayfinder's plan-don't-do default: each ticket
evaluates, decides, *and* fixes. UI quality is verified by looking at it, not by
describing it.

**Skills every session should consult**

- `emil-design-eng`, the taste reference. Unseen details, motion, component feel.
  Its Before/After table is the required review format.
- `animation-vocabulary`, `find-animation-opportunities`, `improve-animations`, motion work.
- `better-accessibility`, `better-layout`, `better-typography`, `better-writing`,
  `better-colors`, `better-ui`, the floors. `better-interface` to orchestrate all six.
- `prototype`, when "how should this behave" is the open question.

**Project contract**, `DESIGN.md` is the system this app already committed to, and
`PRODUCT.md` holds the register, brand personality and anti-references. Measure against
both. When a decision changes the system, update `DESIGN.md` in the same session.

**Standing constraint**; every screen renders from the `lib/actions` store and must
survive being mutated from outside while the user is looking at it. The Coach edits
everything on the user's behalf; a screen holding its own copy of domain state breaks
that promise silently.

**The bar includes** responsive at 375px, accessibility as a floor, and empty / loading /
error states on every screen.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [Foundations: one store, one motion vocabulary, one edit pattern](tickets/01-foundations.md)
 , onboarding, Career Map and Todo now read and write through `lib/actions`
  (the provider had been mounted below onboarding, so it could never dispatch);
  Todo survives as a view over `plan.stages` + `todos` rather than a third copy;
  `todo.update` / `path.updateNode` / `todo.add.source` close the Coach's
  amend gap and `path.setTarget` now sets the target role too; Coach edits act,
  announce with undo, and flash the row they touched; motion is three named
  curves and four durations, every call site on tokens.

## Unfinished at archive

Recorded 2026-08-04 so the open work is recoverable without re-reading every ticket.

**[Screens: eight surfaces at Emil's bar](tickets/02-screens.md)**, four of eight ticked.
Landing, Onboarding, Plan and Todo are done. Left open:

- **Career Map**, untouched. No pass of any kind. ~~Untouched.~~ **Partly closed 2026-08-04**:
  the narrow-screen fit was landing on its 0.55 floor and rendering 14px node titles at 7.7px,
  fixed by anchoring at full size on "you" below `sm`; nodes gained press feedback and moved
  onto the motion tokens. Writing and the empty / loading / error states are still open.
- **Coach**, **Profile** and **Shell**, *partial*. Each was swept at 375px for overflow only;
  the five passes (motion, writing, empty / loading / error states) were never run. On Shell,
  only the rail's touch row height was fixed; header, dock and help button are unreviewed.
  **Partly closed 2026-08-04**: press, hover and focus are now consistent across their raw
  controls, and every motion call site is on a token. Writing and states remain.
- ~~The fixed coach strip still overlaps Profile and Career Map on mobile.~~ **Closed
  2026-08-04**: below `md` the strip and help button are one in-flow row at the foot of the
  frame, so the scroll area ends where they begin and the four per-screen padding hacks are
  gone. Recorded in `DESIGN.md`.
- `useTouched()` and `.animate-just-changed` are wired on some rows, not all.

**[Consistency: one voice, no motion drift](tickets/03-consistency.md)**, partial resolution
recorded. Both sweeps were run early and need re-running once Screens closes. Still open: the
press / hover / focus / disabled audit, and the `aria-pressed` versus `RadioGroup` split in
onboarding.

**One decision waiting on the user**, "Kế hoạch" in the nav versus "Lộ trình" as the page
heading, for the same screen.

## Not yet specified

- **State does not survive a reload.** `lib/actions/store.tsx` has no persistence, so every
  edit, the user's or the Coach's, vanishes on refresh. It reads as a UX defect but the
  fix is storage. This got sharper, not softer, once *Foundations* landed: onboarding now
  commits real answers and the Career Map now sets a real goal, so a refresh throws away
  more than it used to. Still fog because "backend is out of scope" and storage sits on
  that line.
- **How much undo is enough?** *Foundations* shipped one level, per toast, and left a
  known edge: undoing an older toast reverts everything after it. Whether that needs a
  proper history depends on how often the Coach makes several edits in a row, which
  cannot be judged until the Coach actually runs.
- **The real Coach is not running.** Replies are canned (`components/coach/replies.ts`);
  the Eve agent is scaffolded but blocked on model choice. Streaming, latency, partial
  output and failure are all real UX surfaces that can't be designed until something
  actually streams.
- **The landing page sits in a different register**, brand, not product (`PRODUCT.md`
  distinguishes them). It may need its own treatment rather than the same bar as the app
  screens.

## Out of scope

- **Dark mode.** No `ThemeProvider` is mounted and `globals.css` has no dark token ramp,
  so this is a build, not a review; it would roughly double the map. Redrawable as a
  fresh effort later.
- **Backend, auth, persistence and the data contract.** Explicitly excluded when the
  destination was named: this map is UI/UX and UX writing only.
- **Choosing the Eve model.** Benchmarking showed no NVIDIA model that is both correct and
  fast; that is its own effort, and the UI review does not wait on it.
