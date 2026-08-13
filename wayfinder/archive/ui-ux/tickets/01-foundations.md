# Foundations: one store, one motion vocabulary, one edit pattern

- **Type:** `wayfinder:grilling`
- **Status:** closed
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** —
- **Map:** [Map, OpenPath at a production UI/UX bar](../map.md)

## Question

Three screens hold domain state the Coach cannot reach, and two patterns every screen
will depend on are undefined. What is the shape of each, and does it hold once wired?

### 1. Plug the three severed screens into the store

The action registry already has **24 actions**, and the ones these screens need exist and
work. The screens simply don't call them.

| Screen | Actions it needs (already registered) | What it does instead |
| --- | --- | --- |
| Onboarding | `profile.setIdentity`, `profile.setEducation`, `profile.addCourse` | 12 local `useState` values at `app/onboarding/page.tsx:93-112`, all discarded, `handleFinish` at `:134` is just `router.push("/profile")` |
| Career Map | `path.setTarget`, `path.addNode`, `path.removeNode` | `useState` at `app/(app)/career-map/page.tsx:52-56` for `targetId`, `extraNodes`, `extraEdges`, `moved` |
| Todo | `todo.add`, `todo.toggle`, `todo.remove` | `useState` at `app/(app)/todo/page.tsx:102`, seeded from `actionPlan` at module scope (`:38`) |

Consequence today: the Coach can dispatch `path.setTarget` and the store updates
correctly, but Career Map renders from local state so the user sees nothing happen.
Meanwhile `app/(app)/plan/page.tsx:34` renders "Lộ trình tới {profile.identity.targetRole}"
from state the map cannot write to.

Keep UI-local state local, drafts, open/closed, hover, pan/zoom, selected tab. Only
domain state moves.

**Also decide: does Todo survive as its own screen?** It overlaps Plan heavily. Merging,
keeping, or redefining it changes the *Screens* ticket.

### 2. Is every UI mutation an action?

The Coach edits everything on the user's behalf. Walk every mutation the interface can
perform and confirm a matching action exists; add the missing ones. This is what makes
"the Coach can edit everything" true rather than aspirational.

### 3. What does a Coach edit *feel* like?

The most interesting design question in this map, and it sets the pattern every screen
implements. Best answered by making something to react to, not by discussing it.

- Does a Coach-made change animate in so the user watches it happen, or appear silently?
- Approve-first, or act-then-undo?
- How does the user see what changed while they were on a different screen?
- What happens if the Coach edits the very field the user is typing in?

### 4. The motion vocabulary

`DESIGN.md:132` already commits to *150–250ms, ease-out, transform/opacity/width only,
every transition guarded with `motion-reduce`*. The code has drifted from it:

- `duration-300` ×8, outside the stated band
- `ease-linear` ×4, `ease-in-out` ×1; not ease-out
- `cubic-bezier(0.2,0,0,1)` ×2, a third easing, from the better-ui icon spec
- `transition-all` ×2, `components/ui/progress.tsx:24`, `components/ui/sidebar.tsx:291`

And the untapped half: **`active:scale` appears zero times in the entire app.** No button
gives press feedback. Of ~30 transitions most are `transition-colors`, so the interface is
close to static.

Reconcile the rule with reality and write the vocabulary down, durations, easings, press
feedback, enter/exit, what animates and what must not, reduced-motion fallbacks. Update
`DESIGN.md` in the same session. Every screen then applies this one vocabulary instead of
inventing its own.

## Definition of done

- The three screens read and write through `lib/actions`; no domain state in `useState`.
- The Todo/Plan overlap is decided.
- Registry covers every UI mutation.
- The Coach-edit interaction pattern is decided and demonstrated in code.
- The motion vocabulary is written into `DESIGN.md`.

---

## Resolution

### The three screens now read and write through `lib/actions`

The blocker was not the wiring. **`AppStateProvider` was mounted in
`app/(app)/layout.tsx`, and onboarding lives at `app/onboarding/`, outside it**,
so onboarding could not dispatch at all. The provider moved to the root layout;
`(app)` keeps only the shell.

- **Onboarding** commits on finish through `profile.setIdentity`,
  `setEducation`, `setContext` ×3, `addCourse` per line, and `document.add` for
  the CV and LinkedIn. Verified: a name typed in step 1 now appears on the
  profile, and the context rows go 4 → 7.
