import { afterEach, describe, expect, it } from "vitest"
import * as Y from "yjs"
import {
  canonical,
  privateLayoutSchema,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import {
  createPrivateLayout,
  readLayout,
  openLayoutBinary,
  commitLayoutEdit,
  undoLayoutEdit,
  readLayoutReceipt,
  type LayoutBinding,
} from "./native-layout.js"
import {
  layoutFixture,
  layoutParagraph,
  layoutRow,
} from "./test/layout-fixture.js"

const bindings = new Set<LayoutBinding>()
afterEach(() => {
  for (const binding of bindings) {
    binding.engine._tiptapEditor.destroy()
    binding.doc.destroy()
  }
  bindings.clear()
})
function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}
function source() {
  const binding = value(createPrivateLayout(layoutFixture()))
  bindings.add(binding)
  return binding
}
function reopen(binding: LayoutBinding) {
  const fresh = openLayoutBinary(
    Y.encodeStateAsUpdate(binding.doc),
    binding.kind
  )
  bindings.add(fresh)
  return fresh
}
function element(parent: Y.XmlFragment, id: string): Y.XmlElement {
  for (const child of parent.toArray()) {
    if (!(child instanceof Y.XmlElement)) continue
    if (child.getAttribute("id") === id) return child
    try {
      return element(child, id)
    } catch {
      continue
    }
  }
  throw new Error(`Missing ${id}`)
}
function text(binding: LayoutBinding, id: string): Y.XmlText {
  const node = element(binding.fragment, id).get(0)
  if (!(node instanceof Y.XmlElement)) throw new Error("Missing body")
  const first = node.get(0)
  if (!(first instanceof Y.XmlText)) throw new Error("Missing text")
  return first
}
function unchanged(binding: LayoutBinding, work: () => unknown) {
  const bytes = Y.encodeStateAsUpdate(binding.doc),
    vector = Y.encodeStateVector(binding.doc)
  let updates = 0
  const count = () => updates++
  binding.doc.on("update", count)
  try {
    work()
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
    expect(Y.encodeStateVector(binding.doc)).toEqual(vector)
    expect(updates).toBe(0)
  } finally {
    binding.doc.off("update", count)
  }
}
function edit(binding: LayoutBinding, id: string, change: unknown) {
  return value(
    commitLayoutEdit(binding, id, change, canonical(readLayout(binding)))
  )
}
describe("private rich tables on the canonical editor fragment", () => {
  it("roundtrips explicit false marks, fonts, alignment, Unicode and stable identities through binary", () => {
    const binding = source()
    expect(readLayout(binding)).toEqual(layoutFixture())
    expect(readLayout(reopen(binding))).toEqual(layoutFixture())
    expect(binding.doc.share.has("layout-json")).toBe(false)
    expect(() =>
      openLayoutBinary(Y.encodeStateAsUpdate(binding.doc), "cv")
    ).toThrow()
  })
  it("admits rich headings and nested lists in a cell without flattening or losing styles", () => {
    const input = layoutFixture(),
      table = input.flow.children[1]
    if (!table || table.type !== "table") throw new Error("Missing table")
    const cell = table.children[0]?.children[0]
    if (!cell) throw new Error("Missing cell")
    const extra = [
      {
        id: "heading",
        type: "heading",
        level: 2,
        paragraph: {},
        content: [{ text: "Heading", underline: true }],
      },
      {
        id: "list",
        type: "bullet",
        paragraph: {},
        content: [{ text: "Top" }],
        children: [
          {
            id: "nested",
            type: "numbered",
            paragraph: {},
            content: [{ text: "Nested", href: "https://example.com" }],
            children: [],
          },
        ],
      },
    ]
    const rows = table.children.map((row, index) =>
      index
        ? row
        : {
            ...row,
            children: row.children.map((entry, column) =>
              column
                ? entry
                : { ...entry, children: [...entry.children, ...extra] }
            ),
          }
    )
    const extended = privateLayoutSchema.parse({
      ...input,
      flow: {
        ...input.flow,
        children: input.flow.children.map((node) =>
          node.id === table.id ? { ...table, children: rows } : node
        ),
      },
    })
    const binding = value(createPrivateLayout(extended))
    bindings.add(binding)
    expect(readLayout(reopen(binding))).toEqual(extended)
  })
  it("reads without touching live Y text or changing its relative positions", () => {
    const binding = source(),
      node = text(binding, "r1-a-p")
    const anchor = Y.createRelativePositionFromTypeIndex(node, 3)
    unchanged(binding, () => {
      readLayout(binding)
      readLayout(binding)
    })
    const resolved = Y.createAbsolutePositionFromRelativePosition(
      anchor,
      binding.doc
    )
    expect(resolved?.type).toBe(node)
    expect(resolved?.index).toBe(3)
  })
  it("commits one atomic update with a durable receipt and replays without writing", () => {
    const binding = source(),
      change = {
        kind: "insert-row",
        tableId: "table",
        afterId: "r1",
        row: layoutRow("new"),
      }
    const basis = canonical(readLayout(binding))
    let updates = 0
    binding.doc.on("update", () => updates++)
    const receipt = value(commitLayoutEdit(binding, "insert", change, basis))
    expect(updates).toBe(1)
    const fresh = reopen(binding)
    expect(readLayoutReceipt(fresh, "insert")).toEqual(receipt)
    unchanged(fresh, () =>
      expect(commitLayoutEdit(fresh, "insert", change, basis)).toEqual({
        kind: "ok",
        value: receipt,
      })
    )
    unchanged(fresh, () =>
      expect(
        commitLayoutEdit(fresh, "insert", { ...change, afterId: null }, basis)
          .kind
      ).toBe("refused")
    )
  })
  it("keeps surviving text objects and anchors through structural commands", () => {
    const binding = source(),
      node = text(binding, "r2-b-p")
    const anchor = Y.createRelativePositionFromTypeIndex(node, 4)
    edit(binding, "remove", {
      kind: "remove-row",
      tableId: "table",
      rowId: "r1",
    })
    expect(text(binding, "r2-b-p")).toBe(node)
    expect(
      Y.createAbsolutePositionFromRelativePosition(anchor, binding.doc)?.index
    ).toBe(4)
  })
  it("restores a removed row after binary reopen while preserving later typing in another cell", () => {
    const binding = source()
    edit(binding, "remove", {
      kind: "remove-row",
      tableId: "table",
      rowId: "r1",
    })
    const fresh = reopen(binding),
      node = text(fresh, "r2-a-p")
    node.insert(node.length, " later")
    expect(
      undoLayoutEdit(fresh, "remove", canonical(readLayout(fresh))).kind
    ).toBe("ok")
    const final = readLayout(reopen(fresh)),
      table = final.flow.children[1]
    expect(table?.type).toBe("table")
    if (!table || table.type !== "table") throw new Error("Missing table")
    expect(table.children.map((row) => row.id)).toEqual(["r1", "r2"])
    expect(text(fresh, "r2-a-p").toString()).toContain(" later")
    unchanged(fresh, () =>
      expect(undoLayoutEdit(fresh, "remove", canonical(final)).kind).toBe("ok")
    )
  })
  it("refuses Undo that would erase typing in a row inserted by this action", () => {
    const binding = source()
    edit(binding, "insert", {
      kind: "insert-row",
      tableId: "table",
      afterId: "r1",
      row: layoutRow("new"),
    })
    const fresh = reopen(binding),
      node = text(fresh, "new-a-p")
    node.insert(node.length, " keep")
    unchanged(fresh, () =>
      expect(
        undoLayoutEdit(fresh, "insert", canonical(readLayout(fresh))).kind
      ).toBe("refused")
    )
    expect(text(fresh, "new-a-p").toString()).toContain(" keep")
  })
  it.each(["insert-column", "remove-column", "resize-column"] as const)(
    "recovers %s and its selective Undo after reopening",
    (kind) => {
      const binding = source(),
        original = readLayout(binding)
      const change =
        kind === "insert-column"
          ? {
              kind,
              tableId: "table",
              afterId: "a",
              column: { id: "c", width: 480 },
              cells: ["r1", "r2"].map((rowId) => ({
                rowId,
                cell: {
                  id: `${rowId}-c`,
                  type: "cell",
                  columnId: "c",
                  children: [layoutParagraph(`${rowId}-c-p`)],
                },
              })),
            }
          : kind === "remove-column"
            ? { kind, tableId: "table", columnId: "b" }
            : { kind, tableId: "table", column: { id: "b", width: 4000 } }
      edit(binding, kind, change)
      const fresh = reopen(binding),
        survivor = text(fresh, "r2-a-p")
      survivor.insert(survivor.length, " retained")
      expect(
        undoLayoutEdit(fresh, kind, canonical(readLayout(fresh))).kind
      ).toBe("ok")
      expect(text(fresh, "r2-a-p")).toBe(survivor)
      const restored = readLayout(reopen(fresh)),
        expected = privateLayoutSchema.parse(original)
      const table = expected.flow.children.find((node) => node.type === "table")
      const paragraph =
        table?.type === "table"
          ? table.children[1]?.children[0]?.children[0]
          : undefined
      if (!paragraph || !("content" in paragraph))
        throw new Error("Missing survivor")
      const run = paragraph.content.at(-1)
      if (!run) throw new Error("Missing survivor text")
      run.text += " retained"
      expect(restored).toEqual(privateLayoutSchema.parse(expected))
    }
  )
  it("refuses stale basis, ragged rows, oversized widths and foreign bindings without writing", () => {
    const binding = source(),
      change = { kind: "remove-row", tableId: "table", rowId: "r1" }
    unchanged(binding, () => {
      expect(commitLayoutEdit(binding, "stale", change, "old").kind).toBe(
        "refused"
      )
      expect(
        commitLayoutEdit(
          binding,
          "bad",
          {
            kind: "insert-row",
            tableId: "table",
            afterId: "r1",
            row: {
              id: "bad",
              type: "row",
              children: [
                {
                  id: "cell",
                  type: "cell",
                  columnId: "a",
                  children: [layoutParagraph("bad-p")],
                },
              ],
            },
          },
          canonical(readLayout(binding))
        ).kind
      ).toBe("refused")
      expect(
        commitLayoutEdit(
          binding,
          "wide",
          {
            kind: "resize-column",
            tableId: "table",
            column: { id: "a", width: 10000 },
          },
          canonical(readLayout(binding))
        ).kind
      ).toBe("refused")
      expect(() => readLayout({ ...binding })).toThrow("Foreign")
      expect(
        undoLayoutEdit(binding, "missing", canonical(readLayout(binding))).kind
      ).toBe("refused")
    })
  })
  it.each([
    "attribute",
    "node",
    "mark",
    "unicode",
    "duplicate",
    "geometry",
    "profile",
  ])(
    "refuses unsupported stored %s before schema conversion can discard it",
    (caseName) => {
      const binding = source()
      switch (caseName) {
        case "attribute":
          element(binding.fragment, "table").setAttribute(
            "unrecognized",
            "keep"
          )
          break
        case "node":
          element(binding.fragment, "r1-a").insert(0, [
            new Y.XmlElement("unknown"),
          ])
          break
        case "mark":
          text(binding, "r1-a-p").format(0, 1, {
            mystery: { stringValue: "on" },
          })
          break
        case "unicode":
          text(binding, "r1-a-p").insert(0, "\uD800")
          break
        case "duplicate":
          element(binding.fragment, "r1-a").setAttribute("id", "r1-b")
          break
        case "geometry":
          element(binding.fragment, "table").setAttribute(
            "columns",
            '[{"id":"a","width":9000},{"id":"b","width":5000}]'
          )
          break
        case "profile":
          binding.doc
            .getMap<unknown>("paper")
            .set("formattingProfile", "private-layout-2")
          break
      }
      unchanged(binding, () => expect(() => readLayout(binding)).toThrow())
      if (caseName === "unicode") {
        const fresh = reopen(binding)
        expect(text(fresh, "r1-a-p").toString()).toContain("\uFFFD")
      } else
        expect(() =>
          openLayoutBinary(Y.encodeStateAsUpdate(binding.doc), binding.kind)
        ).toThrow()
    }
  )
})
