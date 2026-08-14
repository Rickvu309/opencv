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

Semantic accents, `text-success`, `text-warning`, `text-danger`, `text-info`, are for status dots (`size-1.5 rounded-full bg-success`), a status word, or one icon. Never a background wash, never a coloured card.

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

**The content is an inset frame, like Linear.** The shell uses `Sidebar variant="inset"`: the rail sits borderless on the grey canvas (no line under the workspace name, no footer rule) and the page content floats beside it as a rounded, hairline-bordered panel (`m-2 ml-0 rounded-xl border shadow-sm`). The frame's bottom margin is `mb-12`; that 48px gutter is where the coach strip lives, so it never overlaps content. The frame is height-capped (`h-[calc(100svh-3.5rem)]`, `h-svh` on mobile) and scrolls *inside* (`overflow-hidden` + an `overflow-y-auto` child), so full-height screens use `h-full`, never `100svh` math.

The active nav item is the exception that proves it: it jumps to `bg-card` with a hairline ring, lifting off the rail like a tab pulled forward. Hover sits between at `bg-sidebar-accent`.

## Navigation

Modelled on Linear. The rail is quiet by default and reveals structure only where it earns attention. The grouping matches the product's two pillars: prepare yourself, then land the right opportunity. Coach is the operating layer, not a third pillar.

- **Header row**: a workspace switcher (mark + name + `ChevronsUpDown`) opening a menu with the user's identity, **Hồ sơ của bạn**, billing, help, and sign out. No icon buttons beside it. ⌘K opens a command palette as a keyboard-only jump list; there is no Search button in the rail header.
- **Primary group carries no label.** Coach is where you land daily; a heading over one item is scaffolding. Coach's mark is the **box mascot**, the same glyph in the nav, the dock chip and the message avatar. Clicking Coach opens `/coach`, the current conversation. Starting a new thread is an explicit choice in the header `ChatSwitcher`, not clicking Coach.
- **Two labelled sections** sit compact under Coach, `Collapsible` and open by default: **Prepare** (My Paper, My Pitch) then **Opportunities** (Search, Applications). Profile is Settings, the source of facts, so it is not a kit item on the rail. The disclosure chevron sits after the label and stays visible, so a closed section still reads as collapsible.
- **Chats** is a third `Collapsible` with the same chevron, listing stored threads only (title = first question). Clicking a thread selects it and goes to `/coach`. Empty is empty: no new-chat row, no fake threads, no "0". New chat lives in the header `ChatSwitcher`; both drive the same `useCoach()` thread.
- **Counts are plain 11px muted numerals**, never badge pills. No component in the rail carries a filled background except the active item.
- **Rows are 28px** (`h-7 text-[13px]`), Linear's density, not the 32px shadcn default. On touch they are 40px (`h-10`).
- **The rail has no footer**, identity lives in the workspace switcher. A `?` button floats at the app's bottom-left (`components/help-button.tsx`), like Linear's, opening a lean help menu upward: the first four steps, send feedback, switch language, and the ⌘B shortcut (which actually toggles). On mobile it gains `border bg-card`, same as the coach chip.

### Collapse and resize

The rail is **resizable and fully hideable**; there is no icon-rail state.

- **Drag the right edge** to resize between 208px and 400px. The handle is a 8px hit strip whose 1px line only appears on hover, focus or drag. Dragging writes straight to the `--sidebar-width` custom property via a ref; no React state per pointer move, so it stays smooth, and the width persists to `localStorage` on release.
- **Keyboard**: the handle is a `role="separator"` with `tabIndex=0`. Arrow keys nudge 8px, Shift+Arrow 32px, `Home` resets to 256px.
- **Collapsing** happens by double-clicking the edge, dragging past 168px, or `⌘B`. The rail hides entirely (`collapsible="offcanvas"`) and the content pane reclaims the full width; no icon stub.
- **Reopening is explicit only.** Nothing appears on hover; the edge element is removed entirely while collapsed, so there is no invisible target to trigger by accident. The header fades in a toggle button (its only state), and `⌘B` still works.
- **The reopen button is asymmetric**: the header shows no toggle while the rail is open (the edge already does that job), and fades one in only when it's collapsed, a hidden rail needs a visible way back. On mobile, where there is no edge, the button is always present. `⌘B` and `Enter`/`Space` on the focused edge toggle from anywhere.
- **Motion**: shadcn ships `ease-linear 200ms` on the rail; overridden to `--duration-surface` on `--ease-enter` so it leaves fast and lands soft. Zeroed under `prefers-reduced-motion`.

