## Appendix A. Prototype evidence and registry facts

No prototype ran. This was a read-only planning run with no installs or builds, because the machine's heavy lane is reserved. The open questions were settled from registry source instead, below. The first box of DS-1 (`pnpm view shadcn version`) and the side-pane check in DS-4a (verify-app-ui 15 at trunk) are the two facts left for an owner to observe.

Fetched 2026-10-24 with the free TinyFish fetch CLI. Raw pages are in `/home/quan/tmp/opencv-run/DS/raw-*.txt` and `own-*.txt`. The haiku research report is `/home/quan/tmp/opencv-run/DS/registry.md`.

- A1. shadcn changelog, https://ui.shadcn.com/docs/changelog. The October 2026 entry says "Trace and Code Block are available for Base UI, React Aria and Radix across all eight styles." Install lines `pnpm dlx shadcn@latest add trace` and `add code-block`. Code Block supports "diff and highlighted lines". Message Scroller, Message, Bubble, Marker, Attachment, Questionnaire are the chat components "released in June". "AI Elements replaces AI SDK Elements, and we are going to deprecate AI SDK Elements." The September 2026 entry says "Every shadcn component now imports `cn` from the `cn` package", migration `pnpm dlx shadcn@latest migrate cn`.
- A2. shadcn CLI, https://ui.shadcn.com/docs/cli (via `registry.md`). `-b, --base <base>   the component library to use. (base, radix, aria)`. `create` is an alias for `init`. npm latest read as 4.21.1 at https://registry.npmjs.org/shadcn/latest, which conflicts with the repo's `^4.22.1` pin, so DS-1 re-checks. Style items exist at https://ui.shadcn.com/r/styles/base-nova/button.json (imports `@base-ui/react/button`) and https://ui.shadcn.com/r/styles/radix-nova/button.json (imports `Slot` from `radix-ui`).
- A3. AI Elements, https://ui.shadcn.com/docs/ai-elements. "Each one is a composition of shadcn/ui components that you copy into your project. There is no package to install." Pattern pages, each with Base UI, React Aria and Radix tabs.
  - Chat, https://ui.shadcn.com/docs/ai-elements/base/chat.md. `npx shadcn@latest add message-scroller message bubble input-group`. The example imports `useChat` from `@ai-sdk/react` and types from `ai`.
  - Message, https://ui.shadcn.com/docs/ai-elements/base/message.md. `npx shadcn@latest add message bubble tooltip`. "The reply streams as markdown. Render it with Streamdown."
  - Tool, https://ui.shadcn.com/docs/ai-elements/base/tool.md. `npx shadcn@latest add trace code-block`.
  - Confirmation, https://ui.shadcn.com/docs/ai-elements/base/confirmation.md. `npx shadcn@latest add item button`.
  - Prompt Input, https://ui.shadcn.com/docs/ai-elements/base/prompt-input. `pnpm dlx shadcn@latest add input-group attachment dropdown-menu`. "Enter sends the message. Shift+Enter adds a new line."
  - Suggestion, https://ui.shadcn.com/docs/ai-elements/base/suggestion.md. `npx shadcn@latest add button`.
  - Migration table on the index page maps `conversation.tsx` to Chat, `message.tsx` to Message, `tool.tsx` to Tool, `confirmation.tsx` to Confirmation, `prompt-input.tsx` to Prompt Input. There is no separate Response element. Markdown lives in Message.
- A4. AI SDK Elements, https://elements.ai-sdk.dev (via `registry.md`). Banner "This project will be deprecated at the end of November 2026." Not used.
- A5. Kibo UI overview, https://www.kibo-ui.com/overview. "a component library and custom registry built on top of shadcn/ui", "using the same Tailwind CSS variable theming". https://www.kibo-ui.com/llms.txt returned `page_not_found`, so the full component list is unverified.
- A6. Kibo registry items.
  - https://www.kibo-ui.com/r/kanban.json. `"dependencies":["@dnd-kit/core","@dnd-kit/sortable","@dnd-kit/utilities","tunnel-rat"]`, `"registryDependencies":["card","scroll-area"]`. Imports `KeyboardSensor`, `MouseSensor`, `TouchSensor` and the `Announcements` type from `@dnd-kit/core`.
  - https://www.kibo-ui.com/r/status.json. `"dependencies":[]`, `"registryDependencies":["badge"]`.
  - https://www.kibo-ui.com/r/contribution-graph.json. `"dependencies":["date-fns"]`, `"registryDependencies":[]`, imports only `@/lib/utils` and `react`. The fetched text strips JSX, so its level styling hook is unverified.
  - https://www.kibo-ui.com/r/table.json. `["@tanstack/react-table","jotai","lucide-react"]`, registry deps `["button","dropdown-menu","table"]`.
  - https://www.kibo-ui.com/r/calendar.json. `["date-fns","jotai","lucide-react"]`, registry deps `["button","command","popover"]`.
  - https://www.kibo-ui.com/r/dropzone.json. `["lucide-react","react-dropzone"]`, registry deps `["button"]`.
- A7. Cult UI, https://www.cult-ui.com/llms.txt. "Components use Tailwind CSS v4, shadcn theme tokens, and usually `motion` for animation." Zero Radix mentions, eight Base UI mentions (Halo pieces). https://www.cult-ui.com/r/halo-tabs.json declares `"dependencies": ["@base-ui/react"]` and imports `@base-ui/react/tabs`.
- A8. Magic UI, https://magicui.design/llms.txt. Install `pnpm dlx shadcn@latest add @magicui/<name>`. https://magicui.design/r/shiny-button.json and `dock.json` import `motion/react` and `@/lib/utils`, no primitive library.
- A9. affectUI, https://www.affectui.com/llms.txt. "40 items are free and open source (MIT). The other 69 are part of affectUI Pro." "Every item is one .tsx file with its styles inside, no Tailwind, no animation library, no other dependencies." https://www.affectui.com/r/button.json has `"dependencies":[]`.
