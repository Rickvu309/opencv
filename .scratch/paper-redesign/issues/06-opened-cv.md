# Opened CV: the A4 is the canvas

Type: prototype
Status: resolved
Blocked by: 04

## Question

How do you work *on* the A4 — the output — so a deadline-night student knows what to do without a form that paints a preview?

Locked by [The Drive–Docs seam](03-the-drive-docs-seam.md): you edit the sheet. Structured blocks live on the page. A slim palette adds sections (Employment, Education…) — tools, not a second copy of the CV. Completeness only here (and later on a Coach thumbnail, not this map). Band: Back, editable title, type word, Export. No CV | Letter tabs. Black-on-white document.

**Reference:** chatPRD’s document editor — you edit the artifact itself ([writing documents](https://www.chatprd.ai/docs/writing-documents)). Steal: the output is the canvas. Reject: chat-left / document-right as required Docs chrome (Coach stays a quiet offer). Resume.io stays a reference for pages and export-on-the-object, not for form-paints-preview.

Open: how a block is selected and typed; where the palette sits; where the Format bar lives; what happens below `md`; how completeness sits without turning the page into a dashboard; how much “formatting” the person ever has to think about.

Raise fidelity with a cheap artifact and link it. Use `/grilling`, `/better-layout`, `/impeccable` (layout). Do not ship the editor.

## Answer

Locked 15 Aug 2026. Artifact: [opened-cv-outline.md](../research/opened-cv-outline.md). Spec: [Opened CV](../spec.md). Motion values → [What My Paper motion is for](10-what-my-paper-motion-is-for.md). Tokens are advisor.

### Concept

| Asked | You chose |
| --- | --- |
| How do you type? | **Caret on the A4.** No popover. No drawer. |
| Empty block? | **Ghost text on the paper.** Never real content. |
| Palette? | **`+` between blocks** opens a short list. Not a permanent column. |
| Format? | **On the desk, beside the sheet.** Template opens the gallery. Almost no formatting (situation + density; accent only if the situation earns it). |
| Completeness? | **Quiet % in the band**, trailing, next to Export. |
| Phone? | **No Edit \| Preview.** Only the sheet. |
| Select a block? | **Quiet outline + drag to reorder.** |
| Page 2? | **Stacked pages you scroll.** Visible break. |
| Keystroke? | **As they type.** Undo is the store. No Save. |
| Photo? | **Click the frame on the A4.** |
| Empty after pick? | **Ghost starter blocks** already on the page. |
| Desk? | **Sheet on Drive’s leading edge**, desk around it. |
| Coach? | **Quiet offer on the desk.** No inline rewrite in this map. |
| Export? | **Band, trailing.** Not on the sheet. |

### Navigate, fix, line

| Asked | You chose |
| --- | --- |
| What is a line? | **Each field is a line** (role, org, period, bullet). Looks like one job. |
| Fix? | **Select, type over.** Backspace empties the line. Delete a *block* from the outline control. No swipe. |
| Navigate? | **Click any line.** Tab / Shift-Tab between lines. Arrows inside a line, then to the next. No outline pane. |
| Canvas motion? | **Add: Reveal.** **Reorder: Layout animation.** Caret, hover, Tab: **instant.** Page break: scroll only. |
| Empty line vs block? | **Ghost stays while they think.** Line may collapse after they leave it empty. Starter section stays until they delete the block. |

### Advisor tokens

- A4 `aspect-ratio: 1 / 1.414`. Desk uses the second neutral. Sheet is paper-white, 1px hairline. No shadow + border.
- Selected block: instant ink outline. Drag handle appears with the outline (24px clearance from borderless controls).
- `+` hit at least 44px. List is a short menu, not a panel.
- Completeness: 12px tabular label in the band. Not a bar on the sheet.
- Ghosts: muted ink, ≥4.5:1 if they must be read as instructions — prefer a darker muted than default placeholder grey (`/better-colors`).
- Below `md`: sheet uses the full content width minus desk inset 16px. No second pane.
