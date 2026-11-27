import "./paper-editor.css"

import {
  docCommandSchema,
  type BlockId,
  type DocCommand,
  type Document,
  type Origin,
  type Pos,
  type Range,
  type Selection,
  type SelectionCommand,
} from "@workspace/domain/paper-doc"
import {
  caret,
  createEngine,
  createLayouter,
  lineEdges,
  locate,
  paperFontMetrics,
  selectionRange,
  type EditorState,
  type InputEdit,
  type Layout,
  type Metrics,
  type PagePoint,
} from "@workspace/paper-engine"

import {
  allMarked,
  comparePos,
  containerAt,
  indexDoc,
  ordered,
  samePos,
  textBetween,
  textBlocksIn,
  type DocIndex,
} from "./doc-positions.ts"
import {
  createInputPort,
  type InputKind,
  type InputSink,
  type Mirror,
  type TextareaEdit,
} from "./input-port.ts"
import type { KeyAction } from "./keymap.ts"
import { createOverlays, rangeRects, type PageRect } from "./overlays.ts"
import {
  createPainter,
  MPT_PER_PX,
  PAGE_GAP_PX,
  pageScale,
  placement,
  px,
} from "./painter.ts"
import { attachPointer } from "./pointer.ts"

export type PaperEditorOptions = {
  doc: Document
  metrics?: Metrics
  askLink?: (current: string) => string | null
}

export type PaperEditor = {
  read(): { doc: Document; selection: Selection }
  layout(): Layout
  scale(): number
  focus(): void
  destroy(): void
}

const MIRROR_WINDOW = 2000
const STAND_IN_LIMIT = 1000
const NARROW_PX = 600

function at(block: BlockId, cell: Pos["cell"], offset: number): Pos {
  return cell ? { block, cell, offset } : { block, offset }
}

const shift = (pos: Pos, by: number) => at(pos.block, pos.cell, pos.offset + by)

const sameContainer = (a: Pos, b: Pos) =>
  a.block === b.block &&
  a.cell?.row === b.cell?.row &&
  a.cell?.col === b.cell?.col

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function codeUnitsBefore(text: string, offset: number): number {
  const low = text.charCodeAt(offset - 1)
  const high = text.charCodeAt(offset - 2)
  return low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff
    ? 2
    : 1
}

function codeUnitsAfter(text: string, offset: number): number {
  const high = text.charCodeAt(offset)
  return high >= 0xd800 && high <= 0xdbff ? 2 : 1
}

