import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  privateLayoutSchema,
  type LayoutTable,
} from "./paper-doc/native-layout.js"

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
})
