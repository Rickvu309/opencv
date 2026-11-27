import "./paper-editor.css"

import {
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
  at,
  codeUnitsAfter,
  codeUnitsBefore,
  comparePos,
  containerAt,
  indexDoc,
  ordered,
  sameContainer,
  samePos,
  shift,
  textBetween,
  textBlocksIn,
  type DocIndex,
} from "./doc-positions.ts"
import {
  attachPointer,
  createInputPort,
  type KeyAction,
  type InputKind,
  type InputSink,
  type Mirror,
  type TextareaEdit,
} from "./input-port.ts"
import { copySelection, plainFragment } from "./clipboard.ts"
import { createEditorTools } from "./editor-tools.ts"
import { pasteHtml } from "./paste-html.ts"
import { createOverlays, rangeRects, type PageRect } from "./overlays.ts"
import { createSuggestionLayer } from "./suggestions/suggestion-layer.ts"
import { verticalTarget } from "./vertical-move.ts"
import { randomId } from "./random-id.ts"
import { coachOrigin } from "./suggestions/suggestion-view.ts"
import {
  createPainter,
  MPT_PER_PX,
  PAGE_GAP_PX,
  pageScale,
  placement,
  px,
} from "./painter.ts"

export type PaperEditorOptions = {
  doc: Document
  metrics?: Metrics
}

export type PaperEditor = {
  read(): { doc: Document; selection: Selection }
  layout(): Layout
  scale(): number
  focus(): void
  suggest: ReturnType<typeof createSuggestionLayer>["set"]
  destroy(): void
}

const MIRROR_WINDOW = 2000
const STAND_IN_LIMIT = 1000
const NARROW_PX = 600

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
  let stageLeft = 0
  let stageTop = 0

  host.classList.add("paper-editor")
  const stage = document.createElement("div")
  stage.className = "paper-editor-stage"
  const overlays = createOverlays()
  stage.append(overlays.layer)
  host.append(stage)
  const painter = createPainter(stage, metrics)
  const suggestions = createSuggestionLayer(host, overlays.layer, engine, {
    land(commands, ids) {
      focusEditor()
      return run(commands, undefined, coachOrigin(client, ids))
    },
    undo: () => act({ do: "undo" }),
    changed() {
      relayout()
      fit()
      draw()
    },
  })

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
    stageLeft = Math.max(gutter, (width - widthPx * scale) / 2)
    stageTop = gutter + suggestions.stripHeight()
    stage.style.transform = `translate(${stageLeft}px, ${stageTop}px) scale(${scale})`
    stage.style.width = `${widthPx}px`
    host.style.height = `${(layout.pages.length * pitchPx - PAGE_GAP_PX) * scale + 2 * gutter + suggestions.stripHeight()}px`
    fittedWidth = width
  }

  function placeInput(rect: PageRect) {
    const { pitchPx } = placement(layout)
    port.element.style.transform = `translate(${px(rect.x)}px, ${rect.page * pitchPx + px(rect.y)}px)`
    port.element.style.height = `${px(rect.h)}px`
  }

  function screenPoint(rect: PageRect) {
    return {
      x: stageLeft + px(rect.x) * scale,
      y:
        stageTop + (rect.page * placement(layout).pitchPx + px(rect.y)) * scale,
    }
  }

  function focusEditor() {
    port.sync()
    port.element.focus({ preventScroll: true })
  }

  const tools = createEditorTools(host, overlays.layer, metrics, {
    head,
    blockOf,
    run,
    select,
    draw,
    sync: () => port.sync(),
    focusEditor,
    screenPoint,
  })

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
      ...tools.highlights(layout, index),
      focused,
    })
    placeInput(headRect)
    suggestions.draw(layout, pitchPx, scale)
    tools.update(doc, selection, layout, head(), headRect, collapsed(), scale)
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
      relayout()
    }
    draw()
  }

  function relayout() {
    const pages = layout.pages.length
    const shown = suggestions.display(doc, scale)
    layout = layouter.layout(shown, layout)
    painter.paint(layout, shown)
    if (layout.pages.length !== pages) fit()
  }

  function locateReal(point: PagePoint): Pos {
    const pos = locate(metrics, layout, point)
    const owner = suggestions.owner(pos.block)
    return owner ? { block: owner, offset: 0 } : pos
  }

  function run(commands: DocCommand[], input?: InputEdit, by = origin) {
    const result = engine.run(state, commands, by, input)
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
    const goal = goalX ?? caret(metrics, layout, head()).x
    const target = verticalTarget(
      metrics,
      layout,
      head(),
      goal,
      dir,
      locateReal
    )
    if (!target) selectCommand({ op: "move", unit: "doc", dir, extend })
    else select(extend ? anchor() : target, target)
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
      case "find":
        return tools.openFind(action.replace)
      case "link":
        return tools.openLink(doc, head(), collapsed(), () => {
          if (collapsed()) selectCommand({ op: "selectWord" })
          return currentRange()
        })
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
      if (action.do !== "find" && action.do !== "link") revealCaret()
    },
    paste({ text, html }) {
      const range = currentRange()
      const fragment = html ? pasteHtml(html, layout.pages[0]!.content.w) : []
      if (fragment.length && run([{ op: "pasteFragment", range, fragment }])) {
        revealCaret()
      } else if (text) {
        run([
          {
            op: "pasteFragment",
            range,
            fragment: plainFragment(
              text,
              !!range.from.cell,
              () => randomId() as BlockId
            ),
          },
        ])
        revealCaret()
      }
    },
    copy(cut) {
      if (collapsed()) return null
      const clipboard = copySelection(doc, index, selection, currentRange())
      if (cut) {
        if (selection.kind === "all")
          run(
            doc.content.map((block) => ({
              op: "deleteBlock",
              block: block.attrs.id,
            }))
          )
        else if (selection.kind === "block")
          run([{ op: "deleteBlock", block: selection.block }])
        else deleteSelection()
      }
      return clipboard
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

  const detachPointer = attachPointer(stage, {
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
      tools.dismissLink()
      const image = layout.pages[point.page]?.boxes.find(
        ({ kind, rect }) =>
          kind === "image" &&
          point.x >= rect.x &&
          point.x <= rect.x + rect.w &&
          point.y >= rect.y &&
          point.y <= rect.y + rect.h
      )
      if (image && !extend) {
        dragAnchor = null
        selectCommand({
          op: "select",
          selection: { kind: "block", block: image.block },
        })
        port.sync()
        return
      }
      const pos = locateReal(point)
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
      select(dragAnchor, locateReal(point))
      port.sync()
    },
    focus() {
      port.element.focus({ preventScroll: true })
    },
  })

  const resize = new ResizeObserver(() => {
    if (host.clientWidth !== fittedWidth) {
      fit()
      relayout()
      draw()
    }
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
    focus: focusEditor,
    suggest: suggestions.set,
    destroy() {
      suggestions.destroy()
      resize.disconnect()
      detachPointer()
      port.element.removeEventListener("focus", onFocus)
      port.element.removeEventListener("blur", onBlur)
      port.destroy()
      stage.remove()
      tools.destroy()
      host.classList.remove("paper-editor")
    },
  }
}