export function mountPaperEditor(
  host: HTMLElement,
  options: PaperEditorOptions
): PaperEditor {
  const metrics = options.metrics ?? paperFontMetrics
  const engine = createEngine({
    ids: () => randomId() as BlockId,
    now: () => Date.now(),
  })
  const layouter = createLayouter(metrics)
  const client = `page-${randomId()}`
  const origin: Origin = { kind: "person", actor: "person", client }
  let state: EditorState = engine.load(options.doc, 0, client)
  let doc = engine.read(state).doc
  let selection = engine.read(state).selection
  let index: DocIndex = indexDoc(doc)
  let layout = layouter.layout(doc, null)
  let composition: { from: Pos; to: Pos } | null = null
  let goalX: number | null = null
  let dragAnchor: Pos | null = null
  let focused = false
  let scale = 1
  let fittedWidth = -1
  let base: { pos: Pos } | { whole: Range } = { whole: currentRange() }
  let scrollQueued = false

  host.classList.add("paper-editor")
  const stage = document.createElement("div")
  stage.className = "paper-editor-stage"
  const overlays = createOverlays()
  stage.append(overlays.layer)
  host.append(stage)
  const painter = createPainter(stage, metrics)

  function currentRange(): Range {
    return ordered(index, selectionRange(doc, selection))
  }

  function head(): Pos {
    if (selection.kind === "text") return selection.head
    if (selection.kind === "all") return currentRange().to
    return { block: selection.block, offset: 0 }
  }

  function anchor(): Pos {
    if (selection.kind === "text") return selection.anchor
    if (selection.kind === "all") return currentRange().from
    return { block: selection.block, offset: 0 }
  }

  const collapsed = () =>
    selection.kind === "text" && samePos(selection.anchor, selection.head)

  function fit() {
    const width = host.clientWidth
    const { widthPx, pitchPx } = placement(layout)
    const gutter = width < NARROW_PX ? 16 : 32
    scale = pageScale(width - 2 * gutter, widthPx)
    const left = Math.max(gutter, (width - widthPx * scale) / 2)
    stage.style.transform = `translate(${left}px, ${gutter}px) scale(${scale})`
    stage.style.width = `${widthPx}px`
    host.style.height = `${(layout.pages.length * pitchPx - PAGE_GAP_PX) * scale + 2 * gutter}px`
    fittedWidth = width
  }

  function placeInput(rect: PageRect) {
    const { pitchPx } = placement(layout)
    port.element.style.transform = `translate(${px(rect.x)}px, ${rect.page * pitchPx + px(rect.y)}px)`
    port.element.style.height = `${px(rect.h)}px`
  }

  function draw() {
    const { pitchPx } = placement(layout)
    const headRect = caret(metrics, layout, head())
    const selected = collapsed()
      ? []
      : rangeRects(metrics, layout, index, currentRange(), true)
    const composed = composition
      ? rangeRects(
          metrics,
          layout,
          index,
          { from: composition.from, to: composition.to },
          false
        )
      : []
    overlays.draw({
      pitchPx,
      caret: collapsed() ? headRect : null,
      selection: selected,
      composition: composed,
      focused,
    })
    placeInput(headRect)
  }

  function revealCaret() {
    if (scrollQueued) return
    scrollQueued = true
    requestAnimationFrame(() => {
      scrollQueued = false
      port.element.scrollIntoView({ block: "nearest", inline: "nearest" })
    })
  }

  function adopt(next: EditorState) {
    state = next
    const read = engine.read(state)
    const docChanged = read.doc !== doc
    doc = read.doc
    selection = read.selection
    if (docChanged) {
      index = indexDoc(doc)
      const pages = layout.pages.length
      layout = layouter.layout(doc, layout)
      painter.paint(layout, doc)
      if (layout.pages.length !== pages) fit()
    }
    draw()
  }

  function run(commands: DocCommand[], input?: InputEdit): boolean {
    const result = engine.run(state, commands, origin, input)
    if ("refusal" in result) return false
    adopt(result.state)
    return true
  }

  function selectCommand(command: SelectionCommand) {
    adopt(engine.select(state, command))
  }

  function select(from: Pos, to: Pos) {
    selectCommand({
      op: "select",
      selection: { kind: "text", anchor: from, head: to },
    })
  }

  function insertLines(range: Range, text: string) {
    const lines = text.split(/\r\n|\r|\n/)
    const first = lines[0]!
    if (first) run([{ op: "insertText", range, text: first }])
    else if (!samePos(range.from, range.to)) run([{ op: "deleteRange", range }])
    for (const line of lines.slice(1)) {
      run([{ op: "splitBlock", at: head() }])
      if (line) {
        const here = head()
        run([{ op: "insertText", range: { from: here, to: here }, text: line }])
      }
    }
  }

  function deleteSelection() {
    run([{ op: "deleteRange", range: currentRange() }])
  }

  function blockOf(id: BlockId) {
    return doc.content.find((block) => block.attrs.id === id)
  }

  function listBlocks(range: Range) {
    return textBlocksIn(doc, index, range).filter((id) => {
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
    const found = containerAt(index, here)
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
    if ((index.order.get(here.block) ?? 0) > 0)
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
    const found = containerAt(index, here)
    if (!found) return
    if (here.offset < found.container.text.length) {
      const units = codeUnitsAfter(found.container.text, here.offset)
      run([
        { op: "deleteRange", range: { from: here, to: shift(here, units) } },
      ])
      return
    }
    if (here.cell) return
    if ((index.order.get(here.block) ?? 0) < doc.content.length - 1)
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
    const rect = caret(metrics, layout, from)
    if (goalX === null) goalX = rect.x
    const goal = goalX
    const page = layout.pages[rect.page]!
    const tryPoint = (point: PagePoint) => {
      const pos = locate(metrics, layout, point)
      const moved = caret(metrics, layout, pos)
      return moved.page === rect.page && moved.y === rect.y ? null : pos
    }
    let target =
      dir > 0
        ? tryPoint({ page: rect.page, x: goal, y: rect.y + rect.h + 1 })
        : rect.y - 1 >= page.content.y
          ? tryPoint({ page: rect.page, x: goal, y: rect.y - 1 })
          : null
    const nextPage = layout.pages[rect.page + dir]
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
    const edges = lineEdges(layout, head())
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
      case "undo": {
        const undone = engine.undo(state)
        if (undone) adopt(undone.state)
        return
      }
      case "redo": {
        const redone = engine.redo(state)
        if (redone) adopt(redone.state)
        return
      }
      case "mark":
        run([
          {
            op: "setMark",
            range,
            mark: { type: action.mark },
            on: !allMarked(doc, index, range, action.mark),
          },
        ])
        return
      case "link": {
        if (collapsed()) selectCommand({ op: "selectWord" })
        const target = currentRange()
        if (samePos(target.from, target.to)) return
        const href = (options.askLink ?? defaultAskLink)("")
        if (href === null) return
        const parsed = docCommandSchema.safeParse({
          op: "setLink",
          range: target,
          href: href.trim() || null,
        })
        if (parsed.success) run([parsed.data])
        return
      }
      case "clearFormatting":
        run([{ op: "clearFormatting", range }])
        return
      case "kind": {
        const blocks = textBlocksIn(doc, index, range)
        if (blocks.length)
          run([{ op: "setBlockKind", blocks, kind: action.kind }])
        return
      }
      case "list": {
        const blocks = textBlocksIn(doc, index, range)
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
        const blocks = textBlocksIn(doc, index, range)
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

  const sink: InputSink = {
    mirror(): Mirror {
      const range = currentRange()
      if (selection.kind !== "text" || !sameContainer(range.from, range.to)) {
        base = { whole: range }
        const value = textBetween(index, range).slice(0, STAND_IN_LIMIT) || " "
        return { value, start: 0, end: value.length, backward: false }
      }
      const found = containerAt(index, range.from)
      const text = found?.container.text ?? ""
      const start = Math.max(0, range.from.offset - MIRROR_WINDOW)
      const end = Math.min(text.length, range.to.offset + MIRROR_WINDOW)
      base = { pos: at(range.from.block, range.from.cell, start) }
      return {
        value: text.slice(start, end),
        start: range.from.offset - start,
        end: range.to.offset - start,
        backward: comparePos(index, selection.anchor, selection.head) > 0,
      }
    },
    replace(edit: TextareaEdit, caretIndex: number, input: InputKind) {
      let range: Range
      let text = edit.text
      if ("whole" in base) {
        range = base.whole
        text = port.element.value
        base = { pos: range.from }
      } else {
        range = {
          from: shift(base.pos, edit.from),
          to: shift(base.pos, edit.to),
        }
      }
      const caretPos = shift(base.pos, caretIndex)
      if (text.includes("\n") || text.includes("\r")) {
        insertLines(range, text)
        return
      }
      const command: DocCommand = text
        ? { op: "insertText", range, text }
        : { op: "deleteRange", range }
      const inputEdit: InputEdit =
        input.kind === "composition"
          ? {
              kind: "composition",
              id: input.id,
              oneShot: input.oneShot,
              caret: caretPos,
            }
          : { kind: "typing", caret: caretPos }
      run([command], inputEdit)
      if (input.kind === "composition") {
        const start =
          composition && comparePos(index, composition.from, range.from) < 0
            ? composition.from
            : range.from
        composition = { from: start, to: shift(range.from, text.length) }
        draw()
      }
      revealCaret()
    },
    action(action) {
      act(action)
      revealCaret()
    },
    pasteText(text) {
      insertLines(currentRange(), text)
      revealCaret()
    },
    copyText: () => textBetween(index, currentRange()),
    cutText() {
      const text = textBetween(index, currentRange())
      if (!collapsed()) deleteSelection()
      return text
    },
    composing(active) {
      if (active) return
      composition = null
      draw()
    },
  }

  const port = createInputPort(sink)
  overlays.layer.append(port.element)

  const onFocus = () => {
    focused = true
    draw()
  }
  const onBlur = () => {
    focused = false
    draw()
  }
  port.element.addEventListener("focus", onFocus)
  port.element.addEventListener("blur", onBlur)

  const detachPointer = attachPointer(host, {
    pointAt(clientX, clientY) {
      const box = stage.getBoundingClientRect()
      const { pitchPx, heightPx } = placement(layout)
      const x = (clientX - box.left) / scale
      const y = (clientY - box.top) / scale
      const page = Math.max(
        0,
        Math.min(layout.pages.length - 1, Math.floor(y / pitchPx))
      )
      const inPage = Math.max(0, Math.min(heightPx - 1, y - page * pitchPx))
      return { page, x: x * MPT_PER_PX, y: inPage * MPT_PER_PX }
    },
    press(point, clicks, extend) {
      goalX = null
      const pos = locate(metrics, layout, point)
      if (clicks === 3) {
        const found = containerAt(index, pos)
        const length = found?.container.text.length ?? 0
        select(at(pos.block, pos.cell, 0), at(pos.block, pos.cell, length))
      } else {
        select(extend ? anchor() : pos, pos)
        if (clicks === 2) selectCommand({ op: "selectWord" })
      }
      dragAnchor = extend ? anchor() : pos
      port.sync()
    },
    drag(point) {
      if (!dragAnchor) return
      select(dragAnchor, locate(metrics, layout, point))
      port.sync()
    },
    focus() {
      port.element.focus({ preventScroll: true })
    },
  })

  const resize = new ResizeObserver(() => {
    if (host.clientWidth !== fittedWidth) fit()
  })
  resize.observe(host)

  painter.paint(layout, doc)
  fit()
  draw()
  port.sync()

  return {
    read: () => ({ doc, selection }),
    layout: () => layout,
    scale: () => scale,
    focus: () => port.element.focus({ preventScroll: true }),
    destroy() {
      resize.disconnect()
      detachPointer()
      port.element.removeEventListener("focus", onFocus)
      port.element.removeEventListener("blur", onBlur)
      port.destroy()
      stage.remove()
      host.classList.remove("paper-editor")
    },
  }
}

function defaultAskLink(current: string): string | null {
  return window.prompt("Link", current)
}
