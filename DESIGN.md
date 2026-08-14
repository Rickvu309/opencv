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

Modelled on Linear. The rail is quiet by default and reveals structure only where it earns attention.

- **Header row**: a workspace switcher (mark + name + `ChevronsUpDown`, opening a menu with the user's identity) sits left; search and new-chat are *icon* buttons on the right, not full rows. Frequent actions cost one glyph, not one line.
- **Primary group carries no label**, Coach is where you land daily; a heading over one item is scaffolding. The profile and career artifacts sit below under "Sự nghiệp". Coach's mark is the **cat** (`components/brand/coach-cat.tsx`), the same glyph in the nav, the dock chip, the message avatar, and the landing header. Clicking Coach opens `/coach`, the live thread. Starting over is an explicit choice in the history switcher.
- **Labelled sections** ("Sự nghiệp", "Gần đây") are `Collapsible`. The disclosure chevron is `opacity-0` until hover or focus, and the item count appears *only when the section is closed*, the rail stays still until you interact with it.
- **Counts are plain 11px muted numerals**, never badge pills. No component in the rail carries a filled background except the active item.
- **Nested items** (`SidebarMenuSub`) hang under Kế hoạch with a 1px guide line, and only while you're on that page, context appears where it's useful and disappears where it isn't.
- **Rows are 28px** (`h-7 text-[13px]`), Linear's density, not the 32px shadcn default.
- **The rail has no footer**, identity lives in the workspace switcher, readiness and tasks live on their pages. A `?` button floats at the app's bottom-left (`components/help-button.tsx`), like Linear's, opening a lean help menu upward: ask the coach how to use OpenPath, send feedback, and the ⌘B shortcut (which actually toggles). On mobile it gains `border bg-card`, same as the coach chip.

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

**Coach is always reachable.** Every screen except `/coach` carries the bottom-right coach strip (see "Coach dock"). This is why the chat lives in `components/coach/`: `thread.tsx` owns state (the `useCoachThread` hook), `thread-view.tsx` owns message rendering, `composer.tsx` the input, `history.tsx` the new-chat action, and the page, the dock and the header switcher all consume them.

## Feedback & waiting

- `<Spinner size="sm|md|lg" />` (`components/ui/spinner.tsx`), two-tone ring, `role="status"`. Reduced motion swaps rotation for a pulse so activity still reads. Use for transitions and async work.
- `<TypingDots />`, three dots, only for the coach composing a reply.
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

- **Chat switcher**: conversations are several named threads (`lib/coach/sessions.ts`). The header names the live one and opens a list (`ConversationMenu` in `components/coach/history.tsx`). A new thread is named from the first question. `?new=1` starts empty; `?q=` asks that question in the current thread.
- **Composer** (`components/coach/composer.tsx`): a bordered panel, the auto-growing textarea on top, a circular primary send below right. Enter sends, Shift+Enter newlines, IME-safe. `compact` tightens padding for the floating panel. It takes the thread rather than four wiring props, the same way `CoachMessages` does; three mounts wiring `value`/`onChange`/`onSubmit`/`disabled` by hand is three chances to wire them differently.
- **Empty state**: the cat sits, one greeting line, the one next step from `nextStepOf` (`lib/next-step.ts`), the composer (`Hỏi Coach…`), and a row of suggestion chips. On **both** surfaces, from the same `CoachGreeting` and `CoachStarters`. The chips grow to fit rather than being pinned to one line, because a Vietnamese starter runs half again as long as its English pair.
- **The chips are read from state** (`lib/coach/starters.ts`), four slots each answering a different question: the nearest artefact, the week, the gap named against the user's own target role, and whatever is thinnest in the profile. Fixed chips went stale in a single turn, offering to build a first CV to someone who had built three.
- **Onboarding ends here, not on the profile.** Three screens of questions earn an answer, and the profile is only the visitor's own typing handed back. The waiting-list ask moved to the app layout so it still finds them on whichever screen is first.
- **Messages**: coach replies are unbubbled prose on the page background at `text-[15px] leading-7` with a small mark to the left; user turns are a `rounded-2xl bg-muted` bubble, right-aligned. Numbered points use a hanging indent with the numeral in muted tabular figures.
- **The thread is ordered by time, not by author.** Two things write to it: the agent's stream, and this app when the agent is unreachable. Local messages record how many agent messages existed when they were written, and `interleave` (`lib/coach/messages.ts`) merges on that. Concatenating the two lists instead put every local message above the whole conversation, so from the first failed turn onward the thread read backwards.
- **Sending is refused while the door is unchecked**, not only while a turn is in flight. Access is probed once on mount; a question sent into that window comes back 401 and dies behind the sign-in form with nothing said about it.
- **Confirmations come from the tool, never from the prose.** `AppliedActions` renders `apply_action`'s own returned envelope, so a change the Coach only *claims* to have made shows nothing. This is not defensive decoration: the model was measured answering "Tôi đã thêm việc đó vào danh sách" having called no tool at all, leaving the user with an empty list and a sentence saying otherwise.
- **Offline is a state, not a latch.** A failed turn drops to `replies.ts`, and the next question re-probes the agent and goes live again if it is back. It used to be one-way, so a single hung turn downgraded the conversation permanently and the only exit was discarding it.
- **A turn can be stopped.** The send button becomes a stop button while streaming. Necessary because the model reasons before it answers — see below — and a bare greeting can take the better part of a minute.
- Cross-screen handoff: `/coach?q=<question>` opens the chat with that question already asked and answered; `/coach?new=1` opens an empty thread.

**The model reasons before it answers, and that is not a tuning choice.**
`enable_thinking` is on in `agent/agent.ts` because this model does not call
tools without it: measured, with thinking off it never once called
`apply_action` and instead narrated changes it had not made. The cost is
latency, and the stop button is the answer to the latency. If that trade stops
being acceptable, the fix is a provider that can call tools without reasoning
first, not another round of prompt engineering.

## Two languages

Vietnamese and English, and the switcher is never more than one click away: the
account menu inside the app, a segmented pair on the landing page and in
onboarding. Those two screens have no account menu yet, and they are exactly
where a reader who does not read Vietnamese most needs to find it.

The landing page is a brand surface: sticky header (cat mark, language, sign in,
try-it), an interactive Coach demo that plays a turn and lets the visitor undo,
and no testimonials or invented metrics. Onboarding is a name, a direction (or
not sure, with a quiet payback line when the goal is typed), and an optional CV,
then `/coach?q=` with that goal in the first turn. School and courses wait
until the Coach asks. The activation checklist is for a later empty chat,
not under the seeded first turn.

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

The Coach's face is a quiet cat, not a second character and not lucide
`Megaphone`. One SVG: `components/brand/coach-cat.tsx`, `currentColor`, sizes
`sm | md | lg`, outline at rest, filled when Coach is the active nav item or
the dock is open.

**She is the Coach.** No given name on launch. She does not speak; copy stays
the mentor voice.

**Four poses, not twelve.** Sit is the default and has no motion. Listen settles
the ears once (composer focused, landing demo waiting). Think is Sit — typing
dots do that work. Done is one blink and a 2° glance toward the flashed row,
once, after a successful `apply_action` or when the landing undo chip appears.
Reduced motion: Sit only; Listen/Done become a static fill on the active mark.

**Where she appears:** landing header and demo avatar; app rail, dock chip,
message avatar; empty kit (Profile / Papers / Applications / Coach greeting);
Ask Coach rows. **Not on:** settings billing, help form, printed CV, toasts.

**Never:** walk cycles, hover-follow eyes, idle breathing, bounce-in, meow,
seasonal hats, a fifth pose.

## Motion

Motion signals a state change. It never decorates, and it is never the only
channel; every animated change also reads statically, in colour, icon or label.
No page-load choreography **inside the signed-in app**. The landing page is the
exception: it is the brand surface, and its hero chunks stagger once on first
paint (`hero-enter` in `globals.css`, 100ms apart, `--duration-surface` on
`--ease-enter`). Reduced motion keeps the fade and drops the travel.

A new easing or an off-scale duration in a diff is a review failure. Do not add
a fifth curve. Rejected and still rejected: idle loops, sparkles, AI-glow, cat
pulse, bounce, `transition: all`.

**Frequency.** 100+ times/day (keystrokes, list hover, rail clicks, composer
typing): no animation. Tens/day (filters, tab switches): colour or 120ms
opacity. Occasional (dock, sheet, toast, accordion, undo flash): 200–300ms,
origin-aware. Rare / first-time (landing hero, demo play, first artifact, empty
kit): the only place for stagger, a 500ms reveal, or the cat's extra pose.

**Named recipes.** Press: `active:translate-y-px` in-app; landing primary CTA
may `scale(0.96)` over 120ms `--ease-snap`. Origin-aware open/close: dock and
menus grow from the trigger, 300ms enter, 180–200ms exit. Crossfade:
conversation switch and language swap, opacity 200ms `--ease-snap`. Stagger:
landing hero only; demo messages 80–100ms apart, cap three. Wash: `.animate-just-changed`.
Bar grow: `.animate-bar-grow` on fit / completeness, replay on `key` change.
Typing dots: Coach composing only. Height accordion: `.acc-panel`.

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

- **The rail is a vertical tablist** in two groups, Bản thân (thông tin cá nhân, bối cảnh, kinh nghiệm, học vấn) and Tài liệu (`vaultItems` in `lib/catalog.ts`). Each row carries its own meta line and a filled/empty glyph, so what is missing is legible without opening anything. Collapsing a group moves the selection to the first tab still visible, or the panel would be labelled by a hidden tab.
- **Every point of the score is earned.** `profileWeights` (context 14, experience 14, education 10, courses 8) plus the vault's weights make 100. There is no base score: an empty profile opens at 0%, because a number handed out before the user typed anything cannot say what is missing.
- **Empty is an invitation, never a guilt-trip.** An unfilled kind shows the sitting cat, its `benefit` line, and one add button. CV is the exception with two: it is the one kind you can *build* here (→ `/cv`) rather than only point at. The shared empty is `components/empty-state.tsx`.
- **The coach's read is an offer, not a verdict.** Each kind carries a `coachPrompt` that hands the question to `/coach?q=…`. What used to sit here, a fixed observation about a seeded CV shown to everyone regardless of what they had uploaded, is gone: a verdict has to come from a real read.

### The section panel

Every editable block is one `EditableSection` (`components/profile/editable.tsx`), so the surface reads as one system instead of five hand-built cards:

- **A fixed 56px header**, title left at `text-base font-semibold`, one action right. Optional `meta` (e.g. "2 mục") sits after the title.
- **At rest the header shows a ghost "Chỉnh sửa"**; in edit mode it disappears and a sticky footer bar carries Huỷ + Lưu thay đổi, so the commit point is always the same place. `Esc` cancels from anywhere in the panel.
- **`useEditable` holds a draft copy.** Fields write to the draft, Lưu validates then commits and toasts, Huỷ/`Esc` discards; nothing is saved by keystroke. `start(seed)` **replaces** the value rather than merging into it: a `{ ...value, ...seed }` merge is meaningless when the value is a list, and used to crash the experience editor.
- **Editing vocabulary is fixed across panels**: `Field` for a labelled input (it owns the label association and the `aria-invalid`/`aria-describedby` wiring), list rows get a trailing `Trash2` ghost button, list panels get one "Thêm…" outline button at the bottom, and tag sets (chứng chỉ) use `Badge` + an inline field with a 16px × per tag.

## CV

`/cv` is where a CV gets **built**, not uploaded. Two panes: what you are writing on the left, what a recruiter opens on the right.

- **The preview is the document.** `components/cv/resume-document.tsx` renders both the on-screen preview and the printed page, scaled to fit by a `ResizeObserver` rather than reimplemented. "Looks right here" and "prints right" are therefore the same claim.
- **A document, not a screen.** The CV is black on white at A4 in dark mode, in the preview and on paper, because that is what the reader opens. Its colours are its own values, not the app's theme tokens. The only choices are template (cổ điển / hiện đại / gọn), accent, and density, and `density: tight` is a real page-fitting tool, offered before "cut some content".
- **Start from what is already typed.** "Dựng từ hồ sơ" carries identity, experience, education and certificates across; a blank CV invents nothing. Either way the sections arrive **named but empty**, because an editor that opens on nothing asks the user to invent the structure of a CV, which is the part they came here not to know.
- **Fourteen `resume.*` actions, not one `resume.set`.** The Coach has to be able to sharpen one bullet without resending the document; a whole-document write is the one edit that can silently delete work the user did between turns. Every control on this screen dispatches the same actions the Coach calls, so an edit made on your behalf flashes the row it changed.
- **Hiding beats deleting.** Tailoring one version per application means taking a section off the page while keeping its content, so `hidden` is a section field and "Nhân bản" is one menu item away.
- **Committing on blur, not per keystroke** (`components/cv/draft-field.tsx`). Per keystroke would make every letter an undoable action in the toast stack, a full serialisation to `localStorage`, and a separate edit for the Coach to read mid-word.
- **Four ways out, one per reader**: PDF through the browser's own print dialog (a bundled renderer would add ~500KB to lay out HTML the preview already lays out correctly), Markdown for ATS forms, plain text for paste boxes, JSON because the data is the user's. Printing mounts a second copy of the document on `document.body`; the app shell is `h-svh overflow-hidden` around nested scroll panes and would otherwise clip the CV to one screenful.
## Coach dock

On every screen, a **strip in the bottom gutter** below the content frame, modelled on Linear's agent bar (`components/coach/coach-dock.tsx`): what the user last actually asked, in a dismissible `bg-muted` pill (× hides it; hidden when the thread is empty; hidden on mobile), a `MousePointer2` + `Coach` chip, and a pen icon that starts a new chat. On the grey gutter the chip is borderless; on mobile it regains `border bg-card`. The only exception: `/coach` on mobile hides the strip entirely; it would sit on the page's own composer.

**Below `md` the strip is in flow, not floating.** There is no bottom gutter at that width, so the strip and the help button share one real row at the foot of the frame (`app/(app)/layout.tsx`, dissolved again from `md` with `md:contents`). The scroll area above therefore ends exactly where the controls begin. **A screen must never add its own bottom padding to clear the strip.** Four screens had each invented a different magic number for this (`pb-20`, `pb-14`, `pb-11`, `pb-16`), which is how a shared obstruction turns into four private ones, and three of them were still wrong.

Clicking the title or the chip opens a **floating panel** above the strip, `w-[min(24rem,100vw-2rem)]`, `h-[min(32rem,100svh-7rem)]`, `rounded-xl border shadow-lg`, bottom edge flush with the content frame's, with a header (chat title, then minimise / open-full-screen / close icons), the thread in `compact` mode, and the compact composer. The panel stays mounted while hidden so minimising never loses the conversation; `Esc` closes it; entrance is origin-aware from the cat chip (`origin-bottom-right`, fade + scale, `--duration-surface`). The chip fills while the panel is open.

The header search button opens a command palette (`⌘K`, `components/command-palette.tsx`): a jump list to Coach, Profile, CV, Papers, Pitch, Search, Applications, and Help.