## Accordion motion

Defined once on `.acc-panel` in `globals.css` so every accordion shares it.

- **Opening** runs the height over `--duration-surface` on `--ease-enter`, fast out of the gate, settling softly.
- **The content inside** fades and rises 3px over 260ms on `--ease-enter` with an 80ms delay and `backwards` fill, so text arrives just as the frame finishes opening instead of stretching with it.
- **Closing** is deliberately quicker and sharper (180ms on `--ease-exit`), dismissal should feel decisive, not reluctant.
- `prefers-reduced-motion` drops all three to none.

**Coach is always reachable.** Every screen except `/coach` carries the bottom-right coach strip (see "Coach dock"). This is why the chat lives in `components/coach/`: `thread.tsx` owns state (the `useCoachThread` hook), `thread-view.tsx` owns message rendering, `composer.tsx` the input, `history.tsx` the conversation list and new-chat action, and the page, the dock, the rail and the header switcher all consume them.

## Feedback & waiting

- `<Spinner size="sm|md|lg" />` (`components/ui/spinner.tsx`), two-tone ring, `role="status"`. Reduced motion swaps rotation for a pulse so activity still reads. Use for transitions and async work.
- `<TypingDots />`, three dots, kept for other waits. Coach thinking uses
  `ThinkingOrb` (`components/coach/thinking-orb.tsx`): AICSS S1, a 3×3
  wavefront from the centre, on the reasoning trigger while it streams and on
  the composing row when there is no live reasoning yet. Reduced motion keeps
  the centre cell lit.
- Skeletons for content that has a known shape; a spinner only when it doesn't.
- Every state change gets immediate, quiet feedback: a checkbox strikes its row through, a filter updates a visible result count, an accepted suggestion turns into a confirmation line.

## Explaining things

`<Tip title="...">body</Tip>` (`components/tip.tsx`), a muted `size-6` info button that opens a Popover with a title and one or two sentences. Use it only where a number genuinely needs defining (what a readiness % measures, how a gap is computed). Two or three per screen at most; each tip is an admission the label alone wasn't clear.

## Components

shadcn/ui (Radix base) in `components/ui`. Interactive elements carry default, hover, focus-visible, disabled states. Loading uses skeletons, not centred spinners.

Icons: lucide-react at `size-4` (`size-3.5` inside chips), `text-muted-foreground` unless the icon is the status signal.

## Chat surface

The coach chat is the product's home screen and follows the conventions of first-class AI tools.

**Two surfaces, one conversation.** `/coach` and the floating panel in the dock
are views, not chats. Everything they could each hold separately is held once,
in `useCoachThread`: the durable session, the messages, and the half-written
draft. Both call `useCoach()`; neither owns state the other would contradict.
The layouts differ because a full page and a 24rem panel should differ. Nothing
else does.

