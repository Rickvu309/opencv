# Spec 7 — The Coach experience

**Status:** Done (QVE-168 / QVE-169, QVE-172, QVE-170, QVE-173, QVE-174)
**Superseded (Paper layout only):** [Spec 8](spec-8-paper-coach-shell.md) replaces the in-pane `CoachThreadPanel` split with a floating `CoachFloat`; `useCoachTurn`, `CoachDock`, continuity, receipts, and motion carry over unchanged.
**Related:** Spec 5 (`docs/specs/spec-5-coach.md`), ADR-0007 (runtime), ADR-0009 (modes + dock chrome), ADR-0010 (motion tokens), PRODUCT.md (persona)

## Problem Statement

Spec 5 shipped the Coach runtime — stream, tools, modes, undo — but the **experience** did not match. Home parked mode under the composer. Paper hung a Sparkles popover named "AI assist" with its own tiny box. Both already used the same Coach, and Paper already wrote a real Thread (titled with the doc) into Home History, but nothing in the panel said so, so it felt like a second product. Coach edits did not appear on the open Paper canvas. Receipts were generic one-liners. Motion was chatbot-grade.

## Solution

One Coach dock, one Thread, visible editing, calm motion.

1. **One dock chrome.** Shared `CoachDock` is the only composer. Home puts the mode dropdown inside the dock (left of Add). Paper drops the popover and uses the same dock under the document. One mode preference — Settings keeps the explained pill. No second Paper picker. No routing or cap change.
2. **Talk on a doc is a Thread.** `threads.focus_doc_id` persists document grounding. Paper binds the Thread on doc open; first send creates `{ title: docName, focusDocId }`. Home History lists that Thread under an honest title; opening it on Home continues the same messages. `sessionStorage` is not the link.
3. **Edits are visible.** When Coach mutates the open Paper doc, the canvas reloads from the server (`doc.updatedAt`). Dirty local state plus a Coach write shows an honest conflict (Keep mine / Use Coach's version). Changed sections highlight and scroll into view. Selection is optional turn context. Receipts graduate the three high-traffic Commands: `paper.updateContent` (named headline + collapsed hunks), `apply.moveCard` (card + Stage dots), `paper.createDoc` (kind badge + name + Draft). Failures stay one plain line. Undo from QVE-149 still works.
4. **Calm motion.** Spec 6 / ADR-0010 tokens only. Working is "Working…" plus a thin indeterminate bar. First coach text fades in. Receipts enter with a short stagger. Undo collapses the old receipt and briefly marks the replacement Undone. Everything respects `prefers-reduced-motion`. No confetti, bounce, typewriter, or overlays.

**Not in this spec:** billing, mode-map changes, Pitch Coach, `paper.patchContent`, voice input, Coach-paused destructive tool calls.

## User Stories

1. As a **User** on Home, I want mode inside the dock, so I am not hunting a radiogroup under the composer.
2. As a **User**, I want my mode choice to survive reload and apply to the next send, so I do not re-pick every session.
3. As a **User** on Settings → General, I want the explained three-way pill and Free OpenRouter link unchanged, so the dock is compact and Settings stays the place that teaches.
4. As a **User** on Paper, I want the same Coach dock as Home, so I am not learning a second box.
5. As a **User** who talks about a doc, I want that talk to be a Thread, so I can open it on Home and keep going.
6. As a **User** on Home History, I want that Paper Thread listed under an honest title, so I can find it.
7. As a **User** on Paper, I do not want a control named "AI assist", so the product name stays Coach.
8. As a **User** watching Coach edit the open doc, I want the canvas to update without a manual reload, so I can see the work happen.
9. As a **User** with unsaved edits when Coach writes, I want an honest choice (Keep mine / Use Coach's version), so I never lose work silently.
10. As a **User** who selected text, I want Rewrite selection available and the Coach to prefer that span, so I am not restating the highlight.
11. As a **User** reading a receipt, I want a named headline and (for CV edits) expandable hunks, so I can scan what changed.
12. As a **User** waiting on a turn, I want a calm Working state — not pulse dots — so the product stays grounded.
13. As a **User** who prefers reduced motion, I want enter, collapse, bar, and highlight animations off, so the Coach does not move at me.

## Decisions

- **One dock, not two products.** Home and Paper share `CoachDock` and `useCoachTurn`. Paper has no mode picker.
- **Thread is the continuity key.** `focus_doc_id` on the Thread row; `GET /api/threads?focusDocId=` returns the latest Thread for that User + doc, or null. Coach resolves `body.focusDocId ?? thread.focusDocId` after ownership checks.
- **Live canvas sync is `updatedAt`-keyed.** Conflict UI is required when the User is dirty. Highlight uses `--duration-slow` and honours reduced motion.
- **Selection is optional turn context** (`text` capped, optional `sectionId`). Empty selection disables Rewrite selection.
- **Three rich receipts in production `ThreadView`.** Drop `Ran <command> —` from user-facing headlines when a named detail exists. Failures stay one plain line. The `/prototype/coach-receipts` sandbox is gone.
- **Motion is Spec 6 tokens only.** No new animation vocabulary. No gamification.

## Ticket breakdown

Five tickets under one parent. Frontier was S7.1 and S7.2 in parallel; S7.3 needed both; S7.4 and S7.5 needed S7.3.

| Ticket | Scope | PR |
| -- | -- | -- |
| [QVE-169](https://linear.app/quanvm/issue/QVE-169) S7.1 | `CoachDock` + Home mode dropdown; Settings pill unchanged | [#162](https://github.com/quanvu309/openpath/pull/162) |
| [QVE-172](https://linear.app/quanvm/issue/QVE-172) S7.2 | `threads.focus_doc_id` + drop sessionStorage | [#163](https://github.com/quanvu309/openpath/pull/163) |
| [QVE-170](https://linear.app/quanvm/issue/QVE-170) S7.3 | Paper dock + shared `useCoachTurn` | [#164](https://github.com/quanvu309/openpath/pull/164) |
| [QVE-173](https://linear.app/quanvm/issue/QVE-173) S7.4 | Live doc sync, selection, rich receipts | [#165](https://github.com/quanvu309/openpath/pull/165) |
| [QVE-174](https://linear.app/quanvm/issue/QVE-174) S7.5 | Calm Coach motion | [#166](https://github.com/quanvu309/openpath/pull/166) |

The parent carries the verification protocol: a fresh agent that implemented none of the five verifies every child criterion against `main`, the full check suite including the migration gate, and this Definition of done.

## Definition of done

- [x] Home idle and active Thread show mode inside the dock; no radiogroup under the Home composer
- [x] Settings → General still has the three-way pill, helper copy, and Free OpenRouter link
- [x] Paper has no "AI assist" control; shared `CoachDock` sits under the document; no mode picker
- [x] Talk on a doc is a Thread (`focus_doc_id`); it appears in Home History and continues with the same messages
- [x] `sessionStorage` doc→thread mapping is gone; `use-paper-coach.ts` and `paper-ai-chat.tsx` are gone
- [x] Coach `paper.updateContent` on the open doc updates the canvas; dirty + Coach write shows Keep mine / Use Coach's version
- [x] Selection is sent on Paper turns when present; Rewrite selection is disabled when empty
- [x] Three rich receipt types render in production `ThreadView`; Undo still works
- [x] Working state is "Working…" + thin bar on Home and Paper; enter / collapse / highlight honour `prefers-reduced-motion`
- [x] CI green including the pglite migration gate; CI burns zero OpenRouter tokens
- [x] ADR-0009 records dock dropdown vs Settings pill

## Out of scope (unchanged)

Billing, mode map changes, Pitch Coach, `paper.patchContent`, voice input.
