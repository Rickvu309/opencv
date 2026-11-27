import type {
  Block,
  BlockId,
  DocCommand,
  Document,
  Pos,
  Range,
  SelectionCommand,
} from "@workspace/domain/paper-doc"
import {
  caret,
  lineEdges,
  locate,
  type Layout,
  type Metrics,
  type PagePoint,
} from "@workspace/paper-engine"

import {
  allMarked,
  codeUnitsAfter,
  codeUnitsBefore,
  containerAt,
  shift,
  textBlocksIn,
  type DocIndex,
} from "./doc-positions.ts"
import type { createEditorTools } from "./editor-tools.ts"
import type { KeyAction } from "./input-port.ts"

type KeyActionContext = {
  doc(): Document
  index(): DocIndex
  layout(): Layout
  head(): Pos
  anchor(): Pos
  collapsed(): boolean
  currentRange(): Range
  blockOf(block: BlockId): Block | undefined
  run(commands: DocCommand[]): boolean
  selectCommand(command: SelectionCommand): void
  select(from: Pos, to: Pos): void
  deleteSelection(): void
  undo(): void
  redo(): void
  tools: Pick<ReturnType<typeof createEditorTools>, "openFind" | "openLink">
}

export function createKeyActions(metrics: Metrics, context: KeyActionContext) {
  const {
    doc,
    index,
    layout,
    head,
    anchor,
    collapsed,
    currentRange,
    blockOf,
    run,
    selectCommand,
    select,
    deleteSelection,
    tools,
  } = context
  let goalX: number | null = null

  function listBlocks(range: Range) {
    return textBlocksIn(doc(), index(), range).filter((id) => {
      const block = blockOf(id)
      return block?.type === "text_block" && block.attrs.list !== null
    })
  }

  function backspace(word: boolean) {
    if (!collapsed()) return deleteSelection()
    if (word) {
      selectCommand({ op: "move", unit: "word", dir: -1, extend: true })
      if (!collapsed()) deleteSelection()
      return
    }
    const here = head()
    const found = containerAt(index(), here)
    if (!found) return
    if (here.offset > 0) {
      const units = codeUnitsBefore(found.container.text, here.offset)
      run([
        { op: "deleteRange", range: { from: shift(here, -units), to: here } },
      ])
      return
    }
    if (here.cell) return
    const block = blockOf(here.block)
    if (block?.type === "text_block" && block.attrs.list !== null) {
      run([{ op: "setList", blocks: [here.block], list: null }])
      return
    }
    if ((index().order.get(here.block) ?? 0) > 0)
      run([{ op: "joinBlocks", block: here.block, direction: "backward" }])
  }

  function forwardDelete(word: boolean) {
    if (!collapsed()) return deleteSelection()
    if (word) {
      selectCommand({ op: "move", unit: "word", dir: 1, extend: true })
      if (!collapsed()) deleteSelection()
      return
    }
    const here = head()
    const found = containerAt(index(), here)
    if (!found) return
    if (here.offset < found.container.text.length) {
      const units = codeUnitsAfter(found.container.text, here.offset)
      run([
        { op: "deleteRange", range: { from: here, to: shift(here, units) } },
      ])
      return
    }
    if (here.cell) return
    if ((index().order.get(here.block) ?? 0) < doc().content.length - 1)
      run([{ op: "joinBlocks", block: here.block, direction: "forward" }])
  }

  function enter() {
    if (collapsed()) {
      run([{ op: "splitBlock", at: head() }])
      return
    }
    const range = currentRange()
    run([
      { op: "deleteRange", range },
      { op: "splitBlock", at: range.from },
    ])
  }

  function vertical(dir: -1 | 1, extend: boolean) {
    const from = head()
    const rect = caret(metrics, layout(), from)
    if (goalX === null) goalX = rect.x
    const goal = goalX
    const page = layout().pages[rect.page]!
    const tryPoint = (point: PagePoint) => {
      const pos = locate(metrics, layout(), point)
      const moved = caret(metrics, layout(), pos)
      return moved.page === rect.page && moved.y === rect.y ? null : pos
    }
    let target =
      dir > 0
        ? tryPoint({ page: rect.page, x: goal, y: rect.y + rect.h + 1 })
        : rect.y - 1 >= page.content.y
          ? tryPoint({ page: rect.page, x: goal, y: rect.y - 1 })
          : null
    const nextPage = layout().pages[rect.page + dir]
    if (!target && nextPage)
      target = tryPoint({
        page: nextPage.index,
        x: goal,
        y:
          dir > 0
            ? nextPage.content.y
            : nextPage.content.y + nextPage.content.h - 1,
      })
    if (!target) {
      selectCommand({ op: "move", unit: "doc", dir, extend })
    } else {
      select(extend ? anchor() : target, target)
    }
    goalX = goal
  }

  function lineEdge(dir: -1 | 1, extend: boolean) {
    const edges = lineEdges(layout(), head())
    const target = dir < 0 ? edges.start : edges.end
    select(extend ? anchor() : target, target)
  }

  function act(action: KeyAction) {
    if (!(action.do === "move" && action.unit === "line")) goalX = null
    const range = currentRange()
    switch (action.do) {
      case "move":
        if (action.unit === "line") return vertical(action.dir, action.extend)
        if (action.unit === "lineEdge")
          return lineEdge(action.dir, action.extend)
        return selectCommand({
          op: "move",
          unit: action.unit,
          dir: action.dir,
          extend: action.extend,
        })
      case "selectAll":
        return selectCommand({ op: "selectAll" })
      case "undo":
        return context.undo()
      case "redo":
        return context.redo()
      case "mark":
        run([
          {
            op: "setMark",
            range,
            mark: { type: action.mark },
            on: !allMarked(doc(), index(), range, action.mark),
          },
        ])
        return
      case "find":
        return tools.openFind(action.replace)
      case "link":
        return tools.openLink(doc(), head(), collapsed(), () => {
          if (collapsed()) selectCommand({ op: "selectWord" })
          return currentRange()
        })
      case "clearFormatting":
        run([{ op: "clearFormatting", range }])
        return
      case "kind": {
        const blocks = textBlocksIn(doc(), index(), range)
        if (blocks.length)
          run([{ op: "setBlockKind", blocks, kind: action.kind }])
        return
      }
      case "list": {
        const blocks = textBlocksIn(doc(), index(), range)
        if (!blocks.length) return
        const already = blocks.every((id) => {
          const block = blockOf(id)
          return (
            block?.type === "text_block" && block.attrs.list === action.list
          )
        })
        run([{ op: "setList", blocks, list: already ? null : action.list }])
        return
      }
      case "level": {
        const blocks = listBlocks(range)
        if (blocks.length) run([{ op: "shiftLevel", blocks, by: action.by }])
        return
      }
      case "tab": {
        const blocks = textBlocksIn(doc(), index(), range)
        const lists = listBlocks(range)
        if (blocks.length > 0 && lists.length === blocks.length) {
          run([{ op: "shiftLevel", blocks: lists, by: action.by }])
          return
        }
        if (action.by > 0) run([{ op: "insertText", range, text: "\t" }])
        return
      }
      case "enter":
        return enter()
      case "lineBreak":
        run([
          {
            op: "pasteFragment",
            range,
            fragment: [{ type: "hard_break" }],
          },
        ])
        return
      case "pageBreak":
        run([{ op: "insertBlock", at: head(), block: "page_break" }])
        return
      case "backspace":
        return backspace(action.word)
      case "delete":
        return forwardDelete(action.word)
    }
  }

  return {
    act,
    forgetGoal() {
      goalX = null
    },
  }
}