- **Chat switcher**: on `/coach` the header names the open thread (its first question, or "New chat" while empty) and opens the same conversation menu the rail list uses (`ConversationMenu` in `components/coach/history.tsx`). The rail is the place you scan history; the header is the place you switch when the rail is collapsed. Both call `useCoach()`. `/coach?q=` still asks a question on open. Starting a new thread is `startNewChat`, not `/coach?new=1`.
- **Composer** (`components/coach/composer.tsx`): a bordered panel, the auto-growing textarea on top, a single + on the left of the footer (rotates 45° open; new chat and the state-aware asks) and a circular primary send on the right. `/` opens the same asks as a slash palette and inserts one. No model picker, attachments, or enhance — those would be chrome the turn cannot honour. Enter sends, Shift+Enter newlines, IME-safe. `compact` tightens padding for the floating panel. It takes the thread rather than four wiring props, the same way `CoachMessages` does; three mounts wiring `value`/`onChange`/`onSubmit`/`disabled` by hand is three chances to wire them differently. The placeholder cycles the state-aware starters (`lib/coach/placeholder.ts`), and on artefact screens leads with a line for that page; the accessible name stays "Ask Coach…".
- **Empty state**: the box mascot, one greeting line, and the composer. Suggested questions cycle in the composer placeholder (`lib/coach/placeholder.ts`), not as a list or a next-step chip under the kit.
- **Those suggestions are read from state** (`lib/coach/starters.ts`), six slots: the nearest artefact, the week, the gap named against the user's own target role, whatever is thinnest in the profile, the other paper (letter), and the land-side move (search / pitch / follow-up). Fixed lines went stale in a single turn, offering to build a first CV to someone who had built three.
- **Onboarding ends here, not on the profile.** One screen at sign-up, then the Coach. There is no in-app waiting-list ask: the visitor already has an account.
- **Messages**: coach replies are unbubbled prose on the page background at `text-[15px] leading-7` with a small mark to the left; user turns are a `rounded-2xl bg-muted` bubble, right-aligned. Numbered points use a hanging indent with the numeral in muted tabular figures.
- **The thread is ordered by time, not by author.** Two things write to it: the agent's stream, and this app when the agent is unreachable. Local messages record how many agent messages existed when they were written, and `interleave` (`lib/coach/messages.ts`) merges on that. Concatenating the two lists instead put every local message above the whole conversation, so from the first failed turn onward the thread read backwards.
- **Sending is refused while the door is unchecked**, not only while a turn is in flight. Access is probed once on mount; a question sent into that window comes back 401 and dies behind the sign-in form with nothing said about it.
- **Confirmations come from the tool, never from the prose.** `AppliedActions` renders `apply_action`'s own returned envelope, so a change the Coach only *claims* to have made shows nothing. This is not defensive decoration: the model was measured answering "Tôi đã thêm việc đó vào danh sách" having called no tool at all, leaving the user with an empty list and a sentence saying otherwise.
- **Offline is a state, not a latch.** A failed turn drops to `replies.ts`, and the next question re-probes the agent and goes live again if it is back. It used to be one-way, so a single hung turn downgraded the conversation permanently and the only exit was discarding it.
- **A turn can be stopped.** The send button becomes a stop button while streaming. Necessary because the model reasons before it answers — see below — and a bare greeting can take the better part of a minute.
- Cross-screen handoff: `/coach?q=<question>` opens the chat with that question already asked and answered. A new thread is `startNewChat`, not a query flag.

**The model reasons before it answers, and that is not a tuning choice.**
`enable_thinking` is on in `agent/agent.ts` because this model does not call
tools without it: measured, with thinking off it never once called
`apply_action` and instead narrated changes it had not made. The cost is
latency, and the stop button is the answer to the latency. If that trade stops
being acceptable, the fix is a provider that can call tools without reasoning
first, not another round of prompt engineering.

## Two languages

Vietnamese and English, and the switcher is never more than one click away: the
`?` menu inside the app, a segmented pair on the landing page and in
onboarding. Those two screens have no help button yet, and they are exactly
where a reader who does not read Vietnamese most needs to find it. English is
the default when the browser does not say otherwise.

The landing page is a brand surface: sticky header (box mark, language, sign in,
try-it), an interactive Coach demo that plays a turn and lets the visitor undo,
and no testimonials or invented metrics. Onboarding is a name, a direction (or
not sure, with a quiet payback line when the goal is typed), and an optional CV,
then `/coach?q=` with that goal in the first turn. School and courses wait
until the Coach asks. There is no in-app waiting-list ask. The activation
checklist lives in the `?` menu, not on the empty Coach.

- **Each language names itself in its own language.** Offering "Vietnamese" to
  someone who only reads Vietnamese is a menu they cannot use.
- **Neither is a translation.** Every string is a `{ vi, en }` pair written
  twice, and the two are allowed to differ in structure where the idiom does.
  The landing headline is three noun phrases in Vietnamese and three imperatives
  in English, because that is what each language does with that line.
- **The language is state, not a preference.** It lives in `AppState`, travels
  to the Coach on every turn, and `settings.setLanguage` is an action like any
  other.
