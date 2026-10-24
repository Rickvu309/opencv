# UI registry research (fetched 2026-10-24)

Scratch fetches: /home/quan/tmp/opencv-run/DS/raw-*.txt. All fetches are free (TinyFish fetch CLI and registry JSON). No agent runs, sessions or installs.

## Summary

- Style-agnostic (import only `@/components/ui/*`, third-party libs, or nothing): shadcn AI Elements, AI SDK Elements (legacy), Kibo UI (kanban, table, dropzone), Magic UI, affectUI.
- Base UI specific: Cult UI Halo components (`@base-ui/react`), and shadcn's own `base-nova` style.
- Radix specific: shadcn's `radix-nova` and `new-york-v4` styles (`import { Slot } from "radix-ui"`). No registry in this set imports Radix directly.
- shadcn CLI: `shadcn@4.21.1` on npm (fetched). `create` is an alias for `init`. `init -b, --base` accepts `base`, `radix`, `aria`.
- Watch-out: since Sept 2026, shadcn components import `cn` from the `cn` package. Cult, Magic UI and Kibo items fetched here still import `cn` from `@/lib/utils`. Check the `cn` path in the repo before copying.

## 1. shadcn/ui (base layer) and style names

- Changelog: https://ui.shadcn.com/docs/changelog
  - "Trace and Code Block are available for Base UI, React Aria and Radix across all eight styles."
  - "Questionnaire is available for Base UI, React Aria, and Radix across all eight styles."
  - Sept 2026 `cn`: "Every shadcn component now imports `cn` from the `cn` package." Registry items import `cn` from "cn" (see the radix-nova button below).
- CLI docs: https://ui.shadcn.com/docs/cli
  - `shadcn init ... -t, --template` (next, vite, start, react-router, laravel, astro)
  - `-b, --base <base>   the component library to use. (base, radix, aria)`
  - `-p, --preset [name]   use a preset configuration`
  - `-d, --defaults   use default configuration: --template=next --preset=nova`
  - `The create command is an alias for init: pnpm dlx shadcn@latest create`
- Install docs: https://ui.shadcn.com/docs/installation recommends shadcn/create, a visual preset builder.
- components.json docs: https://ui.shadcn.com/docs/components-json
  - `"style": "new-york"` is the example. "The `default` style has been deprecated. Use the `new-york` style instead." The page does not list `base-nova` or `radix-*`. Its style-name list is UNVERIFIED (see below).
- Style registry items fetched (these paths exist):
  - https://ui.shadcn.com/r/styles/base-nova/button.json: `import { Button as ButtonPrimitive } from "@base-ui/react/button"` and `import { cn } from "@/registry/base-nova/lib/utils"`
  - https://ui.shadcn.com/r/styles/radix-nova/button.json: `import { Slot } from "radix-ui"` and `import { cn } from "cn"`
  - https://ui.shadcn.com/r/styles/new-york-v4/button.json: `import { Slot } from "radix-ui"` and `import { cn } from "cn"`
