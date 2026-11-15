import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  privateLayoutSchema,
  type LayoutTable,
} from "./paper-doc/native-layout.js"
import {
  prepareLayoutEdit,
  reverseLayoutEdit,
} from "./paper-doc/native-layout-edit.js"
import type { Result } from "./paper-doc/presentation-values.js"

function value<T>(result: Result<T>): T {
  assert.equal(result.kind, "ok")
  if (result.kind !== "ok") throw new Error(result.reason)
  return result.value
}
const paragraph = (id: string, text = "Việt e\u0302 😀") => ({
  id,
  type: "paragraph",
  paragraph: {},
  content: [{ text, bold: false }],
})
const row = (id: string) => ({
  id,
  type: "row",
  children: ["a", "b"].map((columnId) => ({
    id: `${id}-${columnId}`,
    type: "cell",
    columnId,
    children: [paragraph(`${id}-${columnId}-p`)],
  })),
})
const source = () => ({
  profile: "private-layout-1",
  kind: "letter",
  presentation: {
    codecVersion: 1,
    page: {
      width: 11906,
      height: 16838,
      orientation: "portrait",
      top: 1440,
      bottom: 1440,
      start: 1440,
      end: 1440,
    },
    inline: { fontId: "liberation-serif" },
    paragraph: {},
    styles: [],
  },
  flow: {
    id: "flow",
    type: "flow",
    children: [
      paragraph("intro"),
      {
        id: "table",
        type: "table",
        columns: [
          { id: "a", width: 4000 },
          { id: "b", width: 4000 },
        ],
        children: [row("r1"), row("r2")],
      },
      paragraph("after"),
    ],
  },
})
function table(doc: ReturnType<typeof privateLayoutSchema.parse>): LayoutTable {
  const found = doc.flow.children.find((node) => node.type === "table")
  if (!found || found.type !== "table") throw new Error("Missing test table")
  return found
}
describe("private rich layout contract", () => {
  it("admits one canonical flow and preserves rich text, physical widths and stable identities", () => {
    const doc = privateLayoutSchema.parse(source())
    assert.deepEqual(JSON.parse(JSON.stringify(doc)), doc)
    assert.equal(
      table(doc).children[0]?.children[0]?.children[0]?.type,
      "paragraph"
    )
    assert.equal(
      privateLayoutSchema.safeParse({
        ...source(),
        profile: "private-layout-2",
      }).success,
      false
    )
  })
  it("refuses ragged grids, duplicated identities, nested tables, unknown nodes and overwide geometry", () => {
    const patches = [
      { ...source(), unexpected: true },
      { ...source(), flow: { ...source().flow, id: "a" } },
    ]
    for (const input of patches)
      assert.equal(privateLayoutSchema.safeParse(input).success, false)
    for (const mutate of [
      (t: LayoutTable) => t.children[0]?.children.pop(),
      (t: LayoutTable) => {
        const c = t.children[0]?.children[0]
        if (c) c.columnId = t.columns[1]?.id ?? "missing"
      },
      (t: LayoutTable) => {
        const c = t.columns[0]
        if (c) c.width = 10000
      },
      (t: LayoutTable) => {
        const c = t.children[0]?.children[0]
        if (c) c.id = "intro"
      },
    ]) {
      const doc = privateLayoutSchema.parse(source())
      mutate(table(doc))
      assert.equal(privateLayoutSchema.safeParse(doc).success, false)
    }
    const nested = source()
    const t = table(privateLayoutSchema.parse(nested))
    const first = t.children[0]?.children[0]
    assert.ok(first)
    assert.equal(
      privateLayoutSchema.safeParse({
        ...nested,
        flow: {
          ...nested.flow,
          children: [
            {
              ...t,
              children: [
                { ...t.children[0], children: [{ ...first, children: [t] }] },
              ],
            },
          ],
        },
      }).success,
      false
    )
  })
  it("adds and removes rows without changing surviving cell IDs or content", () => {
    const doc = privateLayoutSchema.parse(source())
    const inserted = value(
      prepareLayoutEdit(doc, {
        kind: "insert-row",
        tableId: "table",
        afterId: "r1",
        row: row("new"),
      })
    )
    assert.deepEqual(
      table(inserted.document).children.map((r) => r.id),
      ["r1", "new", "r2"]
    )
    assert.deepEqual(
      value(
        reverseLayoutEdit(
          inserted.document,
          JSON.parse(JSON.stringify(inserted.receipt))
        )
      ),
      doc
    )
    const removed = value(
      prepareLayoutEdit(doc, {
        kind: "remove-row",
        tableId: "table",
        rowId: "r1",
      })
    )
    assert.deepEqual(
      table(removed.document).children,
      table(doc).children.slice(1)
    )
    assert.deepEqual(
      value(reverseLayoutEdit(removed.document, removed.receipt)),
      doc
    )
    assert.equal(
      prepareLayoutEdit(removed.document, {
        kind: "remove-row",
        tableId: "table",
        rowId: "r2",
      }).kind,
      "refused"
    )
  })
  it("adds, removes and resizes columns atomically with exact row coverage", () => {
    const doc = privateLayoutSchema.parse(source())
    const cells = ["r1", "r2"].map((rowId) => ({
      rowId,
      cell: {
        id: `${rowId}-c`,
        type: "cell",
        columnId: "c",
        children: [paragraph(`${rowId}-c-p`)],
      },
    }))
    const change = {
      kind: "insert-column",
      tableId: "table",
      afterId: "b",
      column: { id: "c", width: 480 },
      cells,
    }
    const inserted = value(prepareLayoutEdit(doc, change))
    assert.deepEqual(
      table(inserted.document).columns.map((c) => c.id),
      ["a", "b", "c"]
    )
    assert.deepEqual(
      value(reverseLayoutEdit(inserted.document, inserted.receipt)),
      doc
    )
    assert.equal(
      prepareLayoutEdit(doc, { ...change, cells: cells.slice(0, 1) }).kind,
      "refused"
    )
    assert.equal(
      prepareLayoutEdit(doc, { ...change, cells: [cells[0], cells[0]] }).kind,
      "refused"
    )
    const resized = value(
      prepareLayoutEdit(doc, {
        kind: "resize-column",
        tableId: "table",
        column: { id: "a", width: 3200 },
      })
    )
    assert.deepEqual(
      value(reverseLayoutEdit(resized.document, resized.receipt)),
      doc
    )
    const removed = value(
      prepareLayoutEdit(doc, {
        kind: "remove-column",
        tableId: "table",
        columnId: "a",
      })
    )
    assert.deepEqual(
      value(reverseLayoutEdit(removed.document, removed.receipt)),
      doc
    )
    assert.equal(
      prepareLayoutEdit(removed.document, {
        kind: "remove-column",
        tableId: "table",
        columnId: "b",
      }).kind,
      "refused"
    )
    assert.equal(
      prepareLayoutEdit(doc, {
        kind: "resize-column",
        tableId: "table",
        column: { id: "a", width: 9000 },
      }).kind,
      "refused"
    )
    assert.deepEqual(privateLayoutSchema.parse(source()), doc)
  })
  it("reverses a deleted row after receipt serialization and later typing in another cell", () => {
    const doc = privateLayoutSchema.parse(source())
    const prepared = value(
      prepareLayoutEdit(doc, {
        kind: "remove-row",
        tableId: "table",
        rowId: "r1",
      })
    )
    const current = privateLayoutSchema.parse(prepared.document)
    const p = table(current).children[0]?.children[0]?.children[0]
    assert.ok(p && "content" in p)
    p.content.push({ text: " later", italic: true })
    const restored = value(
      reverseLayoutEdit(current, JSON.parse(JSON.stringify(prepared.receipt)))
    )
    assert.deepEqual(table(restored).children[0], table(doc).children[0])
    assert.deepEqual(table(restored).children[1], table(current).children[0])
  })
  it("refuses Undo when inserted content, a changed width or an affected identity was edited later", () => {
    const inserted = value(
      prepareLayoutEdit(source(), {
        kind: "insert-row",
        tableId: "table",
        afterId: "r1",
        row: row("new"),
      })
    )
    const p = table(inserted.document).children[1]?.children[0]?.children[0]
    assert.ok(p && "content" in p)
    p.content.push({ text: " keep this" })
    assert.equal(
      reverseLayoutEdit(inserted.document, inserted.receipt).kind,
      "refused"
    )
    const resized = value(
      prepareLayoutEdit(source(), {
        kind: "resize-column",
        tableId: "table",
        column: { id: "a", width: 3200 },
      })
    )
    const col = table(resized.document).columns[0]
    assert.ok(col)
    col.width = 3000
    assert.equal(
      reverseLayoutEdit(resized.document, resized.receipt).kind,
      "refused"
    )
    table(resized.document).columns.splice(0, 1)
    table(resized.document).children.forEach((r) => r.children.splice(0, 1))
    assert.equal(
      reverseLayoutEdit(resized.document, resized.receipt).kind,
      "refused"
    )
  })
  it("inserts and removes a table through stable flow neighbors and refuses changed neighbors on Undo", () => {
    const doc = privateLayoutSchema.parse(source())
    const removed = value(
      prepareLayoutEdit(doc, { kind: "remove-table", tableId: "table" })
    )
    assert.deepEqual(
      value(reverseLayoutEdit(removed.document, removed.receipt)),
      doc
    )
    const inserted = value(
      prepareLayoutEdit(removed.document, {
        kind: "insert-table",
        afterId: "intro",
        table: table(doc),
      })
    )
    assert.deepEqual(inserted.document, doc)
    assert.deepEqual(
      value(reverseLayoutEdit(inserted.document, inserted.receipt)),
      removed.document
    )
    removed.document.flow.children.reverse()
    assert.equal(
      reverseLayoutEdit(removed.document, removed.receipt).kind,
      "refused"
    )
  })
})