- **What you type decides it, not what your browser reports.** The starting
  locale is a guess from `navigator.languages`, and it is wrong for a large part
  of this audience: a Vietnamese student on an English-language phone gets an
  English app. Writing Vietnamese into the composer switches it, once per
  session, announced with an undo (`looksVietnamese`). The app decides this, not
  the model, which was measured answering a wholly Vietnamese question in
  English and never calling the action. Never the reverse direction: Vietnamese
  is often typed without diacritics, so their absence proves nothing.
- **A CV has its own language.** Section headings are document content and follow
  `resume.language`; the hints around them are interface copy and follow the
  app. A Vietnamese interface wrapped around an English CV is a real case, not an
  edge one.
- **`<html lang>` follows.** A screen reader picks its pronunciation from that
  attribute, so an English interface declared as Vietnamese is read aloud with
  Vietnamese phonetics.
- **Counts are templated, never concatenated.** `m.profile.itemCount(n)` returns
  a whole sentence per language; word order around a number does not survive
  being glued together.
- **Layout leaves room.** English runs longer than Vietnamese in some places and
  shorter in others; nothing in the shell is sized to one language.

## Mark

The Coach's face is a 2D rounded square with two eyes, not a cat and not lucide
`Megaphone`. One SVG: `components/brand/coach-box.tsx`, `currentColor`, sizes
`sm | md | lg`, outline at rest, filled when Coach is the active nav item or
the dock is open.

**She is the Coach.** No given name on launch. She does not speak; copy stays
the mentor voice.

**Four poses, not twelve.** Sit is the default. Listen closes the eyes into
U-arcs (landing demo waiting; empty greeting after one blink). Think is Sit —
typing dots do that work. Done is one blink, once, after a successful
`apply_action` or when the landing undo chip appears. The empty-kit greeting
opts into one 3px float (`live`); chrome marks stay still. Pose only changes
the eyes — no keyframe swap, so the mark does not jump. Reduced motion: Sit
only, no float; filled when the mark is the active surface.

**Where she appears:** landing header and demo avatar; app rail, dock chip,
message avatar; empty kit and Coach greeting; Ask Coach rows. **Not on:**
settings billing, help form, printed CV, toasts.

**Never:** hover-follow eyes, idle blink loop, walk, bounce-in, seasonal hats,
a fifth pose, a 3D cube, a lid flap.

## Motion

Motion signals a state change. It never decorates, and it is never the only
channel; every animated change also reads statically, in colour, icon or label.
No page-load choreography **inside the signed-in app**. The landing page is the
exception: it is the brand surface, and its hero chunks stagger once on first
paint (`hero-enter` in `globals.css`, 100ms apart, `--duration-surface` on
`--ease-enter`). Reduced motion keeps the fade and drops the travel.

A new easing or an off-scale duration in a diff is a review failure. Do not add
a fifth curve. Rejected and still rejected: idle blink loops, sparkles, AI-glow,
box pulse, bounce, `transition: all`. The empty-kit greeting float is the one
ambient exception (3s linear, 3px, one loop — never swapped on pose).

**Frequency.** 100+ times/day (keystrokes, list hover, rail clicks, composer
typing): no animation. Tens/day (filters, tab switches): colour or 120ms
opacity. Occasional (dock, sheet, toast, accordion, undo flash): 200–300ms,
origin-aware. Rare / first-time (landing hero, demo play, first artifact, empty
kit): the only place for stagger, a 500ms reveal, or the box's extra pose.

**Named recipes.** Press: `active:translate-y-px` in-app; landing primary CTA
may `scale(0.96)` over 120ms `--ease-snap`. Origin-aware open/close: dock and
menus grow from the trigger, 300ms enter, 180–200ms exit. Crossfade:
conversation switch and language swap, opacity 200ms `--ease-snap`. Text swap:
`.t-text-swap` (composer hints, thinking label), 4px / 2px blur / 300ms
`--ease-snap`. Stagger:
landing hero; empty coach kit (greeting → composer, 100ms apart, cap three); demo messages 80–100ms apart, cap three. Wash: `.animate-just-changed`.
Bar grow: `.animate-bar-grow` on fit / completeness, replay on `key` change.
Typing dots: Coach composing only. Height accordion: `.acc-panel` (Radix) and
`disclose()` (grid `0fr`/`1fr` for Profile groups, CV sections, Applications
Ended, empty-kit fold).

