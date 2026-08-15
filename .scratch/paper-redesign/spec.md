# My Paper — visual spec

Writing first. Occasional references to another product. Not a build. Product nouns and jobs stay in [`docs/paper.md`](../../docs/paper.md) — that file has the product grilling section. This file holds how My Paper looks and moves.

You closed further product grilling on 16 Aug 2026: answers live here and in `docs/paper.md`. Remaining work is code ([Complete My Paper](../paper-complete/map.md)).

## Grilling

Each row is one decision. **You chose** is the answer that locked. Detail stays on the ticket. This section is the record.

| Asked | You chose |
| --- | --- |
| What is Drive? | A picker you leave. Sheet-edge stack. Not a poster grid. Not a file manager. |
| Empty Drive? | One unmade CV on the list’s leading edge. “Start with the CV.” Quieter “I already have a file.” No New, no filter, no Ask Coach. |
| Populated Drive? | Same room. Sticky New (leading) + type filter (trailing). Flat. No column headers. More air when short. |
| A row? | Name · type word · updated. Thin leading slab. Uploads: quieter file mark, type word **Uploaded**. |
| Drive–Docs? | One room. Band stays; job changes. Shared element: name→title, slab→sheet. Rest Fade out. Back always to Drive. |
| No origin? | Skip travel. Land in Docs. Application, Coach, New → Proof, upload write door. |
| Gallery? | Create wall, still Drive. Eight equal A4s, caption under, audience-first. Tile is the origin. Format reopens this wall on the same paper. |
| After upload? | **Skip** the wall. Format is how situation arrives later. |
| Colour? | Desk vs output. Light desk. Paper-white A4. One warm ink on New and the unmade CV only. CV/letter black-on-white. |
| How you write a CV? | Caret on the A4. Line = field. Ghost starters. `+` Reveals a block. Drag reorder. No Edit \| Preview. Format on the desk. Completeness % in the band. |
| Letter? | Same mechanism, different object. Four situation cards. Speculative → email-shaped. Addressing on the page. |
| Proof? | A **space**, not an A4. Note, photo, file, link. Invite, don’t coerce. Never dump on screen. |
| Share? | **Arrange** (draft of the real page) then **Publish**. `/p/[slug]` one layout. Name → personal link. No OpenPath hero. |
| Personal link? | `/u/[handle]`. Identity is a sentence. **Span record** on a year hairline. No GitHub grid. |
| Motion? | Instant for typing/caret/hover/keyboard. Shared element Drive↔Docs and gallery pick. Reveal on add / first row. Layout animation on reorder. Scan Reveal forbidden until extract is real. |
| Upload doors? | Empty file door and **Start a CV from this** open a built CV (ghosts, no Profile). New → Upload and onboarding are file-only. Letter file stays Uploaded. |
| Enough? | Yes. Stop grilling. Code follows [Complete My Paper](../paper-complete/map.md). |

## Drive

A picker you leave. `/paper` with no `id` is a room of papers, not a file manager and not a wall of miniature A4s.

**Reference:** Resume.io’s documents dashboard is a list you leave — steal the “picker, then gone.” Kickresume My Documents and both template walls are a poster grid — reject those as the library. Google Drive’s official default is a list, not a grid. Detail: [reference-screens.md](research/reference-screens.md).

### Empty

Zero papers, deadline tonight. The Drive is a room with one unmade object: the CV they will send. One door. Copy stays “Start with the CV.”

The object sits on the **same leading edge** the list will use. It is not a centered card in a void, not a help box, not a ghost table row, not a gallery of templates. Click it and the eight-situation gallery opens (gallery layout is a later chapter).

