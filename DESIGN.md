# Design

## Theme

Monochrome, light. Near-white page, white panels, hairline borders, near-black ink and near-black primary buttons. Colour appears only as small semantic signals (status dots, a single icon), never as a surface fill. Reference points: OpenAI's product surfaces, Linear, Stripe dashboards.

## Color

All tokens live in `app/globals.css`. Use the Tailwind token classes, never raw hex.

| Role | Token | Use |
|---|---|---|
| Page | `bg-background` | App shell + page background (oklch 0.98) |
| Panel | `bg-card` | White panels sitting on the page |
| Ink | `text-foreground` | Headings, values, primary text |
| Secondary ink | `text-muted-foreground` | Labels, meta, descriptions |
| Hairline | `border-border` | Every divider and panel edge, always 1px |
| Primary | `bg-primary text-primary-foreground` | The one main action per view |
| Fill | `bg-muted` / `bg-secondary` | Chips, inactive segments, bar tracks |

Semantic accents — `text-success`, `text-warning`, `text-danger`, `text-info` — are for status dots (`size-1.5 rounded-full bg-success`), a status word, or one icon. Never a background wash, never a coloured card.

Charts are a graphite ramp: `bg-chart-1` (near-black) is the attained/current value, `bg-chart-2` (light grey) is the remainder.

## Typography

One family: Be Vietnam Pro (`font-sans`), chosen for Vietnamese diacritics. Fixed rem scale, no fluid clamps.

- Page title: `text-xl font-semibold tracking-tight`
- Section heading: `text-base font-semibold tracking-tight`
- Body / table cell: `text-sm`
- Meta, labels, table headers: `text-xs text-muted-foreground`
- Metric value: `text-2xl font-semibold tracking-tight tabular-nums`
- Chat prose: `text-[15px] leading-7`

Always `tabular-nums` on numbers that sit in a column or update in place.

## Layout

**Panels over cards.** The house pattern is one bordered container subdivided by hairlines, not a grid of floating gapped cards:

```tsx
<div className="overflow-hidden rounded-xl border bg-card">
  <div className="grid divide-x divide-border sm:grid-cols-3">…</div>
</div>
```

- Page wrapper: `mx-auto w-full max-w-6xl px-5 py-8 sm:px-8`
- Section rhythm: `mt-10` between major sections; heading to its own content `mt-4`
- Rows in a list: `divide-y divide-border`, each row `px-4 py-3`
- Filter chips: pill row, active chip is `bg-primary text-primary-foreground`, inactive `border bg-card text-muted-foreground`
- Tables: header row `text-xs text-muted-foreground` on `bg-muted/50`, body rows `divide-y`, `hover:bg-muted/40`

Never nest a card inside a card. Prefer a table or a divided list over repeated card tiles.

## Surfaces

Three layers, each a step lighter than the last, so depth reads without shadows:

| Layer | Token | Value |
|---|---|---|
| Nav rail + app canvas (chrome, recedes) | `bg-sidebar` | oklch 0.958 |
| Content frame | `bg-background` | oklch 0.98 |
| Panels (content, comes forward) | `bg-card` | white |

**The content is an inset frame, like Linear.** The shell uses `Sidebar variant="inset"`: the rail sits borderless on the grey canvas (no line under the workspace name, no footer rule) and the page content floats beside it as a rounded, hairline-bordered panel (`m-2 ml-0 rounded-xl border shadow-sm`). The frame's bottom margin is `mb-12` — that 48px gutter is where the coach strip lives, so it never overlaps content. The frame is height-capped (`h-[calc(100svh-3.5rem)]`, `h-svh` on mobile) and scrolls *inside* (`overflow-hidden` + an `overflow-y-auto` child), so full-height screens use `h-full`, never `100svh` math.

The active nav item is the exception that proves it: it jumps to `bg-card` with a hairline ring, lifting off the rail like a tab pulled forward. Hover sits between at `bg-sidebar-accent`.

## Navigation

Modelled on Linear. The rail is quiet by default and reveals structure only where it earns attention.

