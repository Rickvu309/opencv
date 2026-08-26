# Spec 8 — Paper Coach shell

**Status:** Ready for implementation
**Linear parent:** [QVE-175](https://linear.app/quanvm/issue/QVE-175/spec-8-paper-coach-shell)
**Blocked by:** none — every Spec 7 prerequisite (S7.2 focus doc, S7.3 `useCoachTurn`, S7.4 live sync + selection) is Done on `main` ([QVE-168](https://linear.app/quanvm/issue/QVE-168), PR #167)
**Related:** ADR-0002 (absorb rule), ADR-0004 (shell), ADR-0007 (runtime), ADR-0009 (modes), ADR-0010 (motion + z-index tokens), Spec 5 (Done), Spec 7 (Done), PRODUCT.md, [assistant-ui](https://www.assistant-ui.com/)

Spec 7 shipped the shared Coach experience — one dock, honest continuity, visible edits, calm motion. This spec ships the Paper-specific shell: a document-first layout where the Coach is a guest on the canvas, not a co-owner of the viewport.

## Problem Statement

Paper is where Users edit CVs. The Coach experience is now real; the Paper layout still fights the document.

**Documents sidebar eats width.** `PaperEditorSidebar` is a hardcoded `w-60` aside (`paper-editor-sidebar.tsx:22`) rendered on every open doc. Switching docs is useful sometimes; most of a session is one CV that wants the full width — especially on a laptop or phone.

**Coach eats height.** Spec 7 S7.3 shipped the in-pane `CoachThreadPanel` (compact transcript, `max-h-64`) plus `CoachDock` below the canvas (`paper-editor.tsx:614`). It works and is test-locked — but it splits the editor vertically by design. On a **document-first** craft surface (PRODUCT.md: "Paper, Apply, and Pitch are the craft surfaces"), the CV squeezed above a chat panel is the wrong default.

**No must-edit rule.** The runtime can call `paper.updateContent` and the canvas now updates live (S7.4), but nothing in the prompt forbids a paste-it-yourself reply. Users can still get *"paste that into the summary field"* — advice without a Command receipt. That violates the spirit of PRODUCT.md Principle 5 even when no false claim is made.

**Chat ergonomics are hand-rolled.** S7.5 closed the motion gap (working bar, receipt stagger, reduced-motion), so the remaining gap is narrower than it once was: transcript auto-scroll during streaming, smooth streaming-markdown rendering, composer affordances. Hand-maintaining these is undifferentiated work a mature primitive library already does.

## Solution

Paper becomes **document-first** with **optional chrome**:

1. **Hideable documents panel** — collapse the doc list; full-width canvas when hidden; preference persists per User.
2. **Floating Coach (`CoachFloat`)** — closed: a small "Coach" pill bottom-right; open: a floating card that overlays the canvas; **never** a permanent vertical split of the editor. Same `useCoachTurn`, same Thread, same receipts — only the layout moves.
3. **Coach must edit content** — an edit request on an open (or named, owned) CV/Letter/Proof must produce a `paper.updateContent` attempt; prose-only replies are allowed only after a failed receipt.
4. **assistant-ui thread/composer** — absorb Thread + Composer primitives via `ExternalStoreRuntime` over `useCoachTurn`, spike-gated (see S8.4). Not Assistant Cloud, not a second backend.

**Why this is not the "AI chatbot bolted on" anti-reference** (PRODUCT.md): the float carries the same Thread (in Home History, continuable on Home), the same mode preference, the same receipts and undo, and the Coach vocabulary — no Sparkles, no "AI assist". What changes is layout only: on a craft surface, the document owns the viewport and the Coach yields it.

**Prototype deviation, stated.** The frozen prototype validated an AI-chat *side panel* on Paper (PRODUCT.md). Spec 7 replaced it with a bottom split; this spec deliberately supersedes both with the float. Spec 3 treats prototype parity as first-class, so this is a recorded deviation, not drift: the prototype predates a Coach that can edit the document it sits beside.

**Not in this spec:** Home floating Coach, Apply/Pitch floats, `paper.patchContent`, drag/resize on the float, voice, attachments, Assistant Cloud, replacing Home `ThreadView`.

## Current state (main, 2026-08-26)

| Area | Exists | Gap |
|------|--------|-----|
| Coach chrome | Shared `CoachDock` + `useCoachTurn` in `features/coach/`; Paper passes `showModePicker={false}` | — |
| Paper Coach layout | In-pane `CoachThreadPanel` + dock as canvas sibling (`paper-editor.tsx:614-622`) | Splits editor height; S8.2 replaces with `CoachFloat` |
| Documents sidebar | `w-60` aside, props `{docs, activeId, onSelect, onBack}` only | No collapse contract, no persistence; search `Input` is decorative (S8.1) |
| Thread continuity | `threads.focus_doc_id`, `GET /api/threads?focusDocId=`, no `sessionStorage` | — |
| Visible editing | `updatedAt`-keyed canvas sync, Keep mine / Use Coach's version, `.paper-coach-changed` highlight, selection context | — |
| Receipts | `detail` on tool parts; `RichReceiptBody` in production `ThreadView` | — |
| Must-edit rule | `prompt.ts` prefers editing a selection | Nothing mandates a tool call over prose advice (S8.3) |
| Eval harness | `ScenarioExpectation.requireSuccessfulTool` exists; 5 golden scenarios | `GoldenScenario` / seeds cannot carry a focus doc (S8.3) |
| Motion | `coach.css` token classes, locked by `coach-motion.test.ts` | Float open/close/minimize motion is new (S8.2) |
| Client persistence | Zero `localStorage` in `apps/web` | S8.1 / S8.2 introduce the first keys |
| assistant-ui | Not installed | S8.4 |
| Depth tokens | `--z-index-*` scale + `z-popover` utility in the kit | — |

## User Stories

### Document-first layout

1. As a **User** editing a CV, I want to hide the documents list, so the page uses the full width for my document.
2. As a **User** switching files, I want to show the documents list again with one click, so I do not lose navigation.
3. As a **User**, I want my panel choice remembered, so Paper opens the way I left it.

### Floating Coach

4. As a **User**, I want the Coach in a floating card I can close, so my document keeps full height by default.
5. As a **User**, I want a visible "Coach" affordance bottom-right when the float is closed, so help is one click away.
6. As a **User** mid-conversation, I want minimize to keep the float's header in reach, so I can restore without losing my place in the Thread.
7. As a **User**, I want Escape to close the float and return focus to the opener, so keyboard flow never traps me.
8. As a **User** on a phone, I want the Coach as a full-height sheet, so I am not pinching a desktop card in a short, anxious session.
9. As a **User** with reduced-motion needs, I want float open/close and message motion to respect my system setting.

### Coach edits for real

10. As a **User**, I want "rewrite my summary" to change the CV on screen, so I trust the Coach did the work.
11. As a **User**, I never want "paste this yourself" when the Coach could run a Command, so advice and action stay honest (PRODUCT.md Principle 5).
12. As a **User** whose edit failed, I want one plain line saying what failed and one next step, so failure is honest rather than dressed up.
13. As a **User** with text selected, I want "rewrite this" to keep meaning my selection inside the float, exactly as it did in the dock.

### Polished interaction

14. As a **User**, I want streaming, Stop, retry, regenerate, thumbs, and undo to work identically in the float, so the float is a layout, not a second product.
15. As a **User**, I want the transcript to follow streaming text without jumping, so reading stays calm.

### Explicit non-goals (user-visible)

16. As a **User** on Home, I do **not** get a floating Coach — Home *is* the Coach, full-pane.
17. As a **User** on Apply or Pitch, I do **not** get a Coach float in this spec.
18. As a **User**, I do **not** need to drag or resize the float; close and minimize are the controls in v1.

## Implementation Decisions

### S8.1 — Hideable documents panel

- **Toggle:** icon button rendered as `WorkspaceHeader` children (they land after the title block in `components/workspace-header.tsx`); `aria-expanded`, accessible name "Documents". Gotcha from QVE-171: the kit `Button` centers content — icon-only is fine, but any labelled variant needs explicit alignment, and the test should fail on centering regressions.
- **Collapsed:** the sidebar unmounts; the main column takes full width. No slim rail in v1.
- **Persist:** `localStorage` key `openpath:paper:docs-panel` (`"expanded" | "collapsed"`). First `localStorage` use in `apps/web` — read/write inline with a try/catch for private-mode failures; no storage helper abstraction for one key.
- **Default:** expanded on first visit; saved preference wins after.
- **Drive view unchanged** — the drive table does not use this sidebar.

### S8.2 — `CoachFloat`

Module: `apps/web/src/features/paper/coach-float.tsx`. Replaces the `CoachThreadPanel` mount at `paper-editor.tsx:614-622`; `coach-thread-panel.tsx` is deleted. The float keeps `useCoachTurn` (same binding: `GET ?focusDocId` → create-on-first-send) and `CoachDock` (`showModePicker={false}`) inside it.

**States:**

| State | UI |
|-------|-----|
| `closed` | Pill bottom-right, label "Coach" (no Sparkles, no "AI assist") |
| `open` | Fixed card `bottom-4 right-4`, width `min(24rem, calc(100vw - 2rem))`, max-height `min(32rem, 70vh)`, kit border + shadow |
| `minimized` | Header bar only: Thread title or doc name, restore, close |

**Resolved decisions:**

- **Default closed** on doc open — document-first. The pill is always visible while a doc is open.
- **State persists** in `localStorage` key `openpath:paper:coach-float` (`"closed" | "open" | "minimized"`), per User, not per doc. Closing never deletes the Thread.
- **Overlay, not split.** `position: fixed`, `z-popover` from the kit scale — never a raw z-index (the design-vocabulary test polices this). Opening the float must not change the canvas scroll area's `clientHeight`. Occlusion of the bottom-right of the canvas is accepted: the float is one keypress from gone and the canvas scrolls.
- **Desktop a11y:** non-modal `role="dialog"` with `aria-label="Coach"`; no focus trap; Escape closes and returns focus to the pill. Streaming region carries `aria-live="polite"`; canvas edits are announced by the receipt, not a second live region.
- **Mobile** (below the shell's `DESKTOP_MEDIA_QUERY`, via the kit `useMediaQuery`): full-height sheet with backdrop and focus trap; close restores focus and scroll.
- **Motion:** open/close/minimize use `--duration-base` / `--ease-standard` in `coach.css`'s idiom; `prefers-reduced-motion` disables them like the existing classes.
- **Test churn is in-scope:** roughly nine Coach tests in `paper.test.tsx` scope assertions with `within(editor)` against the in-pane panel — a fixed-position float renders outside the editor `role="region"`, so those queries move to the dialog role. The filesystem guard in `use-coach-turn.test.ts` hardcodes `coach-thread-panel.tsx` and must point at `coach-float.tsx` instead.

### S8.3 — Coach must edit CV/Letter/Proof (hard requirement)

**Product rule.** When the User asks to change, rewrite, shorten, tailor, or fix content in the focus doc — or names a doc they own — the Coach **must** attempt `paper.updateContent` (after `paper_getDoc` / `paper_listDocs` if ids are unknown; `paper.createDoc` when the ask is a new doc). Prose-only replies are permitted only after a failed tool receipt: one plain line on what failed, one next step.

**Prompt** (`apps/api/src/coach/prompt.ts`): add the edit rule beside the existing selection preference — persona line plus a `focusDoc` instruction. Honesty stays mechanical (Spec 5): the deterministic no-claim-without-receipt check already covers the claim side; this rule covers the act side.

**Eval plumbing is explicit scope**, not a scenario one-liner:

- `eval/types.ts`: `GoldenScenario` gains optional `focusDocId`; seeded paper docs gain stable ids so a scenario can reference one.
- `eval/seed.ts` + `eval/run.ts`: thread the focus doc into the turn request.
- ≥2 golden scenarios with `requireSuccessfulTool: "paper_updateContent"` (the expectation type already exists): one focus-doc edit ("Rewrite my summary to be shorter"), one named-doc edit without `focusDocId` (exercises list → get → update).
- Manual only: `pnpm --filter api eval`. CI burns zero OpenRouter tokens.

**Web E2E** (mock runtime, existing seams `threads-api-mock.ts` + `patchMockPaperDoc`): User on open CV → "Make my summary one sentence" → `paper.updateContent` receipt (`detail` field — there is no `receiptMeta`) → canvas text changes with no manual paste. S7.4's sync/conflict/highlight behaviour is inherited, not rebuilt.

### S8.4 — assistant-ui runtime + primitives (spike-gated)

Per ADR-0002: absorb, do not fork blindly. Per ADR-0007's precedent: `@ai-sdk/react` `useChat` was **rejected** because it owns message state and fights React-Query-as-truth. `ExternalStoreRuntime` exists precisely to avoid that — this ticket proves it before committing.

1. **Spike first, inside the ticket:** adapter mapping `useCoachTurn` state (`messages`, `phase`, send/stop/retry) into `ExternalStoreRuntime`, nothing user-visible. **Kill criteria:** if the adapter must duplicate or fork message state, or take ownership from React Query, stop — record the verdict in the ADR-0007 paragraph and close the ticket with the float keeping the existing `ThreadView`.
2. If the spike passes: add `@assistant-ui/react` to `apps/web` at a **pinned exact version**; absorb Thread + Composer primitives into `apps/web/src/features/coach/` (kit promotion waits for the Home-convergence follow-up — no Storybook obligation lands here).
3. Receipts (`detail` → `RichReceiptBody`) render inside assistant-ui message parts; streaming, Stop, retry, regenerate, thumbs, undo unchanged.
4. Theme with `@workspace/ui` tokens only; motion gated on `prefers-reduced-motion`.
5. **Vocabulary:** assistant-ui's "Thread"/"Composer" primitive names are implementation detail; every user-facing string stays CONTEXT.md vocabulary (Coach, Thread).

**Out of scope for S8.4:** LangGraph, Assistant Cloud, branching, attachment upload, Home adoption (follow-up).

## ADR updates

- **ADR-0004** (one line, when S8.2 lands): a craft surface may host a dismissible floating Coach overlay; the single-main-pane rule is otherwise intact.
- **ADR-0007** (one paragraph, when S8.3/S8.4 land): must-edit rule for focus-doc turns; assistant-ui spike verdict (adopted with `ExternalStoreRuntime`, or killed and why).
- All token references in this spec are **ADR-0010** (design tokens; renumbered by QVE-162).

## Ticket breakdown

Four tickets under [QVE-175](https://linear.app/quanvm/issue/QVE-175). CI burns zero OpenRouter tokens; eval additions are manual.

| Ticket | Scope | Blocked by | Linear |
|--------|-------|------------|--------|
| **S8.1 — Hideable documents panel** | Toggle in header, unmount + persist, full-width canvas | — | [QVE-176](https://linear.app/quanvm/issue/QVE-176) |
| **S8.2 — CoachFloat** | Float replaces in-pane panel; states, a11y, persistence, test churn | — | [QVE-177](https://linear.app/quanvm/issue/QVE-177) |
| **S8.3 — Coach must edit content** | Prompt rule, eval plumbing + scenarios, web E2E | — (api-side any time; web E2E lands after S8.2 only if it asserts float chrome) | [QVE-178](https://linear.app/quanvm/issue/QVE-178) |
| **S8.4 — assistant-ui runtime + primitives** | Spike, adapter, absorbed primitives in the float | S8.2 ([QVE-177](https://linear.app/quanvm/issue/QVE-177)) | [QVE-179](https://linear.app/quanvm/issue/QVE-179) |

Frontier today: S8.1, S8.2, S8.3 in parallel; S8.4 after S8.2.

The parent carries the verification protocol: a fresh agent that implemented none of the four verifies every child criterion against `main`, the full check suite, and this Definition of done.

## Sub-issues (Linear)

| ID | Ticket |
|----|--------|
| [QVE-175](https://linear.app/quanvm/issue/QVE-175) | Parent — Spec 8 |
| [QVE-176](https://linear.app/quanvm/issue/QVE-176) | S8.1 — Hideable documents panel |
| [QVE-177](https://linear.app/quanvm/issue/QVE-177) | S8.2 — CoachFloat |
| [QVE-178](https://linear.app/quanvm/issue/QVE-178) | S8.3 — Coach must edit content |
| [QVE-179](https://linear.app/quanvm/issue/QVE-179) | S8.4 — assistant-ui runtime + primitives |

## Definition of done

### Documents panel (S8.1)

- [ ] Toggle in the Paper editor header hides/shows the sidebar; canvas uses full width when hidden
- [ ] Preference persists across reload (`openpath:paper:docs-panel`); first visit is expanded; drive view unchanged

### CoachFloat (S8.2)

- [ ] Paper Coach is a bottom-right float; closed pill by default on doc open; `CoachThreadPanel` is gone
- [ ] Opening the float does not reduce the canvas scroll area's `clientHeight`
- [ ] Minimize / restore / close work; state persists (`openpath:paper:coach-float`); Escape closes with focus returned to the pill
- [ ] Mobile: full-height sheet with backdrop and focus trap
- [ ] Thread continuity unchanged: same `useCoachTurn` + `focus_doc_id`; the Thread still appears in Home History

### Must-edit (S8.3)

- [ ] Persona/prompt rule: edit requests on the focus doc must attempt `paper.updateContent`; prose-only allowed only after a failed receipt
- [ ] Eval harness threads a focus doc; ≥2 golden edit scenarios with `requireSuccessfulTool: "paper_updateContent"` pass on `pnpm --filter api eval` (manual)
- [ ] Web E2E (mock runtime): edit ask on open CV → `paper.updateContent` receipt → canvas updates without manual paste; failed tool → one plain line, no paste advice

### assistant-ui (S8.4)

- [ ] Spike verdict recorded in the ADR-0007 paragraph (adopt or kill, with reason)
- [ ] If adopted: pinned `@assistant-ui/react`, `ExternalStoreRuntime` over `useCoachTurn` with React Query still owning message state; receipts, streaming, Stop, retry, regenerate, thumbs, undo all work in the float
- [ ] Kit tokens only; design-vocabulary test green; `prefers-reduced-motion` honoured

### Close-out

- [ ] ADR-0004 + ADR-0007 paragraphs updated
- [ ] Linear mirrors `docs/specs/linear/QVE-175…179.md` match the published tickets
- [ ] CI green — GitHub Actions is the gate (Vercel Hobby previews may rate-limit; that is not a failure)

## Testing decisions

1. **S8.1:** `apps/web/src/routes/paper.test.tsx` — toggle hides the sidebar and widens the canvas; reload (fresh render + storage stub) restores the preference; drive view untouched.
2. **S8.2:** `paper.test.tsx` — canvas `clientHeight` unchanged when the float opens; pill → open → minimize → close cycle; Escape + focus return; no "AI assist" string. **Update, not delete:** the ~9 existing Coach tests re-scope from `within(editor)` to the dialog; `use-coach-turn.test.ts` guard points at `coach-float.tsx`.
3. **S8.3:** api — `coach/prompt.test.ts` for the rule text; eval types/seed/run unit-covered; scenarios run manually. Web — the E2E above on `paper.test.tsx` seams (`threads-api-mock`, `patchMockPaperDoc`).
4. **S8.4:** smoke in `paper.test.tsx` — send streams into assistant-ui parts, receipt `detail` renders, Stop works. `coach-motion.test.ts` and `design-vocabulary.test.ts` stay green throughout.

Prior art: `paper.test.tsx` Coach block, `home-chat.test.tsx`, `coach/http.test.ts`, `use-coach-turn.test.ts`.

## Out of scope

- Home floating Coach; Apply / Pitch floats
- Replacing Home `ThreadView` (Paper first; convergence is a follow-up)
- `paper.patchContent`
- Drag/resize or position memory on the float
- Dark-mode styling (QVE-164 parked; float is light-only by decision)
- Voice, attachments, Assistant Cloud

## Route to real product

| Spec | Scope | Status |
|------|-------|--------|
| 7 — The Coach experience | Dock, continuity, visible edits, receipts, motion | Done (QVE-168) |
| **8 — Paper Coach shell (this spec)** | Hideable docs panel, CoachFloat, must-edit, assistant-ui | Ready |
| Pitch persistence | [QVE-134](https://linear.app/quanvm/issue/QVE-134) | After 8, unblocked |

## Further notes

- **This file wins** if Linear lags; mirrors live in `docs/specs/linear/`.
- Acceptance keys on **GitHub Actions**, never Vercel previews — six Spec 7 tickets hit Hobby-plan deploy rate limits.
- Do not edit closed parents [QVE-136](https://linear.app/quanvm/issue/QVE-136), [QVE-155](https://linear.app/quanvm/issue/QVE-155), or [QVE-168](https://linear.app/quanvm/issue/QVE-168) (beyond the one approved table-rendering fix on QVE-168).
- Watch for frozen-prototype constants leaking into new UI (the QVE-163 pattern).
- Reference UX: Linear's bottom-right agent panel (minimize/close card) for `CoachFloat`; IDE-style collapsible secondary nav for the sidebar. Match the shape, not the chrome.