- **Career Map** reads `paths` and dispatches `path.setTarget/addNode/removeNode`.
- **Todo** reads `todos` + `plan.stages` and dispatches to whichever owns the row.

Form drafts, canvas viewport, selection and open/closed stayed local.

### Decision, Todo survives, as a view over two stores

Plan is the roadmap; Todo is what you are doing now. That distinction is real, so
Todo stays, but it stops duplicating. The duplication was in the seed itself:
`todos` and `plan.stages` both held the same nine entries **with the same ids**,
so `todo.toggle` and `plan.toggle` acted on different copies and neither saw the
other. Now `todos` holds only coach- and self-created tasks, and plan rows are
read live. Verified: unticking a row in Todo unticks it on Plan.

### Decision, node positions are not domain state

Dragging a node is canvas layout. `moved` stays local; the Coach has no business
rearranging a diagram it cannot see.

### Registry coverage

Every mutation the *UI* performs already had an action. The gaps were in what the
Coach could do **to rows that already exist**; it could create and destroy but
not amend, so fixing a typo meant remove-and-re-add, losing the id and done state.

Added: **`todo.update`**, **`path.updateNode`**, and a `source` on **`todo.add`**
(it hardcoded `"coach"`, so a user-typed task was attributed to the Coach).

**`path.setTarget` now also sets `profile.identity.targetRole`.** These were two
fields for one act, the map lit a route to a node id while the plan header named
a role string it could not write. Picking Business Analyst on the map now makes
the plan read "Lộ trình tới Business Analyst".

### Decision, what a Coach edit feels like: act, announce, reveal

Documented in `DESIGN.md` under "When the Coach edits on your behalf".

1. **Act.** The change lands immediately through the same action the UI uses. No
   approval step for ordinary edits, an agent that only suggests is a suggestion
   box. Suggestion cards survive only for path-forking choices.
2. **Announce, with a way back.** Every non-silent dispatch toasts the action's
   `summary` plus **Hoàn tác**, restoring the prior state.
3. **Reveal.** A toast says what, not where. Actions report `touched` ids
   (defaulting to the input's `id`), the store holds them ~1.2s, and rows flash
   via `.animate-just-changed`. Demonstrated on `components/plan/entry-row.tsx`.

`store.tsx` was rebuilt around a state ref: it had been calling `toast()` inside
a `setState` updater, which double-fires under StrictMode and cannot chain, and
onboarding needed to commit eight actions in one tick.

**Known limitation:** undo captures the state before *its own* dispatch, so
clicking undo on an older toast reverts everything after it too.

### Motion vocabulary, the rule was wrong, not the code

`DESIGN.md` contradicted itself: it mandated "150–250ms" while its own accordion
section documented 300/260/180ms and skill bars ran 500ms. Replaced with three
named curves and four durations, all of which the codebase had already converged
on. Every call site now uses them, `globals.css` has no literal `cubic-bezier`
outside the token block.

Named `--ease-enter` / `--ease-exit`, **not** `--ease-out` / `--ease-in`: in
Tailwind v4 an `--ease-out` token silently redefines the built-in `ease-out`
utility, changing every existing use without appearing in a diff.

**Correction to this ticket's premise.** "`active:scale` appears zero times, no
button gives press feedback" was a false alarm. `components/ui/button.tsx:8`
carries `active:not-aria-[haspopup]:translate-y-px`, and the Button's bare
`transition` covers `translate`, press feedback exists, as a 1px nudge rather
than a scale. A blanket `scale: 0.96` was written and then reverted: it would
have stacked a second transform on a deliberate one. The idiom is documented so
raw `<button>`s adopt it rather than inventing a scale.

### Testing

There was no test framework. Added one with **zero dependencies**: Node 24 strips
types natively, and `scripts/alias-hook.mjs` teaches `node --test` the `@/` alias
and extensionless imports. `npm test` runs 10 tests over the registry, the
Coach's contract, and the one place a silently wrong reducer corrupts user data.

### For later tickets

- *Screens*: apply `useTouched()` + `.animate-just-changed` to the remaining row
  components; only the plan entry demonstrates it.
- *Consistency*: onboarding mounts its own `Toaster` at `top-right` while the app
  uses `top-center`.
- *Screens*: Todo's own left-rail row component is a second place a plan item is
  rendered; check the two stay visually identical.