They often already have a file. A quieter **“I already have a file”** sits with the unmade object — not a second hero, not hidden behind a New menu the empty room doesn’t have. That is the CV starting-point door — [Upload](#upload).

No New menu. No filter. Ask Coach is not here.

### Populated

Same room. The unmade object becomes the first sheet-edge row — a reveal, not a second layout.

A **sticky control zone** above the stack: **New** at the leading edge (CV, Cover letter, Proof, Upload), type **filter** at the trailing edge, only when more than one type is present. The stack scrolls under it.

Ask Coach stays a quiet offer under the list.

### The stack

Flat. No folders, no type bands, no recency bands, no job grouping (that lives on Application).

Each built paper is a **sheet edge**: name · type word · updated, on one hit. A **thin leading slab** — the thickness of a stack — at the leading edge. No file/mail/notebook icon. No page thumbnail, no folded corner. The sheet itself stays off stage until Docs.

No column headers. Type and updated live on the row. Below `sm`, they can tuck under the name; the slab and the name stay.

**Uploads** use the same row structure. Their mark is quieter and different — a file, not a sheet — so nobody leans in expecting to type. The type word is **Uploaded**.

Upload is also a **starting point**. The file stays in the stack. A write door opens a **built CV** — [Upload](#upload).

One paper and twelve are the same kind of object. Short lists get more air between rows. Long lists tighten. Never a hero card for the only CV.

Duplicate and delete stay on the row menu. Completeness never appears on a row.

### What this is not

Not Kickresume’s preview-card library. Not Resume.io’s template wall. Not a settings empty state. Not Google Docs’ “Start a new document” thumbnail strip.

## Drive–Docs seam

One room. Two modes. Not two apps.

The **sticky band** stays put and changes job.

| Drive | Docs |
| --- | --- |
| New (leading), type filter (trailing) | Back, editable title, type word, Export |

The body under the band is the stack, or the opened paper. Not a Profile-style split. Not a full unmount.

### Opening a paper

A **Shared element transition**: the row’s **name** becomes the Docs title; the **slab** becomes the sheet. The rest of Drive **Fade out**. Back is the reverse. Values: [Motion](#motion).

If there is no origin — Application or Coach opened `/paper?id=`, New → Proof with no tile, or a CV started from a file — skip the travel. Land in Docs. No Drive flash. **Back always goes to Drive.** The rail still has Application and Coach.

The **file** does not take this seam. Preview / download stay a Drive click (still unspecified). **Start a CV from this** opens the built paper, no-origin.

### Gallery and letter chooser

Still Drive. Same room, same leading edge. The band becomes Back + the question (“Where is this CV going?” / “Who is this letter for?”). The wall replaces the stack. Picking a gallery tile *is* an origin: that tile travels into the new sheet. Then you are in Docs.

### You land on the output

The A4 (or the letter / email page) is the **output**. Proof is a **space**, not a second letter. They do not fill a form and watch a preview catch up.

A CV is still structured. Blocks live *on* the page. A slim palette adds a block; it is not a second CV. This supersedes `docs/paper.md` “structured fields + live A4” for how you write.

**Reference:** chatPRD — edit the document itself ([writing documents](https://www.chatprd.ai/docs/writing-documents)). Steal: the artifact is the work. Reject: chat beside the page as required Docs layout. Resume.io / Kickresume: steal pages and export-on-the-object; reject form-paints-preview.

How the A4 is typed — [Opened CV](#opened-cv).

## Upload

They already have something. Fast is the job — drop *our* delays. **Tonight** is their situation, not a mode we ship. Without extract they still type.

**Two objects.** The file stays **Uploaded**. A **built CV** is a sibling. Never merge. You cannot type in the file.

| Door | What happens |
| --- | --- |
| Empty — **I already have a file** | File lands. Built CV opens. Skip the gallery. The unmade object is gone when they Back (file + built CV). |
| New → Upload | File only. Stay in Drive. |
| Upload row — **Start a CV from this** | Same write path: built CV, skip the wall. Preview / download stay. |
| Onboarding drop | File only. Do not open Docs. |
| Letter file | Stays **Uploaded**. Preview / send. No built letter. |

**The A4.** No Profile seed. No words from the file. **Plain working structure** — name, contact, employment, education, skills. Not a named situation. Ghost lines they can Tab. Copy tells the truth: this file is your start; you write on the paper. Format → Where it’s going assigns a situation later (same wall, same paper).

**Land.** No-origin. Skip travel. [Motion](#motion).

**When extract is real (later).** Fill *that same* A4. Scan **Reveal** only then.

Supersedes `docs/paper.md` “click upload = preview only” for the write doors. The file itself is still preview / download. `CONTEXT.md` **Uploaded file** updates when this spec is accepted.

## Craft

Colour exists to separate the **desk** from the **output**. Not to code CV / letter / Proof. Not to decorate.

**Desk.** Light room, hairlines — still a daylight desk, not a dark theme and not a second product. One **warm ink** accent, only on **New** and the unmade CV (the next step you can touch). Exact OKLCH when this spec is accepted into `DESIGN.md`.

**Output.** CV and letter are black ink on white paper in every theme. The sheet is paper-white, clearly a different surface from the desk. You edit that canvas.

**Proof.** The working **space** stays on the desk. The published page and the personal link may be hotter (smart, attractive, rich — never the CV). Never say dump on screen.

**Type.** Drive and the band: one product sans (Be Vietnam Pro unless replaced). No display type in chrome. The A4 may wear a **second face**; the template can change it.

**Motion.** See [Motion](#motion).

## Gallery

A **create wall**, still Drive, same room. Not the library. Band: Back + “Where is this CV going?”

All eight at once, **audience first**: Vietnamese employer, internship, academic, service, one page, abroad / ATS, technical, design. Equal size. No recommended tile.

Each tile is a **miniature A4** (`aspect-ratio: 1 / 1.414`). Black on white. **Abstract bars** per situation (one column / two column / empty photo frame). No fake name, no Profile on the tile, no face silhouette. Caption **under** the sheet: situation · CV or Resume · photo flag. Design warning is one line under that sheet only.

**Advisor tokens** (`/better-layout`, `DESIGN.md` scale): grid gap 16px; 8px between sheet and caption; 4 columns, 2 below `md`; hairline 1px; hover and “current” are an instant ink hairline (no colour transition). No warm ink on the wall. No drop shadow plus border. Whole tile is the hit.

Pick: that sheet is the shared-element origin into Docs. Other tiles **Fade out**. `prefers-reduced-motion`: skip the travel, instant land.

Keyboard: arrows on the grid, Enter picks, Escape is Back.

Empty unmade CV and New → CV open **this same wall**. A CV started from a file **skips** this wall — [Upload](#upload). Format → Where it’s going is how that paper meets the wall later.

Wrong situation: Format bar “Where it’s going” reopens **this wall** on the **same** paper. Current tile has a quiet state mark, same size. Back from that wall keeps this paper. Structure follows the new situation; typed words stay where blocks remain; a photo does not ride onto an ATS sheet.

Letter chooser is not this wall — [Letter](#letter).

**Reference:** Resume.io / Kickresume template walls — steal as *create*, reject as Drive. Artifact: [gallery-wall-outline.md](research/gallery-wall-outline.md).

## Opened CV

The A4 is the output. You navigate it, fix a line, and type on the canvas. There is no form that paints a preview. There is no Edit | Preview.

**Desk.** Same room as Drive. Sheet on the same leading edge. Second-neutral desk around it. Band: Back, title, type word, Export, quiet completeness % (tabular, 12px). Format (situation → gallery, density, rare accent) sits on the desk beside the sheet — not a second full-width bar, not on the paper. Coach is a quiet offer on the desk.

**Sheet.** Black ink, white paper, `aspect-ratio: 1 / 1.414`. Ghost starter blocks already there after a gallery pick. Click a **line** (role, org, period, bullet) and type. Tab / Shift-Tab between lines. Arrows stay in the line, then move to the next. As they type, it is the paper. Undo is the store.

**Fix.** Select, type over. Backspace empties the line. The ghost holds until they leave an empty line, then that line may collapse. A starter *block* stays until they delete it from the quiet outline control. No swipe. No Save.

**Add.** A `+` between blocks opens a short list (Employment, Education…). **Reveal** the new ghost. Not a permanent column.

**Reorder.** Outline + drag on the selected block. Siblings **Layout animation**.

**Pages.** Stacked, scroll, visible break. One-page situation can still warn. No page-break animation.

**Photo.** Click the frame on the A4.

**Phone.** Only the sheet. Inset 16px. Palette from `+`.

**Instant:** caret, hover, Tab, typing. **`prefers-reduced-motion`:** skip travel onto the sheet (already locked).

**Not:** left form, preview pane, chat-left / doc-right, format mall, outline pane, chrome on the output.

**Reference:** chatPRD — edit the artifact ([writing documents](https://www.chatprd.ai/docs/writing-documents)). Artifact: [opened-cv-outline.md](research/opened-cv-outline.md).

## Letter

Same **mechanism** as the CV: you work on the paper. Different **object**, layout, tokens, and motion — it is a letter (or an email), not a CV.

**Chooser (Drive mode).** Four situation cards: posted job, internship, speculative, scholarship. No miniature A4s. Band: Back + “Who is this letter for?” Speculative → **email-shaped** page (to, subject, body as lines). The others → a letter page. No skins.

**Page.** Same desk and band as the CV. Black-on-white. Ghost paragraphs by situation. Addressing is on the page. A line is a **paragraph**. Format on the desk reopens the four cards on this letter. Export PDF in the band.

**Advisor:** measure ~65ch; paper-white; 1px hairline; leading edge + desk. Typing is instant.

## Proof space

Not a letter. Not an A4. **One piece of work** and a **space** they are invited to fill.

Title is the experiment, project, shift, or skill. Role · dates · link sit on it. They add **proofs**: note, photo, file, link. A proof can point at another. The home view is the space, not a node graph. Graphs and “anything” are a later door.

**Invite, don’t coerce.** Add is easy and visible. Never required. Never shame. No quota, no score.

**Empty.** Chips teach what already counts, then they title this work and add the first proof. Coach stays quiet on the desk.

**Band.** **Arrange** (draft of the public page) and **Publish** (put it on the web). Not Prepare. Not a PDF of the space. **Add to CV** is quiet on the desk. Never auto. Detail: [Published Proof](#published-proof).

**Email / inbox / Granola scan.** Later map. No fake scan.

**Hard-work mark.** A **span record** — [Personal link](#personal-link). May also appear, quiet, on this space and the published page.

Never say **dump** on screen. Never say **Prepare** on the band.

## Published Proof

`/p/[slug]` is a designed share page. Not the space published live. Not a CV. Not a one-click resume site.

**Two steps, in Docs.** **Arrange** — they live on a **draft of this page**: pick which proofs, write a short why, set order. They can leave; the draft stays; the space is unchanged. **Publish** — the URL is public. Arrange again + Publish again to update. Unpublish from Docs; the space stays. Not live-sync.

**The page.** One considered layout: their name → personal link; title; role · dates · link; a why; then material in **their** order. Photos large, in the flow. Connected proofs are quiet, not a graph. Their words — no template voice, no auto-funny. Quiet footer. No Contact Me, no follow, no OpenPath hero.

**Hard-work mark.** The role · dates line becomes a one-line **span** (this Proof) plus faint ticks for their other published work. Tap → `/u/[handle]`. No dates → the line stays text.

**Advisor:** hotter than the app; why at ~65ch; photos may bleed wider; draft uses this same layout on the desk.

**Reference:** [Dust](https://frankchimero.com/projects/dust/). Reject Kickresume Websites. Artifact: [published-proof-outline.md](research/published-proof-outline.md).

## Personal link

`/u/[handle]` is a person and a record of published Proofs. Same public craft as `/p/[slug]`. No feed, no follow, no owner toolbar.

**Identity.** A sentence. Handle is in the URL.

**Span record** (internal name — not a label on the page). Each published Proof is a named ink span on a quiet year hairline, placed by **role · dates**. No dates → a tick on the day they Published. Overlap is a heavy season. A gap is axis, not failure. Years with no work don’t render. Zero Proofs → no mark, no grey grid.

**Index.** The same Proofs as year-grouped rows: dates · title · one-line why. A span is a door to `/p/[slug]`.

**Not:** GitHub day-grid, headline totals, colour intensity, streaks, “keep it green,” days they typed in Docs, unpublished spaces.

**Advisor:** ink on hairline, no second hue for “more.” Contrast on titles ≥4.5:1.

**Reference:** [hard-work-mark.md](research/hard-work-mark.md). Linear timeline geometry; read.cv entry anatomy; Chimero gap tolerance. Reject GitHub’s day-unit.

## Motion

Purpose first. Frequency gates. This repo’s tokens only — no new millisecond numbers. No CSS in the app until this spec is accepted.

**Instant** (100+/day, or tens/day colour): caret, typing, Tab, arrows, hover colour, keyboard Back/Enter on the gallery, page-break scroll, no-origin land (Application, Coach, New → Proof). Instant-Hover Rule stays.

**Occasional — spatial**

| What | Purpose | Term | Tool | Tokens |
| --- | --- | --- | --- | --- |
| Drive row ↔ Docs | Spatial consistency | **Shared element** (name→title, slab→sheet) + **Fade out** of the rest | View transition / WAAPI; `transform` + opacity | `--duration-surface` + `--ease-enter`. Exit `--ease-exit`. Scale never below 0.93. |
| Gallery tile → A4 | Spatial consistency | Same **Shared element**; other tiles **Fade out** | Same | Same |
| Add CV block / add proof | Preventing a jarring change | **Reveal** | CSS transition, opacity + `translateY` | `--duration-surface` + `--ease-enter` |
| Reorder a block | Spatial consistency | **Layout animation** of siblings | `transform: translate` (not height) | `--duration-surface` + `--ease-enter` until `DESIGN.md` grows an on-screen move curve |

`DESIGN.md` “Layout animation only on accordion” is superseded **for block reorder on the A4**.

**Rare**

| What | Purpose | Term | Tokens |
| --- | --- | --- | --- |
| Empty room → first sheet-edge row | State indication | **Reveal** of the first row, same room | `--duration-reveal` + `--ease-enter`. Once. |
| Upload scan | Explanation | **Reveal** | **Forbidden** until extract is real. |

**Reduced motion.** Skip all Translate/Scale travel. Instant land. Fade only if a fade was already the motion (other gallery tiles).

**Not motion.** No load orchestration. No stagger of Drive rows. No Float on the A4. No scan theater. No caret animation. Arrange/Publish is a Docs beat, not a page-transition show.
