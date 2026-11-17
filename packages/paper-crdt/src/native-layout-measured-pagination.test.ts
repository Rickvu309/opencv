import { Schema } from "@tiptap/pm/model"
import { EditorState } from "@tiptap/pm/state"
import { EditorView, type Decoration } from "@tiptap/pm/view"
import { afterEach, expect, it, vi } from "vitest"
import { scrollOversizedContent } from "./native-layout-scroll.js"
import { measuredTextLines } from "./native-layout-text-lines.js"
import { measuredFlowPagination } from "./native-layout-measured-pagination.js"
import { flowFixture } from "./test/flow-fixture.js"

afterEach(() => {
  vi.restoreAllMocks()
})

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value() {
    return Object.assign([], { item: () => null })
  },
})

Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value() {
    return new DOMRect()
  },
})

function measuredView() {
  const schema = new Schema({
    nodes: {
      doc: { content: "blockContainer+" },
      blockContainer: {
        content: "(paragraph | heading) blockContainer*",
        attrs: { id: { default: "block" } },
        toDOM: () => ["div", 0],
      },
      heading: { content: "text*", toDOM: () => ["h1", 0] },
      paragraph: { content: "text*", toDOM: () => ["p", 0] },
      text: {},
    },
  })
  const child = schema.node(
    "blockContainer",
    { id: "child" },
    schema.node("paragraph", null, schema.text("SmallLarge"))
  )
  const doc = schema.node(
    "doc",
    null,
    schema.node("blockContainer", { id: "owner" }, [
      schema.node("paragraph"),
      child,
    ])
  )
  const host = document.createElement("div")
  document.body.append(host)
  const view = new EditorView(host, { state: EditorState.create({ doc }) })
  return {
    schema,
    child,
    view,
    dispose() {
      view.destroy()
      host.remove()
    },
  }
}

it("groups mixed font fragments on a shared visual line and caches its starts", () => {
  const { child, view, dispose } = measuredView()
  try {
    const dom = view.nodeDOM(3)
    expect(dom).toBeInstanceOf(HTMLElement)
    if (!(dom instanceof HTMLElement)) throw new Error("Missing child")
    dom.innerHTML = "<p><span>Small</span><span>Large</span></p>"
    const rect = (top: number, height: number) =>
      new DOMRect(0, top, 40, height)
    vi.spyOn(Range.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Range) {
        return rect(
          this.startContainer.textContent === "Small" ? 104 : 100,
          this.startContainer.textContent === "Small" ? 12 : 24
        )
      }
    )
    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function (
      this: Range
    ) {
      const rows = [
        rect(
          this.startContainer.textContent === "Small" ? 104 : 100,
          this.startContainer.textContent === "Small" ? 12 : 24
        ),
      ]
      return Object.assign(rows, {
        item: (index: number) => rows[index] ?? null,
      })
    })
    const lines = measuredTextLines(
      view,
      { node: child, pos: 3, dom },
      1,
      flowFixture(),
      new Map()
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      top: 100,
      bottom: 124,
      paragraph: { line: 0, count: 1, widowOrphan: true },
    })
  } finally {
    dispose()
  }
})

it("descends through semantic owners to paginate their editable children", () => {
  const { view, dispose } = measuredView()
  try {
    const seen: number[] = []
    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(() =>
      Object.assign([], { item: () => null })
    )
    const nodeDOM = view.nodeDOM.bind(view)
    vi.spyOn(view, "nodeDOM").mockImplementation((pos) => {
      seen.push(pos)
      return nodeDOM(pos)
    })
    measuredFlowPagination(view, () => false).refresh(flowFixture())
    expect(seen).toContain(3)
    expect(seen).not.toContain(0)
  } finally {
    dispose()
  }
})

it("keeps unchanged downstream breaks without repainting on an inline edit", () => {
  const { view, dispose } = measuredView()
  try {
    const dom = view.nodeDOM(3)
    if (!(dom instanceof HTMLElement)) throw new Error("Missing child")
    vi.spyOn(dom, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 96, 500, 16)
    )
    const paint = vi.fn<(decorations: Decoration[]) => boolean>(() => false)
    const pagination = measuredFlowPagination(view, paint)
    pagination.refresh(flowFixture())
    expect(paint).toHaveBeenCalled()
    paint.mockClear()
    view.updateState(view.state.apply(view.state.tr.insertText("!", 15)))
    pagination.refresh(flowFixture())
    expect(paint).not.toHaveBeenCalled()
  } finally {
    dispose()
  }
})

it("makes an oversized atomic block a labelled keyboard scroll region", () => {
  const { schema, view, dispose } = measuredView()
  try {
    const doc = schema.node(
      "doc",
      null,
      schema.node(
        "blockContainer",
        { id: "atomic" },
        schema.node("heading", null, schema.text("Tall content"))
      )
    )
    view.updateState(EditorState.create({ doc }))
    const dom = view.nodeDOM(0)
    if (!(dom instanceof HTMLElement)) throw new Error("Missing atomic block")
    Object.defineProperty(dom, "scrollHeight", { value: 2000 })
    const paint = vi.fn<(decorations: Decoration[]) => boolean>(() => false)
    measuredFlowPagination(view, paint).refresh(flowFixture())
    const decorations = paint.mock.calls[0]?.[0]
    expect(decorations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: expect.objectContaining({
            attrs: expect.objectContaining({
              tabindex: "0",
              role: "region",
              contenteditable: "false",
              "data-paper-oversized-block": "true",
              "aria-label":
                "Content taller than a page. Scroll to read all content.",
            }),
          }),
        }),
      ])
    )
  } finally {
    dispose()
  }
})

it("scrolls a focused oversized region without moving the text caret", () => {
  const region = document.createElement("div")
  region.dataset.paperOversizedRow = "true"
  region.tabIndex = 0
  Object.defineProperty(region, "clientHeight", { value: 864 })
  Object.defineProperty(region, "scrollHeight", { value: 1663 })
  document.body.append(region)
  region.addEventListener("keydown", scrollOversizedContent)
  region.focus()
  const event = new KeyboardEvent("keydown", {
    key: "PageDown",
    bubbles: true,
    cancelable: true,
  })
  region.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(region.scrollTop).toBe(864)
  expect(document.activeElement).toBe(region)
  const child = document.createElement("span")
  region.append(child)
  child.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  )
  expect(region.scrollTop).toBe(864)
  region.remove()
})
