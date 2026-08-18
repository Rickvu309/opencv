# Clone sources

How to design OpenPath UI without inventing. Tokens, copy, and layout still win; these sources supply the commodity interaction. Open the source, name the pieces in [components.md](components.md), implement in OpenPath tokens and [copy.md](../copy.md). Do not invent a third pattern.

The gallery that makes the ported layer reviewable is `npm run storybook` locally and the Vercel Storybook host in [hosting.md](../hosting.md). If a surface takes props, it gets a story; if it fetches, it stays in the app.

## Four sources, one job each

| Source | Licence | Job |
|---|---|---|
| [Onyx Opal](https://github.com/onyx-dot-app/onyx) / [Storybook](https://onyx-storybook.vercel.app/) | MIT except `ee/` | Primary. Primitive set, interaction state matrix, AI-app surfaces (tool cards, approval, thinking, input bar). Port anatomy; restyle. Take nothing from `ee/`. |
| [assistant-ui](https://github.com/assistant-ui/assistant-ui) | MIT | Thread behaviour: auto-scroll, stop, retry, date groups. Copy UX; do **not** install `@assistant-ui/react`. |
| [Beautiful UI](https://www.beautifului.dev/) | Copy-paste markup | Visual polish for the same chrome. Do not take the Creamery demo palette, uppercase group labels, or count badges. |
| [Open WebUI](https://github.com/open-webui/open-webui) | BSD-3 plus branding clause | Patterns only, never code. Take: history grouping and search, message action bar, code-block copy, queued messages while a reply streams. |

## Onyx Opal — port, do not install

Installing `@onyx-ai/opal` fails on two facts: it ships a Tailwind v3 preset whose colour variables the consumer must define, and it lists `next` as a peer with components importing `next/link`. We are Tailwind v4 (`@theme` in `src/styles/globals.css`) and TanStack Router. Port the source into `src/ui/` and Coach components, restyle to [tokens.md](tokens.md), attribute in [NOTICE.md](../../NOTICE.md).

Their frontend law (`web/AGENTS.md`) is adopted where it does not conflict: never a raw `<button>` or `<input>` outside a primitive, no `dark:` modifier (semantic tokens carry the opposite value), padding over margins, `cn` for every className, props interface beside the component, shared types in a co-located `interfaces.ts`, size variants defaulting to `md`.

### Per-surface map

| Their surface | Our surface |
|---|---|
| `Interactive` / `Hoverable` | [interactive.tsx](../../src/ui/interactive.tsx), [hoverable.tsx](../../src/ui/hoverable.tsx) |
| Button / SelectButton / SidebarTab | Button, rail item |
| Tag / Chip | Chip |
| Tooltip, Collapsible, Tabs, Table, Switch, Checkbox | matching `src/ui/` files |
| Code + CopyButton | Code, CopyButton |
| Card / EmptyMessageCard / EndOfList | Card family |
| Craft Tool Card / Tool Group / bodies | Coach tool cards |
| Approval Card / Payload View | Coach approval |
| Thinking Card | Coach thinking |
| Craft Input Bar / Interrupt Hint / Queued Message Bar | Composer |
| ChatSessionSkeleton / SidebarTabSkeleton | thread and history skeletons |
| CompactMarkdown | Coach `md.tsx` |

### Do not port

Opal's `Text` component and its `font`/`color` preset system (we use the type scale in tokens.md directly), `RichStr`, the icon and illustration packs (we are on `lucide-react`), formik forms, `@dnd-kit` sorting, charts, Calendar and date pickers, the model picker, `Interactive`'s `next/link` variants, and anything under Onyx `ee/`.

## assistant-ui

Docs: [Thread](https://www.assistant-ui.com/docs/ui/thread), [ThreadList](https://www.assistant-ui.com/docs/ui/thread-list).

Copy anatomy, not the runtime:

- Thread: empty welcome + suggestions; messages; composer pinned in the viewport footer; auto-scroll; retry; stop while running.
- ThreadList: New; items with `aria-current`; overflow menu (rename, delete). Date groups (Today / Yesterday / Earlier) when History is long enough.
- Composer: Enter sends, Shift+Enter newline; send becomes stop while running.

Keep `conversation.*`, the command bus, and the dock.

## Beautiful UI

| Their primitive | Our surface |
|---|---|
| Sidebar Nav | Rail (sliding hover pill, accent New conversation, ink-weight active) |
| Chat | `/coach` thread + dock body |
| Prompt Bar | Coach composer (no `/` commands, no model picker, no dictation) |
| Streaming Text | Coach replies |
| Thinking | Coach working / tool-running |
| Tool Chips | Coach command results in the thread |
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
