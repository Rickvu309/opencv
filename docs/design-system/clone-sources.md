# Clone sources

How to design OpenPath UI without inventing. Tokens, copy, and layout still win; these sources supply the commodity interaction. Open the source, name the pieces in [components.md](components.md), implement in OpenPath tokens and [copy.md](../copy.md). Do not invent a third pattern.

The gallery that makes the ported layer reviewable is two local Storybooks (`npm run storybook`: Opath (Production) on 6006, Opath (Lab) on 6007) and the hosted galleries on Railway (Production https://opath-production.up.railway.app, Lab https://opath-lab.up.railway.app) in [hosting.md](../hosting.md). If a surface takes props, it gets a story; if it fetches, it stays in the app.

## Marketing landing

`/` clones the [onyx.app](https://onyx.app/) marketing shell, not Opal and not Linear's product chrome. Take: sticky translucent nav, centered hero (large promise, product composer in the hero), quiet footer. The composer is the [assistant-ui chat-panel](https://www.assistant-ui.com/elements/chat-panel) bar: pill, field plus send, no suggestion chips. No attach, `@` menus, `/` commands, model picker, dictation, or glimm. Spec: [landing.md](../features/landing.md).

## Drive lists

`/proof`, `/search`, and `/applications` clone [Google Drive list view](https://mobbin.com/screens/69fe56d5-75d6-497c-8f3c-b05cb146b5be) anatomy: hairline rows, hover-reveal `···`. Apply groups rows. Do not take folders, file-type glyphs, owner avatars, or a bulk selection toolbar. Type stays a word on those lists.

## Paper Drive

`/paper` clones [Figma Recents](https://mobbin.com/screens/e200ae69-43dd-4777-a4e3-35244e99b425) and [Flodesk emails](https://mobbin.com/screens/ad5725c3-3042-4a0d-b283-bc2a9278e1a7): the thumbnail is the work. Each card is a tiny A4 (scaled `PaperPage`); title and relative time sit under it. New CV is a dashed empty page the same size. Drop a PDF onto the grid. Do not take Recents / Shared / Teams / Drafts, type tabs, or Name / Type / Date columns. Spec: [paper.md](../features/paper.md).

## Four sources, one job each

| Source | Licence | Job |
|---|---|---|
| [Onyx Opal](https://github.com/onyx-dot-app/onyx) / [Storybook](https://onyx-storybook.vercel.app/) | MIT except `ee/` | Primary. Primitive set, interaction state matrix, AI-app surfaces (approval, input bar). Port anatomy; restyle. Take nothing from `ee/`. |
| [assistant-ui](https://github.com/assistant-ui/assistant-ui) | MIT | Thread behaviour: auto-scroll, stop, retry, date groups, [reasoning panel](https://www.assistant-ui.com/elements/reasoning-panel), [tool call](https://www.assistant-ui.com/elements/tool-call). Copy UX; do **not** install `@assistant-ui/react`. |
| [Beautiful UI](https://www.beautifului.dev/) | Copy-paste markup | Visual polish for the same chrome. Do not take the Creamery demo palette, uppercase group labels, or count badges. Lab: `Lab/Components/Chat` and related. |
| [Open WebUI](https://github.com/open-webui/open-webui) | BSD-3 plus branding clause | Patterns only, never code. Take: history grouping and search, message action bar, code-block copy, queued messages while a reply streams. |

## Lab sourced galleries

Opath (Lab) also catalogs free commodity kits for review in Storybook (`packages/opath-ui/src/lab`). The sidebar is **Components** and **Templates**, not kit names. Production still composes root primitives. Do not republish these collections as a competing kit.

| Storybook | Source | Licence | What we took |
|---|---|---|---|
| `Lab/Components/Motion` | [transitions.dev](https://transitions.dev/) | Use in product; do not redistribute as a transitions library | All free recipes. No Pro. |
| `Lab/Components/*` | [beui.dev/components/motion](https://beui.dev/components/motion) | Free motion category | All motion primitives, restyled. |
| `Lab/Components/Chat` (and Data, Navigation) | [beautifului.dev](https://www.beautifului.dev/) | Copy-paste markup | All 20 primitives, OpenPath tokens. |
| `Lab/Components/*` | [ui.8starlabs.com](https://ui.8starlabs.com/docs/components) | MIT | All documented components. |
| `Lab/Components/*` and `Lab/Templates/*` | [kibo-ui.com](https://www.kibo-ui.com/) | MIT | All free components plus free blocks (collaborative canvas, codebase, roadmap). |
| `Lab/Templates/*` | [blocks.so](https://github.com/ephraimduncan/blocks) | MIT | All registry blocks. |

## Onyx Opal — port, do not install

Installing `@onyx-ai/opal` fails on two facts: it ships a Tailwind v3 preset whose colour variables the consumer must define, and it lists `next` as a peer with components importing `next/link`. We are Tailwind v4 (`@theme` in `src/styles/globals.css`) and TanStack Router. Port the source into `packages/opath-ui` and Coach components, restyle to [tokens.md](tokens.md), attribute in [NOTICE.md](../../NOTICE.md).

Their frontend law (`web/AGENTS.md`) is adopted where it does not conflict: never a raw `<button>` or `<input>` outside a primitive, no `dark:` modifier (semantic tokens carry the opposite value), padding over margins, `cn` for every className, props interface beside the component, shared types in a co-located `interfaces.ts`, size variants defaulting to `md`.

### Per-surface map

| Their surface | Our surface |
|---|---|
| `Interactive` / `Hoverable` | [interactive.tsx](../../packages/opath-ui/src/interactive.tsx), [hoverable.tsx](../../packages/opath-ui/src/hoverable.tsx) |
| Button / SelectButton / SidebarTab | Button, rail item |
| Tag / Chip | Chip |
| Tooltip, Collapsible, Tabs, Table, Switch, Checkbox | matching `packages/opath-ui/src/` files |
| Code + CopyButton | Code, CopyButton |
| Card / EmptyMessageCard / EndOfList | Card family |
| Approval Card / Payload View | Coach approval |
| Craft Input Bar / Interrupt Hint / Queued Message Bar | Composer |
| ChatSessionSkeleton / SidebarTabSkeleton | thread and history skeletons |
| CompactMarkdown | Coach `md.tsx` |

### Do not port

Opal's `Text` component and its `font`/`color` preset system (we use the type scale in tokens.md directly), `RichStr`, the icon and illustration packs (we are on `lucide-react`), formik forms, `@dnd-kit` sorting, charts, Calendar and date pickers, the model picker, `Interactive`'s `next/link` variants, and anything under Onyx `ee/`.

## assistant-ui

Docs: [Thread](https://www.assistant-ui.com/docs/ui/thread), [ThreadList](https://www.assistant-ui.com/docs/ui/thread-list), [reasoning panel](https://www.assistant-ui.com/elements/reasoning-panel), [tool call](https://www.assistant-ui.com/elements/tool-call).

Copy anatomy, not the runtime:

- Thread: empty welcome + suggestions; messages; composer pinned in the viewport footer; auto-scroll; retry; stop while running.
- ThreadList: New; items with `aria-current`; overflow menu (rename, delete). Date groups (Today / Yesterday / Earlier) when History is long enough.
- Composer: Enter sends, Shift+Enter newline; send becomes stop while running.
- Reasoning panel: shimmering **Thinking** + elapsed while streaming; settled **Thought for 4s**; collapsible `{ title, body }` steps with a pulsing last-step dot. Full thread width, OpenPath tokens.
- Tool call: left chevron, shimmering running verb, query chip, settled check; Request / Result disclosure. Full thread width, OpenPath tokens.

Keep `conversation.*`, the command bus, and the dock.

## Beautiful UI

| Their primitive | Our surface |
|---|---|
| Sidebar Nav | Rail (sliding hover pill, New conversation as an icon+label row like Grok New Chat, ink-weight active) |
| Chat | `/coach` thread + dock body |
| Prompt Bar | Coach composer (no `/` commands, no model picker, no dictation) |
| Streaming Text | Coach replies |
| Thinking | Coach reasoning panel |
| Tool Chips | Coach tool call |
| Approval Card | Destructive confirms in the thread |
| Recommendation Card | Artifact cards the Coach yields |

## Open WebUI

Svelte, and the licence forbids removing "Open WebUI" branding. Use as a pattern reference only. Do not copy source, assets, or class names.

## Order of work

1. Open the source (Opal story, Beautiful UI page, or assistant-ui docs).
2. Name the pieces in [components.md](components.md) if the block is new.
3. Implement in OpenPath tokens, [copy.md](../copy.md) voice, 44px touch / 40px desktop.
4. Add a story if the surface takes props.
5. Do not invent a third pattern.

## Skip from those sources

Command palette, unread badges, `/` search, model picker, dictation, multi-model conversations, voice and video, RAG citations, skills, sandboxes, calendars — [navigation.md](../features/navigation.md) and this file's do-not-port list.
