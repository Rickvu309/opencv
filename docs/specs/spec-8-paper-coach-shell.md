# Spec 8 — Paper Coach shell

**Status:** Done (QVE-175 / QVE-176, QVE-177, QVE-178, QVE-179)
**Linear parent:** [QVE-175](https://linear.app/quanvm/issue/QVE-175/spec-8-paper-coach-shell)
**Related:** ADR-0002 (absorb rule), ADR-0004 (shell — dismissible float on a craft surface), ADR-0007 (runtime — must-edit + `ExternalStoreRuntime` adopt), ADR-0009 (modes), ADR-0010 (motion + z-index tokens), Spec 5 (Done), Spec 7 (Done; Paper layout superseded here), PRODUCT.md, [assistant-ui](https://www.assistant-ui.com/)

Spec 7 shipped the shared Coach experience — one dock, honest continuity, visible edits, calm motion. This spec shipped the Paper-specific shell: a document-first layout where the Coach is a guest on the canvas, not a co-owner of the viewport.

## Problem Statement

Paper is where Users edit CVs. The Coach experience is now real; the Paper layout still fought the document.

**Documents sidebar ate width.** `PaperEditorSidebar` was a hardcoded `w-60` aside rendered on every open doc. Switching docs is useful sometimes; most of a session is one CV that wants the full width — especially on a laptop or phone.

**Coach ate height.** Spec 7 S7.3 shipped the in-pane `CoachThreadPanel` (compact transcript, `max-h-64`) plus `CoachDock` below the canvas. It worked and was test-locked — but it split the editor vertically by design. On a **document-first** craft surface (PRODUCT.md: "Paper, Apply, and Pitch are the craft surfaces"), the CV squeezed above a chat panel is the wrong default.

**No must-edit rule.** The runtime could call `paper.updateContent` and the canvas updated live (S7.4), but nothing in the prompt forbade a paste-it-yourself reply. Users could still get *"paste that into the summary field"* — advice without a Command receipt. That violates the spirit of PRODUCT.md Principle 5 even when no false claim is made.

**Chat ergonomics were hand-rolled.** S7.5 closed the motion gap (working bar, receipt stagger, reduced-motion), so the remaining gap was narrower than it once was: transcript auto-scroll during streaming, smooth streaming-markdown rendering, composer affordances. Hand-maintaining these is undifferentiated work a mature primitive library already does.

## Solution

Paper is **document-first** with **optional chrome**:

1. **Hideable documents panel** — collapse the doc list; full-width canvas when hidden; preference persists per User.
2. **Floating Coach (`CoachFloat`)** — closed: a small "Coach" pill bottom-right; open: a floating card that overlays the canvas; **never** a permanent vertical split of the editor. Same `useCoachTurn`, same Thread, same receipts — only the layout moved.
3. **Coach must edit content** — an edit request on an open (or named, owned) CV/Letter/Proof must produce a `paper.updateContent` attempt; prose-only replies are allowed only after a failed receipt.
4. **assistant-ui thread/composer** — absorb Thread + Composer primitives via `ExternalStoreRuntime` over `useCoachTurn`. Spike verdict: **adopt** (ADR-0007). Not Assistant Cloud, not a second backend.

**Why this is not the "AI chatbot bolted on" anti-reference** (PRODUCT.md): the float carries the same Thread (in Home History, continuable on Home), the same mode preference, the same receipts and undo, and the Coach vocabulary — no Sparkles, no "AI assist". What changed is layout only: on a craft surface, the document owns the viewport and the Coach yields it.

**Prototype deviation, stated.** The frozen prototype validated an AI-chat *side panel* on Paper (PRODUCT.md). Spec 7 replaced it with a bottom split; this spec deliberately supersedes both with the float. Spec 3 treats prototype parity as first-class, so this is a recorded deviation, not drift: the prototype predates a Coach that can edit the document it sits beside.

**Not in this spec:** Home floating Coach, Apply/Pitch floats, `paper.patchContent`, drag/resize on the float, voice, attachments, Assistant Cloud, replacing Home `ThreadView`.

## Shipped on main (2026-08-26)

| Area | Where |
|------|--------|
| Documents sidebar | Header "Documents" toggle; unmounts when collapsed; `openpath:paper:docs-panel` |
| Paper Coach layout | `CoachFloat` portal — pill / open card / minimized bar; `coach-thread-panel.tsx` deleted |
| Thread continuity | Same `useCoachTurn` + `GET ?focusDocId`; Thread still appears in Home History |
| Must-edit rule | Persona + `focusDoc` lines in `prompt.ts`; eval `focusDocId` + two golden edit scenarios |
| Visible editing | Inherited S7.4: `updatedAt` sync, conflict, highlight; E2E applies `detail` receipt to canvas |
| assistant-ui | Pinned `@assistant-ui/react@0.15.16`; `useCoachExternalRuntime` projects `useCoachTurn`; React Query owns messages |
| Motion | `coach-float-card` / backdrop use `--duration-base` / `--ease-standard`; reduced-motion disables |
| Depth | `z-popover` / `z-overlay` kit tokens — no raw z-index |

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

## Decisions (as shipped)

- **Documents panel.** Icon toggle in `WorkspaceHeader` children; `aria-expanded` / name "Documents"; collapsed unmounts the sidebar (no slim rail). Persist `openpath:paper:docs-panel` (`"expanded" | "collapsed"`) with inline try/catch. Default expanded. Drive view unchanged.
- **CoachFloat.** Portal from `coach-float.tsx`. Default closed. Overlay (`position: fixed`, `z-popover`) — opening must not change canvas `clientHeight`. Persist `openpath:paper:coach-float` (`"closed" | "open" | "minimized"`). Desktop: non-modal `role="dialog"` `aria-label="Coach"`, Escape returns focus to the pill. Mobile (below `DESKTOP_MEDIA_QUERY`): full-height sheet, backdrop, focus trap.
- **Must-edit.** Edit asks on the focus doc or a named owned doc must attempt `paper.updateContent`. Prose-only only after a failed receipt. Eval threads optional `focusDocId`; two golden scenarios require `paper_updateContent`.
- **assistant-ui — adopt.** `ExternalStoreRuntime` is the inverse of the rejected `useChat`: it projects `useCoachTurn.messages` and forwards send / stop / regenerate / thumbs. It does not call `setMessages` or take the React Query cache. Paper `CoachFloat` is the only absorb surface; Home keeps `ThreadView`.

## Ticket breakdown

Four tickets under [QVE-175](https://linear.app/quanvm/issue/QVE-175). CI burns zero OpenRouter tokens; eval additions are manual.

| Ticket | Scope | PR | Merged SHA | GitHub Actions |
| -- | -- | -- | -- | -- |
| [QVE-176](https://linear.app/quanvm/issue/QVE-176) S8.1 | Hideable documents panel | [#169](https://github.com/quanvu309/openpath/pull/169) | `2543a13` | [success](https://github.com/quanvu309/openpath/actions/runs/32975962598) |
| [QVE-177](https://linear.app/quanvm/issue/QVE-177) S8.2 | `CoachFloat` overlay | [#171](https://github.com/quanvu309/openpath/pull/171) | `b4a72d7` | [success](https://github.com/quanvu309/openpath/actions/runs/32976466524) |
| [QVE-178](https://linear.app/quanvm/issue/QVE-178) S8.3 | Must-edit + eval + E2E | [#170](https://github.com/quanvu309/openpath/pull/170) | `5c4de22` | [success](https://github.com/quanvu309/openpath/actions/runs/32976173197) |
| [QVE-179](https://linear.app/quanvm/issue/QVE-179) S8.4 | assistant-ui `ExternalStoreRuntime` | [#172](https://github.com/quanvu309/openpath/pull/172) | `4b83e35` | [success](https://github.com/quanvu309/openpath/actions/runs/32979059077) |

Frontier was S8.1, S8.2, S8.3 in parallel; S8.4 after S8.2.

The parent carries the verification protocol: a fresh agent that implemented none of the four verifies every child criterion against `main`, the full check suite, and this Definition of done.

## Definition of done

### Documents panel (S8.1)

- [x] Toggle in the Paper editor header hides/shows the sidebar; canvas uses full width when hidden
- [x] Preference persists across reload (`openpath:paper:docs-panel`); first visit is expanded; drive view unchanged

### CoachFloat (S8.2)

- [x] Paper Coach is a bottom-right float; closed pill by default on doc open; `CoachThreadPanel` is gone
- [x] Opening the float does not reduce the canvas scroll area's `clientHeight`
- [x] Minimize / restore / close work; state persists (`openpath:paper:coach-float`); Escape closes with focus returned to the pill
- [x] Mobile: full-height sheet with backdrop and focus trap
- [x] Thread continuity unchanged: same `useCoachTurn` + `focus_doc_id`; the Thread still appears in Home History

### Must-edit (S8.3)

- [x] Persona/prompt rule: edit requests on the focus doc must attempt `paper.updateContent`; prose-only allowed only after a failed receipt
- [x] Eval harness threads a focus doc; ≥2 golden edit scenarios with `requireSuccessfulTool: "paper_updateContent"` (`edit-focus-doc-summary`, `edit-named-letter`). Manual `pnpm --filter api eval` is the live-model gate; CI burns zero OpenRouter tokens
- [x] Web E2E (mock runtime): edit ask on open CV → `paper.updateContent` receipt → canvas updates without manual paste; failed tool → one plain line, no paste advice

### assistant-ui (S8.4)

- [x] Spike verdict recorded in the ADR-0007 paragraph: **adopt** — `ExternalStoreRuntime` projects `useCoachTurn` without taking React Query ownership
- [x] Pinned `@assistant-ui/react@0.15.16`; receipts, streaming, Stop, retry, regenerate, thumbs, undo work in the float
- [x] Kit tokens only; design-vocabulary test green; `prefers-reduced-motion` honoured

### Close-out

- [x] ADR-0004 (craft-surface float) + ADR-0007 (must-edit + spike adopt) paragraphs updated on the child PRs
- [x] Linear mirrors `docs/specs/linear/QVE-175…179.md` match the published tickets
- [x] CI green — GitHub Actions is the gate (Vercel Hobby previews may rate-limit; that is not a failure)

## Testing decisions

1. **S8.1:** `apps/web/src/routes/paper.test.tsx` — toggle hides the sidebar and widens the canvas; remount + storage stub restores the preference; drive view untouched.
2. **S8.2:** `paper.test.tsx` — canvas `clientHeight` unchanged when the float opens; pill → open → minimize → close cycle; Escape + focus return; no "AI assist" string. The Coach tests query the dialog role; `use-coach-turn.test.ts` guard points at `coach-float.tsx`.
3. **S8.3:** api — `coach/prompt.test.ts` for the rule text; eval types/seed/run unit-covered; scenarios run manually. Web — the E2E above on `paper.test.tsx` seams (`threads-api-mock`, `patchMockPaperDoc`).
4. **S8.4:** `coach-runtime.test.ts` — projection + no `setMessages`; smoke in `paper.test.tsx` — send streams into assistant-ui parts, receipt `detail` renders, Stop works. `coach-motion.test.ts` and `design-vocabulary.test.ts` stay green.

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
| **8 — Paper Coach shell (this spec)** | Hideable docs panel, CoachFloat, must-edit, assistant-ui | Done (QVE-175) |
| Pitch persistence | [QVE-134](https://linear.app/quanvm/issue/QVE-134) | After 8, unblocked |

## Further notes

- **This file wins** if Linear lags; mirrors live in `docs/specs/linear/`.
- Acceptance keys on **GitHub Actions**, never Vercel previews — Spec 7 and Spec 8 tickets hit Hobby-plan deploy rate limits.
- Do not edit closed parents [QVE-136](https://linear.app/quanvm/issue/QVE-136), [QVE-155](https://linear.app/quanvm/issue/QVE-155), or [QVE-168](https://linear.app/quanvm/issue/QVE-168).
- Watch for frozen-prototype constants leaking into new UI (the QVE-163 pattern).
- Reference UX: Linear's bottom-right agent panel (minimize/close card) for `CoachFloat`; IDE-style collapsible secondary nav for the sidebar. Match the shape, not the chrome.