- **Header row**: a workspace switcher (mark + name + `ChevronsUpDown`, opening a menu with the user's identity) sits left; search and new-chat are *icon* buttons on the right, not full rows. Frequent actions cost one glyph, not one line.
- **Primary group carries no label** — Coach and Todo are where you land daily; a heading over two items is scaffolding. The profile and career artifacts sit below under "Sự nghiệp". Coach's mark is lucide's **`Megaphone`** — the same glyph in the nav, the dock chip and the message avatar. Clicking Coach opens `/coach?new=1` — a fresh chat every time, like Linear's Agent; old threads are reached through history.
- **Labelled sections** ("Sự nghiệp", "Gần đây") are `Collapsible`. The disclosure chevron is `opacity-0` until hover or focus, and the item count appears *only when the section is closed* — the rail stays still until you interact with it.
- **Counts are plain 11px muted numerals**, never badge pills. No component in the rail carries a filled background except the active item.
- **Nested items** (`SidebarMenuSub`) hang under Kế hoạch with a 1px guide line, and only while you're on that page — context appears where it's useful and disappears where it isn't.
- **Rows are 28px** (`h-7 text-[13px]`) — Linear's density, not the 32px shadcn default.
- **The rail has no footer** — identity lives in the workspace switcher, readiness and tasks live on their pages. A `?` button floats at the app's bottom-left (`components/help-button.tsx`), like Linear's, opening a lean help menu upward: redo onboarding, ask the coach how to use OpenPath, send feedback, and the ⌘B shortcut (which actually toggles). On mobile it gains `border bg-card`, same as the coach chip.

### Collapse and resize

The rail is **resizable and fully hideable** — there is no icon-rail state.

- **Drag the right edge** to resize between 208px and 400px. The handle is a 8px hit strip whose 1px line only appears on hover, focus or drag. Dragging writes straight to the `--sidebar-width` custom property via a ref — no React state per pointer move, so it stays smooth — and the width persists to `localStorage` on release.
- **Keyboard**: the handle is a `role="separator"` with `tabIndex=0`. Arrow keys nudge 8px, Shift+Arrow 32px, `Home` resets to 256px.
- **Collapsing** happens by double-clicking the edge, dragging past 168px, or `⌘B`. The rail hides entirely (`collapsible="offcanvas"`) and the content pane reclaims the full width — no icon stub.
- **Reopening is explicit only.** Nothing appears on hover; the edge element is removed entirely while collapsed, so there is no invisible target to trigger by accident. The header fades in a toggle button (its only state), and `⌘B` still works.
- **The reopen button is asymmetric**: the header shows no toggle while the rail is open (the edge already does that job), and fades one in only when it's collapsed — a hidden rail needs a visible way back. On mobile, where there is no edge, the button is always present. `⌘B` and `Enter`/`Space` on the focused edge toggle from anywhere.
- **Motion**: shadcn ships `ease-linear 200ms` on the rail; overridden to 280ms on `cubic-bezier(0.16, 1, 0.3, 1)` so it leaves fast and lands soft. Zeroed under `prefers-reduced-motion`.

## Accordion motion

Defined once on `.acc-panel` in `globals.css` so every accordion shares it.

- **Opening** runs the height over 300ms on `cubic-bezier(0.16, 1, 0.3, 1)` — fast out of the gate, settling softly.
- **The content inside** fades and rises 3px over 260ms with an 80ms delay and `backwards` fill, so text arrives just as the frame finishes opening instead of stretching with it.
- **Closing** is deliberately quicker and sharper (180ms, `cubic-bezier(0.32, 0, 0.67, 0)`) — dismissal should feel decisive, not reluctant.
- `prefers-reduced-motion` drops all three to none.

**Coach is always reachable.** Every screen except `/coach` carries the bottom-right coach strip (see "Coach dock"). This is why the chat lives in `components/coach/`: `thread.tsx` owns state and message rendering, `composer.tsx` the input, `history.tsx` the conversation list, and the page, the dock and the header switcher all consume them.

## Feedback & waiting

- `<Spinner size="sm|md|lg" />` (`components/ui/spinner.tsx`) — two-tone ring, `role="status"`. Reduced motion swaps rotation for a pulse so activity still reads. Use for transitions and async work.
- `<TypingDots />` — three dots, only for the coach composing a reply.
- Skeletons for content that has a known shape; a spinner only when it doesn't.
- Every state change gets immediate, quiet feedback: a checkbox strikes its row through, a filter updates a visible result count, an accepted suggestion turns into a confirmation line.

## Explaining things

`<Tip title="...">body</Tip>` (`components/tip.tsx`) — a muted `size-6` info button that opens a Popover with a title and one or two sentences. Use it only where a number genuinely needs defining (what a readiness % measures, how a gap is computed). Two or three per screen at most; each tip is an admission the label alone wasn't clear.

## Components

shadcn/ui (Radix base) in `components/ui`. Interactive elements carry default, hover, focus-visible, disabled states. Loading uses skeletons, not centred spinners.

Icons: lucide-react at `size-4` (`size-3.5` inside chips), `text-muted-foreground` unless the icon is the status signal.

## Chat surface

The coach chat is the product's home screen and follows the conventions of first-class AI tools.

- **Chat switcher**: on `/coach` the header title is the current chat's name with a chevron, Linear-style. It opens the **chat history popover** (`components/coach/history.tsx`): a search field, conversations grouped by day (`Hôm nay / Hôm qua / Tuần trước / Cũ hơn`) with right-aligned relative times, and a "Đoạn chat mới" footer row. `?new=1` or `?q=` shows "Đoạn chat mới" as the title.
- **Composer** (`components/coach/composer.tsx`): a `rounded-xl` bordered panel in two rows, like Linear's — the auto-growing textarea on top, then a tool row: the answer-mode dropdown (icon + label + chevron) on the left, paperclip attach and a circular primary send on the right. Enter sends, Shift+Enter newlines, IME-safe. `compact` tightens padding for the floating panel.
- **Empty state**: a quiet canvas — one greeting line, the composer (`Hỏi OpenPath Coach…`), and a row of pill suggestion chips (`h-7 rounded-full border bg-card text-xs`). No watermark, no cards, no chrome.
- **Messages**: coach replies are unbubbled prose on the page background at `text-[15px] leading-7` with a small mark to the left; user turns are a `rounded-2xl bg-muted` bubble, right-aligned. Numbered points use a hanging indent with the numeral in muted tabular figures.
- **Suggestion cards** inside a reply are how the chat writes back to the rest of the app (adding an opportunity, adjusting the career map): a bordered panel with a `bg-muted/40` action footer.
- Cross-screen handoff: `/coach?q=<question>` opens the chat with that question already asked and answered; `/coach?new=1` opens an empty thread.

## Motion

150–250ms, ease-out, on transform/opacity/width only. Motion signals state change — bar fills on mount, a row highlighting on selection. No page-load choreography. Every transition needs `motion-reduce:transition-none`.

## Adopted from Linear

Linear's published system is a **dark marketing canvas**; OpenPath is a **light product app**. What transfers is the craft, not the paint. Adopted:

- **Fixed radius ladder** — 4 / 6 / 8 / 12 / 16 / 24px as explicit values, replacing shadcn's multiplier chain. Each step is a decision, not a by-product: buttons `rounded-md` (8), cards `rounded-lg` (12), large panels `rounded-xl` (16). Never pill-round a CTA.
- **Size-relative tracking** — the bigger the type, the tighter. Linear pulls -3px at 80px (≈-0.037em); we use `tracking-display` (-0.032em) on 40px+ headings and `tracking-tight` below that, instead of one value everywhere.
- **Surface ladder over shadows** — hierarchy comes from stepped surfaces and 1px hairlines. Already how this system works; Linear confirms the direction.
- **Scarce accent** — Linear spends its lavender only on the brand mark, primary CTA and focus ring. Our equivalent restraint is semantic colour used only as status dots.

**Deliberately not adopted:** the near-black canvas (#010102) and lavender accent (#5e6ad2). That palette is specified for Linear's *marketing* site — its own rules say the surface exists to frame product screenshots, and it ships no light theme. OpenPath is the product, used by anxious students in daylight, and its monochrome light system is already contrast-verified end to end. Repainting would be a rebrand, not a craft improvement — worth doing deliberately if we ever want it, not as a side effect.

## Todo

`/todo` is the daily surface, modelled on Linear's Inbox: a fixed list rail (~22–24rem) with a scrolling detail pane beside it.

- **Three sources, one list.** Tasks come from the plan, from coach suggestions, and from the user typing their own. A `size-1.5` dot encodes source (ink = plan, `bg-info` = coach, muted = self) and the row's meta line names the phase or source. A filter menu narrows by source; a display menu reveals completed work.
- **Composing is inline.** A single row at the top of the rail adds a task — no modal, no second screen. New tasks land at the top and select themselves.
- **The detail pane** shows the task, its description, a label/value panel (source, phase, effort, resource) and two actions: hand the task to the coach (`/coach?q=…`) or open it in the plan.
- **The empty state is the resting state.** A hand-drawn tray, one line naming what to do, one line pointing at the compose row. It renders whenever nothing is selected, which is most of the time.

## Hồ sơ

`/profile` is the user's **career vault** — a single page (no tabs) modelled on LinkedIn's completion loop, rebuilt in the panel language.

- **Identity band**: avatar wrapped in an SVG **completeness ring** with a `%` pill, name, target-role headline, school/GPA meta, one edit action. The ring and the number read from the same `useCountUp` value (ease-out-quart, 700ms), so they move together; the ring fills on mount and ticks up live when something is added. Reduced motion jumps instantly.
- **The sticky rail** (300px, DOM-first so mobile sees it before the vault) stacks two cards: **Hoàn thiện hồ sơ** — the score, a thin bar, one row per missing item with its `+N%` (clicking completes it, same action as the vault) — and **Nhận định của coach** — the summary plus the "Hỏi coach" handoff, always in view instead of buried at the page bottom.
- **"Kho hồ sơ"** (`vaultItems` in `lib/data.ts`, weighted to 100 with `profileBaseScore`): one divided panel — CV, portfolio, thư ứng tuyển, LinkedIn, GitHub. A stored row carries meta + the coach's read (megaphone glyph + note) and a "Nhờ coach review" handoff; an empty row is an invitation — benefit line + add button, never a guilt-trip. Adding flips the row, reveals the coach's `addedNote` (`motion-safe` fade/rise), fires a quiet toast with the new %.
- **Below the vault**: Bối cảnh & mục tiêu (`careerContext`, a `dl` that stacks on mobile), Kinh nghiệm (period-left timeline grid — a real sequence), Học vấn & chứng chỉ, and **Điểm mạnh & cần cải thiện** closing with the coach's two-column read.

### The section panel

Every block on the page is one `SectionPanel` (local to `profile/page.tsx`), so the surface reads as one system instead of five hand-built cards:

- **A fixed 48px header** — `h-12`, title left at `text-base font-semibold`, actions right at `pr-2`. Optional `meta` (e.g. "1/5 tài liệu") sits before the action. Body rows are `divide-y divide-border`, `px-4`.
- **Editable panels take an `editing` / `onEdit` / `onCancel` / `onSave` set.** At rest the header shows a ghost "Chỉnh sửa"; in edit mode the header action disappears and a `bg-muted/40` footer bar carries Huỷ + Lưu thay đổi, so the commit point is always the same place. `Esc` cancels from anywhere in the panel.
- **`useSectionEdit` holds a draft copy.** Fields write to the draft, Lưu commits and toasts, Huỷ/`Esc` discards — nothing is saved by keystroke. Read and edit modes reuse the same grid columns, so labels don't shift when the panel flips.
- **Editing vocabulary is fixed across panels**: shadcn `Input`/`Textarea` with a real `Label`, list rows get a trailing `Trash2` ghost button, list panels get one "Thêm…" ghost row at the bottom (which opens edit mode with a focused blank row), and tag sets (chứng chỉ) use `Badge` + an inline "nhấn Enter" field with a 24px × per tag.
- **Coach-authored panels have no edit affordance** — Nhận định and Điểm mạnh & cần cải thiện are conclusions, not fields. The absence of a pencil is the signal.

### The coach's read is live

A weakness carrying `resolvedBy: VaultItemId` (`ProfileWeakness` in `lib/data.ts`) is tied to the vault slot that would fix it. Fill that slot and the finding **crosses columns**: it leaves "Cần cải thiện", lands at the foot of "Điểm mạnh" with a success `Check`, a "Vừa khắc phục" badge and the coach's `resolvedNote`, entering on a 500ms `motion-safe` fade-and-rise. The coach card gains a live line counting what you've cleared, and the weakness column has its own resolved-everything empty state. This is the difference between a profile that scores you and one that notices you changed — the same reason the ring counts up rather than jumping.

## Hướng đi

`/opportunities` is **a map, not a list** — the product's signature surface. It answers "where am I, where can I go, and what do I pass through" in one picture.

- **Time runs left to right** across four columns (`stages` in `lib/career-graph.ts`): Bạn hôm nay → Bước vào nghề (0–12 tháng) → Vai trò chính (1–2 năm) → Đi xa hơn (3–5 năm). Column headings sit above the canvas, so the x-axis is self-explaining.
- **A directed graph, not a tree.** `pathNodes` + `pathEdges` form a DAG; roles genuinely converge (Marketing intern *can* reach Data Analyst) and every edge carries a `via` — the actual condition for making that move, surfaced in the inspector.
- **The corridor, not a single route.** Setting a target highlights *every* edge on a valid path from `you` to it (`corridor()` — forward-reachable ∩ backward-reachable), because there is rarely one way in. Hovering any node lights its full lineage (`lineage()`) and dims the rest.
- **Rendering**: SVG bezier edges *behind* real HTML `<button>` nodes in one transformed layer. Chosen over `<canvas>` deliberately — nodes stay focusable, keyboard-operable, screen-reader legible and styled with the same tokens as the rest of the app; only the connectors need vector drawing.
- **Node = one glance**: title, salary band, and a hairline fit bar with its `%`. `you` is the one filled near-black card — the anchor. The target carries a small inverted "Mục tiêu" chip.
- **Direct manipulation**: drag the background to pan, wheel/⌘-wheel or the toolbar to zoom (0.4–1.6), drag any node to rearrange, "Vừa khung" to refit. Node drags capture the pointer on the node itself and stop propagation, so the canvas never pans underneath a drag.
- **Editing is first-class**: "Thêm hướng đi" adds your own role, wired from whichever node is selected, into the column you pick; custom nodes are draggable and deletable. The map is yours to argue with.
- **Motion carries state, not decoration**: nodes stagger in on first paint (40ms apart, capped); programmatic view changes (zoom, fit, reveal) glide 300ms while hand-panning stays 1:1 — a transition on drag would feel broken. All `motion-safe`.
- **The inspector is a split, never an overlay** — a 320px right column from `sm` (a bottom sheet below it), so it can't cover the diagram. Selecting a node minimally pans the canvas to keep that node visible beside the panel, accounting for the mobile sheet height.
- **Fit is clamped at 0.55** — on a narrow screen the map anchors left at a readable scale and invites a sideways drag instead of shrinking into illegibility.

## Coach dock

On every screen, a **strip in the bottom gutter** below the content frame, modelled on Linear's agent bar (`components/coach/coach-dock.tsx`): the last conversation's title in a dismissible `bg-muted` pill (× hides it; hidden on mobile), a `MousePointer2` + `Coach` chip, and a history icon opening the shared chat-history popover upward. On the grey gutter the chip is borderless; on mobile, where the strip floats over content, it regains `border bg-card`. The only exception: `/coach` on mobile hides the strip entirely — it would sit on the page's own composer.

Clicking the title or the chip opens a **floating panel** above the strip — `w-[min(24rem,100vw-2rem)]`, `h-[min(32rem,100svh-7rem)]`, `rounded-xl border shadow-lg`, bottom edge flush with the content frame's — with a header (chat title, then minimise / open-full-screen / close icons), the thread in `compact` mode, and the compact composer. The panel stays mounted while hidden so minimising never loses the conversation; `Esc` closes it; entrance is a `motion-safe` fade + 8px rise.