### Three curves, named in `globals.css`

The codebase had already converged on these; they were retyped at each call site
until a fourth crept in, so they are tokens now, and every call site uses them,
`globals.css` has no literal `cubic-bezier` outside the token block. A new easing
value in a diff is a review question.

They are named `enter`/`exit`, not `out`/`in`, because in Tailwind v4 an
`--ease-out` token silently redefines the built-in `ease-out` utility.

| Token | Value | Use |
| --- | --- | --- |
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | Enter, expand, settle. Leaves fast, lands soft. |
| `--ease-exit` | `cubic-bezier(0.32, 0, 0.67, 0)` | Exit, collapse. Dismissal should feel decisive. |
| `--ease-snap` | `cubic-bezier(0.2, 0, 0, 1)` | State flips inside a control, icon swaps, checks. |

### Duration by distance travelled

Chosen by how far a thing moves, not by taste. An earlier rule here said
"150–250ms" for everything, which this document's own accordion (300/260/180ms)
and skill bars (500ms) already contradicted, the rule was too narrow, not the
code wrong.

| Token | Value | Use |
| --- | --- | --- |
| `--duration-press` | 120ms | Press, hover, colour change |
| `--duration-state` | 200ms | The default state change |
| `--duration-surface` | 300ms | A surface opening, accordion, sheet, sidebar |
| `--duration-reveal` | 500ms | A full-width reveal, e.g. a bar growing from 0 |

**How to spell them in a component.** The easings are a Tailwind theme namespace,
so `--ease-enter` gives you an `ease-enter` utility. Durations are **not**,
`--duration-*` generates nothing, and a bare `duration-surface` silently falls
back to Tailwind's default 0.15s rather than failing. Write the arbitrary form:

```tsx
className="transition-transform duration-[var(--duration-surface)] ease-enter motion-reduce:transition-none"
```

A numeric `duration-200` / `duration-300` is acceptable where it already matches
the scale, the value is right even if it is not sourced from the token. **Any
other number is drift**, which makes the rule greppable:

```bash
# app code only; anything outside 120/200/300/500 needs a reason
grep -rohE "duration-[0-9]+|ease-[a-z-]+|transition-[a-z]+" \
  app components --include="*.tsx" --exclude-dir=ui | sort | uniq -c | sort -rn
```