- UNVERIFIED: the full list of "eight styles". Only base-nova, radix-nova and new-york-v4 were fetched. "radix-*" as a family is partly verified (radix-nova only).
- npm (https://registry.npmjs.org/shadcn/latest): version 4.21.1.

## 2. shadcn AI Elements (replaces AI SDK Elements)

- URL: https://ui.shadcn.com/docs/ai-elements (also base/radix pages, e.g. https://ui.shadcn.com/docs/ai-elements/radix/prompt-input)
- Install: no package. Copy patterns with the shadcn CLI, e.g. `pnpm dlx shadcn@latest add input-group attachment dropdown-menu` (from the Prompt Input page). Changelog: `pnpm dlx shadcn@latest add trace`, `pnpm dlx shadcn@latest add code-block`.
- Patterns (21, from the page): Chat, Message, Message Scroller, Bubble, Prompt Input, Reasoning, Tool, Plan, Trace, Code Block, Confirmation, Context, Sources, Suggestion, Queue, Questionnaire, Subagent, Checkpoint, Inline Citation, Stack Trace, Terminal, Test Results, Model Selector, File Tree, Attachment, Marker, Task, Chain of Thought, shimmer. The changelog says "There are 21 patterns".
- Relevant to Coach (chat): Chat, Message, Message Scroller, Bubble, Prompt Input, Reasoning, Tool, Trace, Code Block, Confirmation (approve or deny a tool before it runs), Suggestion, Sources, Questionnaire, Attachment, Model Selector.
- Apply (job board): not a kanban here. Use Kibo kanban (section 3). AI Elements has Queue, Plan and Task, which are list-like only.
- Paper (CV editor): Attachment, Marker, Code Block only. No editor.
- Pitch (landing): not applicable beyond shadcn Card, Badge, Carousel and Separator.
- Dependencies: the Prompt Input page says `Prompt Input is built with the Input Group, Attachment and Dropdown Menu components.` Usage: `import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group"`. Trace description: "Works with the reasoning, tool and source parts from the AI SDK." The route uses `result.toUIMessageStreamResponse()`, so the AI SDK is needed on the server and for message parts. Whether the copied components import `ai` directly is UNVERIFIED. `streamdown` is not mentioned on the pages fetched.
- Base vs Radix targeting: the page has three tabs, "Base UI", "React Aria" and "Radix UI". The base and radix Prompt Input pages are identical apart from the link text. Diff: `< 2. Read https://ui.shadcn.com/docs/ai-elements/radix/prompt-input.md` vs `> 2. Read https://ui.shadcn.com/docs/ai-elements/base/prompt-input.md`. Verdict: style-agnostic.

## 3. AI SDK Elements (legacy, deprecated)

- URL: https://ai-sdk.dev/elements redirects to https://elements.ai-sdk.dev
- Banner: "AI Elements is moving to shadcn/ui. This project will be deprecated at the end of November 2026."
- Install: `npx ai-elements@latest add prompt-input` (also `npx ai-elements@latest add conversation`, from the page). npm `ai-elements` 1.9.0 (fetched).
- Registry item https://registry.ai-sdk.dev/prompt-input.json: `"dependencies":["ai","lucide-react","nanoid"]` and `"registryDependencies":["button","command","dropdown-menu","hover-card","input-group","select"]`. Imports `ai`, `@ai-sdk/react` (page example), and `@/components/ui/*`.
- Verdict: style-agnostic. No radix or base-ui import. It is shadcn-based, so it follows the project base.
- Migration: existing copied files keep working. The changelog says "AI Elements replaces AI SDK Elements, and we are going to deprecate AI SDK Elements."

## 4. Kibo UI

- URL: https://www.kibo-ui.com (docs at https://www.kibo-ui.com/docs). Kibo says it is "completely open source (MIT licensed)".
- Install: `npx kibo-ui add table` and `npx kibo-ui add dropzone` (from component pages). Also `npx shadcn@latest add https://www.kibo-ui.com/r/<name>.json`, which works for kanban, table and dropzone (fetched JSON).
- Components (verified): kanban, table, dropzone. Component pages mention `kibo-ui add`. Full list UNVERIFIED: https://www.kibo-ui.com/llms.txt and https://www.kibo-ui.com/llms-full.txt both return `page_not_found`, and /components only redirected to avatar-stack. Gantt, status, code-block, editor and color-picker are named in third-party coverage only, so UNVERIFIED for this repo.
- Kanban (https://www.kibo-ui.com/r/kanban.json): `"dependencies":["@dnd-kit/core","@dnd-kit/sortable","@dnd-kit/utilities","tunnel-rat"]`, `"registryDependencies":["card","scroll-area"]`. Imports `@/components/ui/card`, `@/components/ui/scroll-area`.
- Table (https://www.kibo-ui.com/r/table.json): `"dependencies":["@tanstack/react-table","jotai","lucide-react"]`, `"registryDependencies":["button","dropdown-menu","table"]`.
- Dropzone (https://www.kibo-ui.com/r/dropzone.json): `"dependencies":["lucide-react", ... "react-dropzone"]`, `"registryDependencies":["button"]`.
- Base vs Radix: no `@radix-ui` or `@base-ui` import in these three items. They use shadcn primitives through `@/components/ui/*`, so the project base decides. Kibo docs say: "Kibo components often wrap more complex logic from additional headless libraries". The Radix wording in the docs refers to shadcn's primitives, not Kibo. Verdict: style-agnostic (for the fetched items).
- Apply: kanban is the best fit (dnd-kit adds 3 packages). Table is a fit for the application list.
- Paper: dropzone for CV upload. Editor UNVERIFIED.
- Coach: no chat items verified in Kibo.
- Pitch: not a fit.

## 5. Cult UI

- URL: https://www.cult-ui.com/llms.txt (fetched)
- Install: `npx shadcn@latest add @cult-ui/{name}` (namespace built into the CLI) or `npx shadcn@latest add https://www.cult-ui.com/r/{name}.json`. Requires `npx shadcn@latest init`.
- Dependencies: "Components use Tailwind CSS v4, shadcn theme tokens, and usually `motion` for animation. Peer dependencies are listed on each component page." (llms.txt). Halo Tabs registry item: `"dependencies": ["@base-ui/react"]`. Magic-style items (Dock) use `motion`.
- Base vs Radix: llms.txt has zero Radix mentions. Base UI is named on: Border Beam Input, Halo Input, Halo Progress, Halo Segmented, Halo Select, Halo Switch, Halo Tabs, Halo Toggle Group (8 hits). Halo Tabs imports `import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"`. Verdict: Base UI for the Halo family, style-agnostic for the rest.
- Coach: Halo Input (`built on Base UI, with a frosted fill`), Halo Search, Border Beam Input (Base UI), Agent Suggest Card Stack, AI Blob Warp, Floating Panel (has form and textarea parts, uses Motion), Copy Button, Choice Poll.
- Apply: Halo Progress (Base UI), Halo Select (Base UI), Feature Voting (list with upvotes). No kanban found.
- Paper: Halo Dropzone (dashed rim, file glyphs), Halo Field, Halo Input/Textarea, Color Picker, Halo Select.
- Pitch: Hero Dithering, Hero Liquid Metal, Hero Heatmap, Hero Color Panels, Hero Static Radial Gradient (shader heroes; shader deps UNVERIFIED), Gradient Heading, Feature Carousel, Feature Sticky Section, Illustration Card Grid, Edge Blur, Marketing Feature Code, Minimal Card, Border Beam Card, Canvas Fractal Grid.
- Dock install / Motion note: AGENTS.md says Cult adds `motion`. Confirmed in llms.txt ("usually `motion`").
- Cult's `cn` path: Halo Tabs imports `@/lib/utils`.

## 6. Magic UI

- URL: https://magicui.design, llms index https://magicui.design/llms.txt
- Install: `pnpm dlx shadcn@latest add @magicui/<name>` (Shiny Button page). Registry: `https://magicui.design/r/{name}.json`.
- Dependencies: Shiny Button (`"dependencies": ["motion"]`, imports `motion/react`, `@/lib/utils`). Dock (`"dependencies": ["motion"]`, imports `motion/react`, `class-variance-authority`, `@/lib/utils`). The Dock docs prose says "framer motion", but the registry imports `motion/react`. No registryDependencies for Dock or Shiny Button.
- Base vs Radix: zero Radix or Base UI mentions in llms.txt. Verdict: style-agnostic.
- Components (llms.txt): Animated Beam, Animated List, Bento Grid, Blur Fade, Border Beam, Dock, Dot Pattern, Grid Pattern, Interactive Grid Pattern, Marquee, Magic Card, Number Ticker, Progressive Blur, Shimmer Button, Shiny Button, Spinning Text, Text Reveal, Text Animate, Typing Animation, Word Rotate, Warp Background, Hero Video Dialog, Terminal, File Tree, Scroll Progress.
- Coach: Typing Animation, Text Animate, Terminal, File Tree (agent log view), Animated List.
- Apply: Animated List, Number Ticker, Dock (no kanban).
- Paper: Dot Pattern, Grid Pattern (backgrounds only).
- Pitch: Bento Grid, Marquee, Shiny Button, Text Reveal, Blur Fade, Word Rotate, Progressive Blur, Number Ticker, Hero Video Dialog, Border Beam, Magic Card, Warp Background, Scroll Progress.
- Skill: `magic-ui` (per AGENTS.md; not fetched here).

## 7. affectUI

- URL: https://www.affectui.com/llms.txt
- Counts (verbatim): "40 items are free and open source (MIT). The other 69 are part of affectUI Pro, a one-time purchase (https://www.affectui.com/pricing)."
- Install (free): `npx shadcn@latest add https://www.affectui.com/r/<name>.json`. Short names: register `"@affectui": "https://www.affectui.com/r/{name}.json"` under `registries` in components.json, then `npx shadcn@latest add @affectui/<name>`. Pro needs an access key (AFFECTUI_TOKEN). Do not add Pro items.
- Dependencies: "Every item is one .tsx file with its styles inside – no Tailwind, no animation library, no other dependencies. React 19, dark mode and reduced motion built in." Registry item https://www.affectui.com/r/button.json: `"dependencies":[]`, imports only `react`.
- Base vs Radix: no Radix or Base UI mention. Verdict: style-agnostic. Inline styles, so map colors to shadcn variables (AGENTS.md).
- Free items (40, by name): Button, Change Summary, Comment Thread, Decision Inbox, Email Draft, Filter Menu, Message Actions, Notification Stack, OTP Input, Profile Menu, Progress Tracker, Reaction Bar, Segmented Control, Smart Recommendation, Thinking Loader, Tips Panel, Tool Call Card, Logo Marquee, Testimonial Wall, Agent Team, Cover Flow, DACH Region, Empty Calendar, Enrichment Orbit, Frost Cloud, Ghosted Chat, Glow Cloud, Integration Beam, Integration Grid, Layer Stack, Lead Sourcing, Logo Cluster, Model Wheel, Side Folder, Tab Overload, Team Invite, Grid Background, Number Ticker, Shimmer Loader, Text Reveal.
- Coach: Message Actions, Thinking Loader, Tool Call Card, Comment Thread, Ghosted Chat, Tips Panel, Smart Recommendation.
- Apply: Progress Tracker, Filter Menu, Decision Inbox, Team Invite, Side Folder, Layer Stack, Tab Overload (semantics not verified for the last four).
- Paper: Email Draft, Change Summary, Filter Menu.
- Pitch: Logo Marquee, Testimonial Wall, Cover Flow, Text Reveal, Number Ticker, Grid Background, Frost Cloud, Glow Cloud, Shimmer Loader, Integration Grid.
- Pro (excluded): AI Answer, Chat Composer, Approval Card, Data Table, Combobox, Delegate Board, Dropzone, Tilt Card, etc.

## Cross-cutting notes

- Base targeting for the repo: packages/ui is shadcn-style source, and style choice (base-nova vs radix-nova vs new-york-v4) decides whether `Button`, `Dialog`, `Tabs`, `Select` etc. import Base UI or Radix. Any copied registry item that imports `@/components/ui/*` inherits that choice.
- `cn` path: shadcn now imports `cn` from "cn". Cult, Magic UI and Kibo items fetched here import from `@/lib/utils`. Adjust the import when copying into packages/ui.
- Motion: Cult (usually) and Magic UI (Shiny Button, Dock) use `motion/react` (npm `motion` 14.1.0 at fetch time, https://registry.npmjs.org/motion/latest).
- Versions (npm, fetched): shadcn 4.21.1, ai-elements 1.9.0, kibo-ui 1.1.5, motion 14.1.0.
- Dates: shadcn changelog entries Oct 2026 (Trace, Code Block, AI Elements), Sept 2026 (cn), Aug 2026 (Private GitHub registries, Questionnaire).

## UNVERIFIED list

- shadcn: full list of eight styles; the names `radix-*` beyond radix-nova; whether `shadcn create` is the same as init in every version (CLI docs say alias).
- AI Elements: whether copied components import `ai` or `streamdown` directly (page code partly shown); exact file list per pattern.
- Kibo: full component list (llms.txt 404); status, gantt, code-block, editor, color-picker; whether a Base UI variant exists.
- Cult: shader deps for the Hero components; whether Cult components beyond Halo use Radix (none found).
- Magic UI: deps for components other than Shiny Button and Dock; install command for other items (same shadcn pattern assumed).
- affectUI: deps and imports for free items other than Button; semantics of Layer Stack, Side Folder, Tab Overload.
- Sources not reached: https://www.kibo-ui.com/installation (404), https://www.kibo-ui.com/llms-full.txt (404).
