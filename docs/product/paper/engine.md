# The Paper engine

How the new Paper core works and what it promises. The decision is ADR 0009. The shapes on the wire are zod schemas in `packages/domain/src/paper-doc`; the engine is `packages/paper-engine`, a pure package with no database, server, browser or AI imports. No ProseMirror type leaves it.

## Where it lives

| Part            | Code                                                                             |
| --------------- | -------------------------------------------------------------------------------- |
| Shapes          | `packages/domain/src/paper-doc`                                                  |
| Engine          | `packages/paper-engine`                                                          |
| Editor          | `apps/web/src/features/paper/editor`                                             |
| Change log      | `apps/api/src/paper/log`                                                         |
| Word in and out | `apps/api/src/paper/word`, entered through `apps/api/src/paper/engine-import.ts` |
| PDF out         | `apps/api/src/paper/pdf`                                                         |

A Paper is a row in `paper_docs` with its ordered Changes in `paper_changes`; `paper_shares` holds its share token. Migration `0029_paper_drop_old` drops the old core's tables: `paper_doc_updates`, `paper_package_heads`, `paper_package_versions`, `paper_package_candidates` and `paper_package_trash`.

## Shapes

- **Paper**: `doc > block+` on a page setup (A4 by default, portrait, margins in points) with a template.
- **Block**: a text block (`kind` title, subtitle, heading, subheading or paragraph; `list` bullet, numbered or none; `level` 0 to 8; align; line spacing; keep with next; one right tab stop), a photo, a table of Runs, a divider or a page break. Every Block has an id from `Ports.ids`.
- **Run**: text with marks (bold, italic, underline, strike, link, colour, font, size) or a hard break. Fonts are Liberation Sans, Liberation Serif, Liberation Mono and Carlito.
- **Pos**: a Block id and a UTF-16 offset, plus a table cell when inside one. Selections are text, block or all.
- **Command**: one `DocCommand` union for the keyboard, the toolbar, paste, Coach and outside agents. Coach and agents use a subset and send `expect`, the exact text they replace.
- **Change**: `{ edit, origin, base, steps, inverse, commands }`. `origin` is person, coach, agent, import or system.
- **Refusal**: expect mismatch, no such position, schema, too large, stale, unmappable.
- **Layout**: pages of boxes (line, image, rule, cell) in integer millipoints, the same in the browser, on the server, in the thumbnail and in the PDF.

## Interface

```ts
export interface Ports {
  ids: () => BlockId
  now: () => number
  metrics: Metrics
}

export interface PaperEngine {
  load(doc: Document, version: number, client: string): EditorState
  run(
    state: EditorState,
    commands: readonly DocCommand[],
    origin: Origin
  ): { state: EditorState; change: Change } | { refusal: Refusal }
  select(
    state: EditorState,
    command: SelectionCommand,
    layout: Layout
  ): EditorState
  receive(
    state: EditorState,
    changes: readonly Change[]
  ): { state: EditorState; lost: Run[] }
  sendable(state: EditorState): Change | null
  undo(state: EditorState): { state: EditorState; change: Change } | null
  redo(state: EditorState): { state: EditorState; change: Change } | null
  revert(
    doc: Document,
    change: Change,
    later: readonly Change[]
  ): { steps: StepJSON[] } | { refusal: Refusal }
  layout(doc: Document, previous: Layout | null): Layout
  locate(layout: Layout, point: { page: number; x: Pt; y: Pt }): Pos
  caret(layout: Layout, pos: Pos): Rect
  read(state: EditorState): {
    doc: Document
    selection: Selection
    version: number
  }
}

export function createEngine(ports: Ports): PaperEngine
```

`EditorState` is opaque. Tests use seeded ids, a fixed clock and fixed metrics.

## One way per task

| Task                     | Path                                                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typing                   | hidden textarea, then `insertText` or `deleteRange`, then `run`, layout of changed Blocks, paint, pending Change saved                                                       |
| Toolbar and shortcuts    | a `DocCommand` or `SelectionCommand` built from the selection; the toolbar never touches page text                                                                           |
| Paste                    | clipboard HTML normalized and parsed against the schema, or plain text split per line, then `pasteFragment`; Undo closes a group on both sides                               |
| Coach and outside agents | `paper.edit` with `basedOn` and commands, a server dry run makes a Suggestion, the person's Accept is the registry approval that appends the Change and its receipt together |
| Save and sync            | `paper.save` pushes pending Changes on a base version; a stale base gets the Changes since and the client rebases                                                            |
| Undo                     | Ctrl+Z inverts this tab's newest group; the receipt Undo reverts a Coach or agent Change through `revert` or refuses                                                         |
| Export                   | PDF from `layout` with the same fonts; Word with named styles (Title, Subtitle, Heading1, Heading2, Normal, ListParagraph) and real links                                    |

## Promises

| Promise                                      | Means                                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| No text outside a range is lost              | A command changes only its range. Select all is its own selection kind, and a move without Shift always collapses it                |
| Exact Undo                                   | Undo to the start gives the starting Paper exactly; the inverse of every Change restores the Paper before it                        |
| Same result in the browser and on the server | Replaying the stored steps gives the same Paper byte for byte; layout never asks the browser how to break lines                     |
| Same pages on screen, thumbnail and PDF      | One layout from one metrics table drives all three; page count and the first and last line of each page match                       |
| One keystroke inside a frame                 | A key re-lays only the Blocks it changed; p95 keydown to next frame within 1.5 ms of a bare textarea                                |
| Valid after every command                    | The schema and its invariants hold after every `run` and `receive`; the server refuses a Change that breaks them and stores nothing |

Each promise and each row of the 2026-11-27 editor audit is a case in `apps/api/src/scenarios/paper-engine.scenario.test.ts`, marked as expected to fail until the unit that keeps it lands. Rows that only a browser can show (the slash placeholder, Ctrl+H, the other tab's caret, the loss after a menu and Escape) are checked by the scripted Paper walk before the switch.