Vendor primitives under `components/ui/` are excluded: they carry shadcn's own
`ease-linear` / `ease-in-out` defaults. Where one is visibly wrong the override
goes in `globals.css` (as the sidebar's does) rather than editing the primitive.

### Press

Buttons nudge down one pixel: `active:not-aria-[haspopup]:translate-y-px`, set
once in `components/ui/button.tsx`. Menu triggers are excluded because the menu
itself is the feedback. Use this idiom rather than a scale inside the app, and
a raw `<button>` that needs feedback adopts this one. Landing and onboarding
**primary** CTAs also `scale(0.96)` on press: those pages have one high-stakes
action. Do not spread that scale into the chrome.

### Animate only

`transform`, `translate`, `scale`, `rotate`, `opacity`, `box-shadow`, colour,
and `height` where a dedicated panel owns it (`.acc-panel`). Never
`transition: all`, and never an unnamed easing.

### Reduced motion is not optional

Every animation needs a `prefers-reduced-motion: reduce` branch. Transitions
drop to `motion-reduce:transition-none`; keyframes drop to `animation: none`.
Where the animation carried meaning, the reduced branch must still carry it,
`.animate-just-changed` swaps its wash for a static outline rather than
vanishing.

## When the Coach edits on your behalf

The Coach changes the app directly rather than proposing changes, an agent that
only ever suggests is a suggestion box, and the promise here is that it does the
work. Direct action needs three guarantees, or it reads as the app changing
under you.

**Act.** The change lands immediately, through the same registry action the UI
would have used. No approval step for ordinary edits. Suggestion cards remain,
but only for choices that genuinely fork the user's path, changing a career
goal, not adding a task.

**Announce, with a way back.** Every non-silent dispatch raises a toast carrying
the action's own `summary` and a **Hoàn tác** action that restores the previous
state. One level is enough: it covers the case that actually happens, which is
"that wasn't what I meant", immediately.

**Reveal.** A toast says *what* happened but not *where*. Each action reports the
ids it touched (`Action.touched`, defaulting to the input's `id`), the store
holds them for ~1.2s, and any row showing one flashes via
`.animate-just-changed`. The user's eye lands on the change instead of hunting
for it. Rows opt in with `useTouched()` on Profile tabs, CV sections, Papers,
Pitch, Search, and Applications.

A screen holding its own copy of domain state cannot do any of this, which is
why every screen renders from the store.

## Adopted from Linear

Linear's published system is a **dark marketing canvas**; OpenPath is a **light product app**. What transfers is the craft, not the paint. Adopted:

- **Fixed radius ladder**, 4 / 6 / 8 / 12 / 16 / 24px as explicit values, replacing shadcn's multiplier chain. Each step is a decision, not a by-product: buttons `rounded-md` (8), cards `rounded-lg` (12), large panels `rounded-xl` (16). Never pill-round a CTA.
- **Size-relative tracking**, the bigger the type, the tighter. Linear pulls -3px at 80px (≈-0.037em); we use `tracking-display` (-0.032em) on 40px+ headings and `tracking-tight` below that, instead of one value everywhere.
- **Surface ladder over shadows**, hierarchy comes from stepped surfaces and 1px hairlines. Already how this system works; Linear confirms the direction.
- **Scarce accent**, Linear spends its lavender only on the brand mark, primary CTA and focus ring. Our equivalent restraint is semantic colour used only as status dots.

**Deliberately not adopted:** the near-black canvas (#010102) and lavender accent (#5e6ad2). That palette is specified for Linear's *marketing* site; its own rules say the surface exists to frame product screenshots, and it ships no light theme. OpenPath is the product, used by anxious students in daylight, and its monochrome light system is already contrast-verified end to end. Repainting would be a rebrand, not a craft improvement, worth doing deliberately if we ever want it, not as a side effect.

## Hồ sơ

`/profile` is a **workbench you navigate, not a page you scroll**: an index rail (20rem) listing every part of the profile, and an inspector beside it showing the one you picked. Below `md` the two panes push, index → section → back.

- **The rail is a vertical tablist** in two groups, Bản thân (thông tin cá nhân, bối cảnh, kinh nghiệm, học vấn) and Tài liệu (`vaultItems` in `lib/catalog.ts`). Each row carries its own meta line and a filled/empty glyph, so what is missing is legible without opening anything. The selected row and the next empty row are the only emphasis, a fill checklist, not a second progress widget. Collapsing a group moves the selection to the first tab still visible, or the panel would be labelled by a hidden tab.
- **Every point of the score is earned.** `profileWeights` (context 14, experience 14, education 10, courses 8) plus the vault's weights make 100. There is no base score: an empty profile opens at 0%, because a number handed out before the user typed anything cannot say what is missing.
- **Empty is the editor.** An unfilled About-you section opens on its form: a one-line hint grouped with the title, then the fields, with no extra Edit click to start typing. Edit remains for filled sections (view → edit). `Esc`/Huỷ on an empty section resets the draft and stays on the form; there is no blank preview to return to.
- **Documents:** an unfilled kind is content-sized and leading-aligned, never a full-pane dashed void. CV and cover letters keep a builder link (`/cv`) plus an add/upload control. Link kinds (LinkedIn, GitHub, portfolio) open the add form directly.
- **The coach's read is an offer, not a verdict.** Each kind carries a `coachPrompt` that hands the question to `/coach?q=…`. What used to sit here, a fixed observation about a seeded CV shown to everyone regardless of what they had uploaded, is gone: a verdict has to come from a real read.

### The section panel

Every editable block is one `EditableSection` (`components/profile/editable.tsx`), so the surface reads as one system instead of five hand-built cards:

- **A header that grows with its hint**, title left at `text-base font-semibold`, one action right. Optional `meta` (e.g. "2 mục") sits after the title; a one-line `hint` sits under it. Empty sections hide the action because the body already is the form.
- **At rest on a filled section the header shows a ghost "Chỉnh sửa"**; in edit mode it disappears and a sticky footer bar carries Huỷ + Lưu thay đổi, so the commit point is always the same place. `Esc` cancels from anywhere in the panel. On an empty section Huỷ is omitted: cancel would only reveal a blank preview.
- **`useEditable` holds a draft copy.** Fields write to the draft, Lưu validates then commits and toasts, Huỷ/`Esc` discards; nothing is saved by keystroke. `start(seed)` **replaces** the value rather than merging into it: a `{ ...value, ...seed }` merge is meaningless when the value is a list, and used to crash the experience editor.
- **Editing vocabulary is fixed across panels**: `Field` for a labelled input (it owns the label association and the `aria-invalid`/`aria-describedby` wiring), list rows get a trailing `Trash2` ghost button, list panels get one "Thêm…" outline button at the bottom, and tag sets (chứng chỉ) use `Badge` + an inline field with a 16px × per tag.

## My Paper

`/cv` is **My Paper** (Giấy tờ): one Prepare destination for written artefacts. CVs and letters share a library; Pitch stays its own screen. `/papers` redirects here.

- **The library is posters.** Each CV fills an A4 card via `ResumePreview`; each letter is the same ratio with the first paragraphs on the sheet. Grid and list toggle. Opening one leaves the library.
- **A CV opens as the page.** Type on the paper: no form beside a preview. Two toolbars sit above a centred white page on the grey canvas. The main bar is back, an editable name and switcher, delete, CV | Letter tabs, build-from-profile, and print. The second bar is template (Harvard / Marketing / Tech), fit-to-one-page (`theme.density`), and section order — not a font engine. `components/cv/resume-document.tsx` still renders the printed page and the library poster, scaled to fit by a `ResizeObserver`.
- **A letter opens as the writing sheet.** Same main bar (Letter tab active); no format bar, because a letter has no template or density. Paragraphs, not sections. Title as an inline name, opening or role as a meta line, language and a quiet Coach offer. Coach drafts when the sheet is empty and sharpens when it is not. The CV | Letter tabs switch artefacts in this workspace; they do not fold a letter into the CV model.
- **A document, not a screen.** The CV is black on white at A4 in dark mode, in the poster and on paper, because that is what the reader opens. Its colours are its own values, not the app's theme tokens.
- **Start from what is already typed.** "Dựng từ hồ sơ" carries identity, experience, education and certificates across; a blank CV invents nothing. Letters start new, or from a saved opening.
- **Fourteen `resume.*` actions, not one `resume.set`.** The Coach has to be able to sharpen one bullet without resending the document; a whole-document write is the one edit that can silently delete work the user did between turns.
- **Hiding beats deleting.** Tailoring one version per application means taking a section off the page while keeping its content, so `hidden` is a section field and "Nhân bản" is one menu item away.
- **Committing on blur, not per keystroke** (`components/cv/draft-field.tsx`). Per keystroke would make every letter an undoable action in the toast stack, a full serialisation to `localStorage`, and a separate edit for the Coach to read mid-word.
- **Four ways out, one per reader**: PDF through the browser's own print dialog, Markdown for ATS forms, plain text for paste boxes, JSON for CVs because the data is the user's. Letters skip JSON. Printing mounts a second copy on `document.body`; the app shell is `h-svh overflow-hidden` around nested scroll panes and would otherwise clip the page to one screenful.

## Career Map

`/career-map` is **a map, not a list**, the product's signature surface. It answers "where am I, where can I go, and what do I pass through" in one picture.

- **Time runs left to right** across four columns (`stages` in `lib/career-graph.ts`): Bạn hôm nay → Bước vào nghề (0–12 tháng) → Vai trò chính (1–2 năm) → Đi xa hơn (3–5 năm). Column headings sit above the canvas, so the x-axis is self-explaining.
- **A directed graph, not a tree.** `pathNodes` + `pathEdges` form a DAG; roles genuinely converge (Marketing intern *can* reach Data Analyst) and every edge carries a `via`, the actual condition for making that move, surfaced in the inspector.
- **The corridor, not a single route.** Setting a target highlights *every* edge on a valid path from `you` to it (`corridor()`, forward-reachable ∩ backward-reachable), because there is rarely one way in. Hovering any node lights its full lineage (`lineage()`) and dims the rest.
- **Rendering**: SVG bezier edges *behind* real HTML `<button>` nodes in one transformed layer. Chosen over `<canvas>` deliberately, nodes stay focusable, keyboard-operable, screen-reader legible and styled with the same tokens as the rest of the app; only the connectors need vector drawing.
- **Node = one glance**: title, salary band, and a hairline fit bar with its `%`. `you` is the one filled near-black card, the anchor. The target carries a small inverted "Mục tiêu" chip.
- **The fit number is computed, and it can explain itself** (`lib/career-fit.ts`). It was a literal in the data — `fit: 84` — so a visitor who had entered nothing was told they were an 84% fit, and the number never moved however much they added. It now scores evidence against the role's own `requires`, weighted 65/35 against readiness for the stage, and the inspector ticks the requirements met and greys the rest so the figure and the list cannot disagree. Requirements carry their match tokens in the same object as their prose, because two parallel lists drift the first time someone edits one and not the other. Anything unprovable — "willingness to ask" — is excluded from the denominator rather than counted as a failure nobody can act on.
- **The pay bands are still literals**, and are the last invented number on this screen. Whatever replaces this surface has to make them real or drop them.
- **Direct manipulation**: drag the background to pan, wheel/⌘-wheel or the toolbar to zoom (0.4–1.6), drag any node to rearrange, "Vừa khung" to refit. Node drags capture the pointer on the node itself and stop propagation, so the canvas never pans underneath a drag.
- **Editing is first-class**: "Thêm hướng đi" adds your own role, wired from whichever node is selected, into the column you pick; custom nodes are draggable and deletable. The map is yours to argue with.
- **Motion carries state, not decoration**: nodes stagger in on first paint (40ms apart, capped); programmatic view changes (zoom, fit, reveal) glide 300ms while hand-panning stays 1:1, a transition on drag would feel broken. All `motion-safe`.
- **The inspector is a split, never an overlay**, a 320px right column from `sm` (a bottom sheet below it), so it can't cover the diagram. Selecting a node minimally pans the canvas to keep that node visible beside the panel, accounting for the mobile sheet height.
- **Fit is clamped at 0.55**, on a narrow screen the map anchors left at a readable scale and invites a sideways drag instead of shrinking into illegibility.

## Coach dock

On every screen, a **strip in the bottom gutter** below the content frame, modelled on Linear's agent bar (`components/coach/coach-dock.tsx`): what the user last actually asked, in a dismissible `bg-muted` pill (× hides it; hidden when the thread is empty; hidden on mobile), a box mark + `Coach` chip, and a pen icon that starts a new chat. On the grey gutter the chip is borderless; on mobile it regains `border bg-card`. The only exception: `/coach` on mobile hides the strip entirely; it would sit on the page's own composer.

**Below `md` the strip is in flow, not floating.** There is no bottom gutter at that width, so the strip and the help button share one real row at the foot of the frame (`app/(app)/layout.tsx`, dissolved again from `md` with `md:contents`). The scroll area above therefore ends exactly where the controls begin. **A screen must never add its own bottom padding to clear the strip.** Four screens had each invented a different magic number for this (`pb-20`, `pb-14`, `pb-11`, `pb-16`), which is how a shared obstruction turns into four private ones, and three of them were still wrong.

Clicking the title or the chip opens a **floating panel** above the strip, `w-[min(24rem,100vw-2rem)]`, `h-[min(32rem,100svh-7rem)]`, `rounded-xl border shadow-lg`, bottom edge flush with the content frame's, with a header (chat title, then minimise / open-full-screen / close icons), the thread in `compact` mode, and the compact composer. The panel stays mounted while hidden so minimising never loses the conversation; `Esc` closes it. Entrance grows from the chip (`origin-bottom-right`, `scale(0.93)` plus 8% of its own height, `--duration-surface` on `--ease-enter`); exit is quicker on `--ease-exit`. The chip mark and close crossfade (`scale` 0.25 / `opacity` / `blur` 4px, `--duration-state` on `--ease-snap`). No sparkles, no press-scale; the chip uses `translate-y-px`.

⌘K opens a command palette (`components/command-palette.tsx`): a jump list to Coach, Profile, My Paper, Pitch, Search, Applications, and Help. Keyboard only — no Search button in the rail header.
