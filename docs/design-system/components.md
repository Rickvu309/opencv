# Components

The template craft. One block per reusable piece; a screen is assembled from these blocks and invents nothing. Each block: **anatomy** (parts and their tokens), **variants**, **states** (rest / hover / focus / active / disabled / loading), **internal spacing**, and **copy hooks** — the slots whose words [copy.md](../copy.md) and the feature specs own. Blocks cite the [layout.md](layout.md) region they may appear in. Where the code diverges today, the block carries a *code today* line; those lines plus the [tokens.md](tokens.md) migration table are the implementation checklist.

## House rules

The [interfaces.dev cheat-sheet](https://interfaces.dev/cheat-sheet) baseline, adopted wholesale. Every block below assumes these; they are not restated per block.

- Native elements: `<button>` for actions, `<a>` for navigation, never a div with a click handler.
- `:focus-visible` shows `--focus-ring`; `outline: none` never ships without a replacement.
- `tabindex` is only ever `0` or `-1`.
- Icon-only controls carry an `aria-label` written by purpose ("Close", not "X icon"); decorative elements get `aria-hidden` and `pointer-events: none`.
- Every input has a real `<label>`, a `type`, and an `inputmode`. Paste is never blocked.
- Submit stays enabled until the request starts; validation runs on submit — `aria-invalid`, `aria-describedby` at the error, focus moves to the first invalid field.
- Hit areas: 44px on touch, 40px minimum on desktop, never overlapping.
- Hover styling behind `@media (hover: hover)`; motion behind `prefers-reduced-motion` per [motion.md](motion.md).
- `role="status"` for routine updates (toast, saving), `role="alert"` only for urgent errors.
- State changes never use color alone — a word, a fill, or an underline rides along.
- Disabled controls that need explaining use `aria-disabled="true"` and visible text, because tooltips on `disabled` don't open for keyboard or touch.
- Button labels start with a verb; confirmations repeat the consequence ("Delete conversation" beside "Cancel"); one word per flow; toggles are labelled by the state they turn on.

---

## Shell templates

### The shell composition

**Region:** the frame around every signed-in screen ([layout.md](layout.md) layers 2–4).
**Anatomy:** `--canvas` backdrop; rail on the left (on the canvas, no hairline); the main column is a `--surface-1` panel with a `--hairline` edge and `--radius-container` on all corners, inset by 8px so it floats — the Linear composition. Header (bell) sits in the canvas gutter above the panel, quiet.

### Rail

**Region:** chrome, left. Default `--size-rail` (16rem). Becomes the drawer below 768px (drawer stays 16rem). Desktop can collapse to an icon rail (52px) like Grok; ChevronsLeft in the header hides it, ChevronsRight above account shows it. The right edge is a 1px `--hairline` that is also the resize handle (hit area 12px, centered on the line). Desktop width is user-resizable between 12–20rem when expanded; double-click resets; width and collapsed state persist in `localStorage`.
**Anatomy:** Mark + OpenPath and Hide on the header row → Coach as an icon+label row like Paper → collapsible Prepare, Opportunities, then History under Apply → account. Collapsed: icons only, Show above account. History keeps its label when there are no threads.
**Internal spacing:** shell `p-2` (8). Rows `min-h-10`, `px-2`, icon-label `gap-2` — one leading edge at 16px from the rail. Intra-group `gap-1` (4) including label-to-items. Inter-group `16` (Coach → Prepare, Prepare → Opportunities, Opportunities → History, History → Account). Header to Coach `8`. Hide is `size-8` `rounded-full`.
**States:** rest transparent on `--canvas`. Coach, Paper, Pitch, Search, and Apply are one row style: `ui` 13/510 `--ink`, matching icon. Hover fills `--surface-3` (the step that reads on canvas); a sliding pill follows the hovered item only. Active is `font-[590]` `--ink` (icon stroke 2), no rest fill. Press `scale(0.97)`. Focus ring.
**Copy hooks:** group labels, Coach, New conversation, History, the menu verbs.
**Thread item:** truncating title with `title` attribute for the full value; `···` menu trigger (text, not an icon) revealed via Hoverable as a sibling control; Rename and Delete in its menu. History groups as Today / Yesterday / Earlier once the list is long enough; a search filter sits above the list. While conversations load, history skeleton rows hold the slot.
**Account control:** the user's name, wrapping — never clipping — "Nguyễn Thị Ngọc Ánh"; opens Profile / Settings / Sign out.

### Header

**Region:** chrome, above the main panel.
**Anatomy:** drawer trigger (Menu lucide icon, ghost, `aria-label="Open menu"`, mobile only) leading; bell trailing. Bell hover is a circle (`rounded-full`), not `--radius-control`. Nothing else — the band inside `main` owns the title.

### Coach dock

**Region:** layer 3, bottom-right, everywhere except `/coach`. Never covers the artifact's primary action.
**Variants:** closed pill — Mark + “Coach”, `--surface-1`, `--hairline`, `--shadow-overlay`, `--radius-control`, 44px, `--ink-muted` until hover; open panel (desktop) — `--size-dock` bordered `--radius-container` panel, 12px inset, `--shadow-overlay`: 40px header (title `title-sm`, Open Coach icon `Maximize2` `aria-label="Open Coach"`, Close ghost) then compact thread and compact composer; sheet (mobile) — bottom sheet 70vh, same compact body, Open Coach in the sheet header.
**States:** leaving `/coach` opens the panel on the same thread; Open Coach returns to `/coach` (`?thread=` when there is one); Close and Esc collapse to the pill and restore focus; the panel fades + scales in and exits the same way per [motion.md](motion.md); offline renders the offline sentence in the body; streaming per the message block. Compact thread: no empty mark, no email-connect banner, tighter message stack. Compact composer: field + send/stop; speed and dictation live in More; Call yields.
**Copy hooks:** the pill label, Open Coach, Close, the offline sentence.

### Drawer and dock sheet

**Region:** layer 4 overlays. Focus trapped; Esc and scrim close; focus returns to the opener.
**Anatomy:** `--surface-1` panel, `--scrim` behind, `--shadow-overlay`; drawer is `--size-rail` from the left, sheet is 70vh from the bottom. Slide per [motion.md](motion.md).
An overlay is never a place: no URL, the screen behind stays live.

---

## Primitives (`packages/opath-ui`)

### Button

**Variants:** primary (accent fill, `--on-accent` text — **one per screen**, the layout's primary slot); outline (`--hairline` border on `--surface-1`); ghost (transparent, `--ink` text); danger (`--destructive` fill, delete only).
**Sizes:** `sm` 40px, `md` 44px (default), `lg` 48px / 15px (marketing CTAs). Links that look like buttons use `buttonAttrs({ variant, size })` so they carry `data-variant` and `data-size`.
**Anatomy:** `ui` 13px at weight 510 (`lg` is 15px), `--radius-control`, 44px min height on `md`, 16px horizontal padding (`lg` is 20px).
**States:** hover — primary to `--accent-hover`, others fill `--surface-2`; pressed — `scale(0.97)` + `--surface-3` on quiet variants; focus ring; disabled opacity 0.5; loading keeps the label and appends "…" (no spinner-only buttons).

### Input, Textarea, Label

**Anatomy:** Label above (`ui-label`, 510), 4px gap, then the field: `--surface-1`, `--hairline` border, `--radius-control`, `body` 15px text, `--ink-faint` placeholder. 44px min height; textareas min 7 lines for writing surfaces.
**States:** hover border unchanged (fields don't hover); focus — border to `--accent` plus `--focus-ring`; invalid — `aria-invalid` and the error sentence in `ui` under the field, written with a next step; disabled opacity 0.5.
**Rules:** placeholder shows format, never acts as the label; error copy is a sentence, not a code.
**Copy hooks:** label, placeholder, error sentence.

### Band

**Region:** first element inside `main` on every screen that has chrome.
**Anatomy:** optional Back (ghost, above); title row — h1 `title-lg` 24/590 with `text-wrap: balance`, optional meta line under it (`ui`, `--ink-muted`, type word lives here); actions trailing — primary then quiet ghost secondaries (not a second outline button); optional filter row below.
**Yield:** actions wrap under the title before the primary ever leaves the band; the filter collapses first ([layout.md](layout.md) owns the order).
**Copy hooks:** title, meta, action labels.

### BandFilter

**Anatomy:** a row of text pills, `ui` 13px, `--radius-control`, 8px gap y-compressed.
**States:** rest `--ink-muted`; hover `--surface-2`; active `--surface-3` fill + `--accent` text (never accent fill); focus ring. Filters never animate (high-frequency).

### Row and RowList

**Region:** the unit of every Drive list.
**Anatomy:** hairline-divided list (`--hairline`) that bleeds to the panel edges on Drive lists; each row 44px min: label leading (`title-sm` 15/510), meta trailing (`ui` 13, `--ink-muted`, `tabular-nums` on dates), optional status chip between, optional `···` menu as a sibling control so the row stays one target. Type is a word in the meta, not an icon. One shared content inset for every row in the list (matches the band title).
**States:** rest flat; hover `--surface-2` (only when the row acts); pressed `--surface-3`; focus ring on the row.
**Wrap law:** meta wraps under the label before the label truncates; no fixed widths.
**Copy hooks:** label, meta, menu verbs.

### EmptyState and NotFoundState

**Region:** the content slot, under the same band, per the five-kinds law in [layout.md](layout.md).
**Anatomy, fixed order:** one sentence (`body` 15, `--ink`); optional basis line (`ui`, `--ink-muted`, never invented); one action after 24px. `data-empty-kind` names the kind. No illustrations, no mascots.
**Variants:** first-run / cleared / filtered / error / offline are copy variants of this one template — same bones, different words, per-screen copy in the feature specs.
**NotFound** is the error variant with an outline link-button back to the list.

### Skeletons

**Anatomy:** `--surface-2` blocks with `--radius-control`, pulsing per [motion.md](motion.md); `aria-busy` on the group. Variants: block, rows (mirrors Row geometry), section (label + two fields), page (the A4 silhouette on the stage), thread (three message-width bars), history (rail thread rows).
**Law:** a skeleton holds the exact slot of the content it precedes — no reflow when content lands, and it is never shown as an empty state.

### Dialog and ConfirmDialog

**Region:** layer 4, centered.
**Anatomy:** `--scrim`; panel max-w-md on `--surface-1`, `--radius-container`, `--shadow-overlay`, 24px padding; title `title` 18/510; body `ui` in `--ink-secondary`; actions right-aligned after 16px — Cancel (ghost) then the verb.
**Confirm variant:** destructive only; the confirm button is danger and repeats the consequence ("Delete conversation"); it names the noun in the title.
**States:** fade + scale in; Esc and scrim close; focus trapped and restored.
**Copy hooks:** title, body, confirm verb.

### DropdownMenu

**Region:** layer 4, anchored to its trigger.
**Anatomy:** `--surface-1`, `--hairline`, `--radius-container`, `--shadow-overlay`, 4px padding; items 44px, `ui` 13px, `--radius-control`; destructive items in `--destructive`.
**States:** highlighted `--surface-2`; scales in from the trigger origin per [motion.md](motion.md).

### Toast — Sonner

Already installed; this block is its contract. `<Toaster />` at the root configured: bottom-center on mobile, bottom-right ≥768px; default duration; swipe-to-dismiss follows position; `richColors` off — toasts stay `--surface-1` on `--hairline` with `--shadow-overlay`, matching the system instead of shouting.
**Anatomy of the one toast that matters:** "Saved" + an Undo action; undo completion re-toasts "Undone". Toast text is `ui` 13px; it is a `role="status"` live region — streamed Coach replies and undo announce here for screen readers.
**Law:** toasts confirm; they never ask questions, never stack more than three (Sonner collapses), and never carry destructive actions other than Undo.

### SkipLink

First focusable element on every page; visually hidden until focused, then a `--surface-1` chip at the top-left, z 50. Anchored headings get `scroll-margin-top`.

### Chip

**Region:** status on Apply rows, fit on Search rows.
**Anatomy:** `--radius-pill`, `ui` 13px, 4px gap, optional 6px status dot (`--status-*`) beside the word. Never a colour without the word.
**Variants:** quiet (`--hairline` border), status (dot + word), code (mono 12px on `--surface-2` for command names and paths).
**States:** rest; hover `--surface-2` when it is a control; focus ring.

### Tooltip

**Region:** any icon-only control that needs a word.
**Anatomy:** `--surface-1`, `--hairline`, `--shadow-overlay`, `--radius-control`, `caption` 12px. Delay 200ms. Never the only explanation for a disabled control — disabled uses visible text instead.
**States:** fade in 120ms; Esc dismisses.

### Collapsible

**Region:** reasoning panel, tool call, approval card.
**Anatomy:** trigger row 40px desktop / 44px touch; chevron always reserved on the right so rows never shift; content height is the one tolerated accordion exception in [motion.md](motion.md).
**States:** open / closed; chevron rotates 150ms; `aria-expanded`.

### Tabs

**Region:** format bar density/section groups; any in-page toggle group.
**Anatomy:** `role="tablist"` of text pills matching BandFilter. Active `--surface-3` + `--accent` text. Never accent fill. No animation.

### Table

**Region:** Apply pipeline when a status group is a set of columns rather than a chip-on-row.
**Anatomy:** `@tanstack/react-table` inside a hairline-divided list. Header `ui-label` `--ink-muted`; cells `body` 15px; `tabular-nums` on dates and counts. Status lives in a Chip slot.

### Code and CopyButton

**Region:** payload view.
**Anatomy:** `--font-mono` 13px on `--surface-2`, `--radius-control`, 12px padding. CopyButton is a Hoverable ghost at the top-right (`aria-label="Copy"`), swaps to "Copied" for 1200ms via `role="status"`.

### Loader

**Region:** pending approvals.
**Anatomy:** 16px stroke icon, `aria-hidden` when a word already names the state. Never a spinner-only button.

### Card, EmptyMessageCard, EndOfList

**Card:** `--surface-1`, `--hairline`, `--radius-container`, 16px padding. Used for artifact cards in the thread and situation cards.
**EmptyMessageCard:** one sentence + optional action; same bones as EmptyState, smaller, for in-thread nothing-yet.
**EndOfList:** a quiet `caption` `--ink-faint` line after a Drive list ("That's all.").

### Switch and Checkbox

**Region:** Settings notification toggles; checklist rows.
**Anatomy:** native-accessible Radix controls, 44px hit area, label on the on-state. Thumb on `--surface-1`; track `--surface-3` off, `--accent` on.

### Interactive and Hoverable

**Interactive:** one place where variant, prominence, and state (`empty` / `filled` / `selected`) resolve to hover, active, disabled, and focus. Everything clickable (Button, rail item, chips that act) sits on it.
**Hoverable:** CSS-only reveal. Where hover does not exist (`@media (hover: none)` / `no-hover:`), the revealed state is permanent so row menus stay reachable on phones.

### InfoBlock, Keycap, Truncated, FadingEdge, StickToBottom

**InfoBlock:** quiet callout, `--surface-2` fill, `ui` 13px.
**Keycap:** `--font-mono` 12px, `--hairline` key, used in composer hints.
**Truncated:** one-line ellipsis with `title` for the full value.
**FadingEdge:** mask at the end of a horizontally overflowing chip strip.
**StickToBottom:** thread viewport sticks to the latest message; a "Latest" ghost control appears when the user scrolls up.

---

## Cards and surfaces

### Situation card

**Region:** the content slot of `/paper` (gallery state) and the opened letter's chooser ([features/paper.md](../features/paper.md)).
**Anatomy:** the one card in the commodity app — `--surface-1`, `--hairline`, `--radius-container`, 16px padding; type word first (`ui`, `--ink-muted`), situation label under it (`title-sm` 510). The whole card is the button.
**States:** hover `--surface-2`; pressed `scale(0.97)`; focus ring. A grid, 2-up from `sm`, 12px gap.
**Copy hooks:** the heading above the grid ("Where is this CV going?"), the type word, the labels.

### A4 page

**Region:** the document surface of Opened document, on a muted stage (`--surface-2` on the panel).
**Anatomy:** `#ffffff`/`#000000` always — outside app theming, sharp corners, `--size-page`. Inside: name, contact, then sections with 32px rhythm; section headings 13px/510 uppercase tracked; ghost inputs — borderless fields whose placeholder (`--ink-faint`) is the scaffold; page actions ("Add a role") as quiet text buttons on the page, `--ink-muted` to `--ink` on hover.
**Density variants:** normal 16/1.6 with 48px page padding; tight 14/1.4 with 32px.
**Law:** the page prints exactly as it looks; everything else carries `data-print-hide`. Ghost inputs never show borders — the page is paper, not a form.

### Format bar

**Region:** between the band and the stage on Opened document.
**Anatomy:** a toolbar (`role="toolbar"`) under a hairline: density toggle group, section toggle group (CV only), completeness fact trailing (`ui`, `--ink-muted`, `tabular-nums`).
**States:** toggle pressed state is `--surface-3` + `aria-pressed`, off-state `--ink-muted`; never accent fill. No animation — tens-of-times-a-day tier.
**Copy hooks:** the completeness sentence ("3 of 4 profile lines are on this page.").

### Chat composer

**Region:** the primary slot of Conversation; also the dock body's foot. Pattern copied from [AIcss ai-agent-input](https://www.aicss.dev/components/ai-agent-input): one bordered surface containing the field and its controls, not a bare textarea with a button below.
**Anatomy:** pill bar (`rounded-full`, `--hairline`, 6px vertical pad, 12px left / 6px right). Left cluster: More (`+`) then the field. Right cluster (`gap-2`): Fast / Coach / Careful, dictation, Call (idle) or Send / Stop. All controls 32px, vertically centered. The field is a 32px line box (`leading-6`, 4px pad) so the placeholder sits on the same center as `+` and Fast. Compact (dock): More also holds speed and dictation; Call yields; send stays and is disabled while empty.
**States:** idle — send disabled at opacity 0.5 while empty; filled — send enabled; **working** — send becomes Stop (`aria-label="Stop"`), an interrupt hint ("Stop to send something else") sits under the surface, and a second typed message queues in a bar above the composer and sends itself when the reply finishes; offline — disabled with the offline sentence above.
**Keys:** Enter sends, Shift+Enter breaks — and the hint is discoverable in the placeholder on first run.
**Copy hooks:** placeholder, offline sentence.

### Chat message

**Region:** the thread body of Conversation and the dock.
**Variants:** user — right-anchored block on `--surface-2`, `--radius-container`, max ~65ch; Coach — markdown `body` text on the panel (`.md-body`), no bubble; failed — the failure sentence in `--ink-muted` with one Retry (outline) under it; streaming — text appends per [motion.md](motion.md), a static "Coach is replying" line under reduced motion.
**Action bar:** Hoverable row under a settled Coach message — Copy, Retry. Revealed on hover; always visible on touch.
**Law:** no avatars, no role labels once the styling distinguishes roles; timestamps only on hover/long-press, `tabular-nums`.

### Reasoning panel

**Region:** thread, above the Coach reply (live while a turn is working; persisted on later loads).
**Anatomy:** collapsible trigger (40px desktop / 44px touch) — shimmering **Thinking** plus optional elapsed (`tabular-nums`, `4s` / `1m 8s`) while streaming; settled label **Thought for 4s** (or **Thinking** if no timer). Chevron reserved right, rotates 180 when open. Body: `<ol>` of `{ title, body }` steps, 5px dots, last visible step's dot `--accent` and pulses while streaming; settled dots `--ink-faint`. Opens when the first step arrives while streaming; user can collapse. Empty content with no stream renders nothing; a turn with no reasoning degrades to the working composer state only.
**Law:** do not install `@assistant-ui/react`. Port anatomy; restyle to tokens. No `dark:`, no `bg-blue-500`, no `animate-in`. Full column width in the thread (not `max-w-sm`).
**Copy hooks:** streaming label, settled label.
**Reference:** [assistant-ui reasoning panel](https://www.assistant-ui.com/elements/reasoning-panel).

### Tool call

**Region:** thread, between user message and Coach body.
**Anatomy:** collapsible trigger (40px desktop / 44px touch). Left chevron (`ChevronRight`, rotates 90 when open). Shimmering **activeLabel** while running (for example **Adding paper**); settled **label** (**Added paper**); failed keeps the running verb without shimmer so it never claims the write. Optional query chip (`font-mono` 12, `--surface-2`) summarizing the call target. Right slot reserved: empty while running, `--status-positive` check when settled, `--destructive` alert when failed. Body: `--surface-2` `--radius-container` panel with **Request** (mono, `--ink-muted`) and **Result** (`--ink`), hairline between. Full column width (not `max-w-sm`). Failed calls auto-open. `app.open` that succeeded still yields the artifact card, not this row.
**Group:** consecutive calls stack with 4px gap; no extra card around the stack.
**Law:** do not install `@assistant-ui/react`. Port anatomy; restyle to tokens. No `dark:`, no `text-emerald-500`, no `animate-in`.
**Copy hooks:** running verb, settled verb, Request, Result.
**Reference:** [assistant-ui tool call](https://www.assistant-ui.com/elements/tool-call).

### Approval card and payload view

**Region:** thread, when a destructive `agent: true` command would otherwise run.
**Anatomy:** header "Needs you: {verb}"; actions on the row — Do it (primary), Don't ask again in this conversation (outline), Not now (ghost). Body: per-action list plus PayloadView (sanitized JSON, copy). Conflict (already applied) re-reads rather than implying the decision landed. ~800ms settle hold per [motion.md](motion.md).
**Law:** the decision runs through the command bus so Saved / Undo still apply. The Coach never claims the write until the tool succeeded.
**Copy hooks:** header, the three verbs, conflict sentence.
**Reference:** Onyx Craft Approval Card. Mechanism: [coach-hands.md](../mechanisms/coach-hands.md).

### Artifact card

**Region:** thread, after a successful create/update that opened a place.
**Anatomy:** Card with type word (`ui` `--ink-muted`), title (`title-sm`), one outline "Open {noun}". Cards are windows, never editors.

### Starter chip and activation checklist

**Region:** the empty thread only ([features/coach.md](../features/coach.md) owns copy).
**Starter chip:** a `--hairline` pill (`--radius-pill`, `ui` 13), hover `--surface-2`; tapping fills the composer, never auto-sends. Sits under the empty composer.
**Checklist item:** unused on Coach empty; progress is still derived from real state if a later surface needs it.

### Search result row

**Region:** Drive list rows on `/search`; detail is in-page state in the same column.
**Anatomy:** Row plus a second line: opening title (`title-sm` 510), org + location meta (`ui`, `--ink-muted`), and the fit **shown with its working** — "Fit 7 of 10 — matches SQL, misses Excel" as a sentence chip, never a bare score. Save to Apply is the detail's primary.
**States:** Row states; the opened detail replaces the list under the same band with Back within the page.

### Apply pipeline

**Region:** `/applications`, grouped by status.
**Anatomy:** status group heading (`ui-label`, `--ink-muted`, count in `tabular-nums`) over hairline rows; each row — opening label, org meta, and the status as a **select control on the row** (a chip-styled trigger with a chevron opening a DropdownMenu), never a second page. Status chips pair the dot (`--status-*`) with the word.
**States:** Row states; moving status re-groups the row without animation (route-change tier).

### Sectioned-editor section

**Region:** the unit of `/profile`, `/pitch`, `/settings`.
**Anatomy:** heading outside the group surface (`title` 18/510), then the fields on one shared content inset — the Umbra law made flesh; each field row: Label leading, control trailing at a readable field width (~280px from `sm`, wrapping on small screens), grouped with space not hairlines. Quiet per-section save right-aligned (state announced in the toast, no per-row Save buttons where blur-save works). Completeness sits inside the first Profile section as a fact with its basis, never a hero metric.
**Danger sections** sit last; their actions are danger buttons confirming via ConfirmDialog.
**Copy hooks:** section headings, field labels, the completeness sentence.

### Wizard step

**Region:** `/onboarding`, no rail.
**Anatomy:** one question (`title-lg`), the answer control, the payback line landing in the same frame (`ui`, `--ink-muted`, appears with the answer — fade in, the one rare-tier animation), then Continue (primary) and Skip (ghost) — Skip always visible, never shamed.
**Copy hooks:** question, payback line, Skip label.

### Narrow form

**Region:** `/sign-in`.
**Anatomy:** max-w-sm centered column: heading (`title-lg`), fields stacked 16px, one primary full-width, one text link to the other mode. Nothing else — no social wall, no filler sentence under the heading.
**States:** submit keeps every value on failure; field errors per the Input block.

### Sign-up card

**Region:** `/sign-up`.
**Anatomy:** centered on `--canvas` (`p-6` / `md:p-10`). `--surface-1` card (`--radius-container`, `--hairline`, no pad). From `md`, two columns: form (`p-6` / `md:p-8`) and a `--surface-2` panel with the landing grid and the mark. Password and confirm sit on one row from `sm`. Hint under the pair: "Use at least 8 characters." No social buttons, no terms line, no filler under the heading.
**States:** same as Narrow form.

### Public canvas pieces

**Region:** `/`, `/p/$slug`, `/u/$handle` — no signed-in chrome.
**Landing:** cloned from [onyx.app](https://onyx.app/) ([onyx-landing-hero.png](refs/onyx-landing-hero.png)). Sticky nav: mark + OpenPath, Sign in outline (`border-ink`), Start now primary. Hero: who it is for, promise, product composer, then a Sign in / Sign up segmented box (`--radius-container` shell, `p-1.5`, `--radius-control` inner). Waitlist, then footer.

**Landing composer:** [assistant-ui chat-panel](https://www.assistant-ui.com/elements/chat-panel) composer. Do not install `@assistant-ui/react`. One pill bar (`h-10`, `rounded-full`, `--hairline`, `--surface-1`, `ps-4 pe-1.5`). Field plus send (`size-7`, `rounded-full`). Send is accent when the field has text, `--surface-3` when empty. No suggestion chips, attach, `@` sources, `/` commands, model picker, or dictation.
**Proof page frame:** the published work is the page; OpenPath is at most a quiet `ui` footer. Art direction beyond the frame belongs to [mechanisms/proof.md](../mechanisms/proof.md) — the one expressive surface in the product.
**Personal page span record:** each Proof a Row-like door to `/p/$slug`, hairline-divided, dates in `tabular-nums`.

---

## Lab sourced galleries

Commodity kits catalogued in Opath (Lab) Storybook under `packages/opath-ui/src/lab`. These are review surfaces, not Production primitives. Lab kit controls that have a Production counterpart (button, input, textarea, label, checkbox, switch, badge, card, tabs, dialog, sheet, tooltip, dropdown, table, skeleton, select) restyle to the Production token blocks above so a login or dialog preview matches the app. Leftover shadcn class names map through `lab/tokens.css`, CSS-imported from Lab Storybook preview. Promote a piece by writing its block here and landing a restyled primitive at the package root. The sidebar is Components vs Templates, not kit names. Opath (Production) Storybook also shows `Primitives/Gallery` from this package.

| Storybook | What it holds |
|---|---|
| Lab/Components/Actions | Buttons, theme switcher, selection actions |
| Lab/Components/Forms | Inputs, selects, comboboxes, dropzones, calendars |
| Lab/Components/Overlays | Modals, drawers, popovers, tooltips, dialog stacks |
| Lab/Components/Navigation | Tabs, docks, sidebars, rails |
| Lab/Components/Data | Tables, graphs, badges, trees, JSON |
| Lab/Components/Feedback | Toasts, loaders, banners, status |
| Lab/Components/Motion | Transitions.dev recipes and motion primitives |
| Lab/Components/Media | Video, marquee, comparison, reels |
| Lab/Components/Chat | Thread chrome: thinking, tools, prompt, cards |
| Lab/Templates/Auth | Login screens |
| Lab/Templates/Onboarding | Onboarding flows |
| Lab/Templates/Dialogs | Full dialog screens |
| Lab/Templates/Application | Sidebars, stats, uploads, kanban, canvas |
| Lab/Templates/AI | AI panels and command menus |
| Lab/Templates/Marketing | Landing sections (hero, footer, FAQ, careers) |

Map: [clone-sources.md](clone-sources.md). Attribution: [NOTICE.md](../../NOTICE.md).

---

## Adding a block

A new visual pattern starts here: write the block (anatomy, variants, states, spacing, copy hooks, region, reference if it copies one), get it into this file in the same PR as the code, and extend the tokens instead of inventing values. If it moves, it also earns a row in [motion.md](motion.md)'s inventory. Micro-interactions come from [interactionkit.org](https://interactionkit.org/) or the AIcss library as references — adapted to these tokens, never pasted with their own.
