import { afterEach, describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import {
  canonical,
  flowDocumentSchema,
  prepareFlowEdit,
  reverseFlowEdit,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import {
  createPrivateFlow,
  readFlow,
  openFlowBinary,
  commitFlowEdit,
  undoFlowEdit,
  type FlowBinding,
} from "./native-layout-flow.js"
import { openLayoutBinary } from "./native-layout.js"
import { flowFixture } from "./test/flow-fixture.js"
import { flowPaginationSupport } from "./native-layout-flow-view.js"

const bindings = new Set<FlowBinding>()
afterEach(() => {
  for (const binding of bindings) {
    binding.engine._tiptapEditor.destroy()
    binding.doc.destroy()
  }
  bindings.clear()
  vi.unstubAllGlobals()
})
function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}
function source() {
  const binding = value(createPrivateFlow(flowFixture()))
  bindings.add(binding)
  return binding
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
const insert = {
  kind: "insert-page-break",
  sectionId: "section-1",
  beforeId: "after",
  breakId: "page-break",
}
describe("private section flow on the canonical editor fragment", () => {
  it("reports unsupported browsers and unqualified section or blank-page layouts", () => {
    const document = flowFixture()
    vi.stubGlobal("CSS", { supports: () => true })
    const section = document.flow.children[0]
    if (!section) throw new Error("Missing section")
    expect(flowPaginationSupport(document)).toEqual({
      supported: true,
      reason: null,
    })
    section.children = section.children.filter((node) => node.type !== "table")
    expect(flowPaginationSupport(document).supported).toBe(true)
    const continuous = flowDocumentSchema.parse({
      ...document,
      flow: {
        ...document.flow,
        children: [
          section,
          {
            ...section,
            id: "continuous",
            children: [
              {
                id: "later",
                type: "paragraph",
                paragraph: {},
                content: [{ text: "Later section" }],
              },
            ],
          },
        ],
      },
    })
    expect(flowPaginationSupport(continuous).reason).toContain("Continuous")
    const blank = flowDocumentSchema.parse({
      ...document,
      flow: {
        ...document.flow,
        children: [
          {
            ...section,
            children: [
              { id: "leading", type: "pageBreak" },
              ...section.children,
            ],
          },
        ],
      },
    })
    expect(flowPaginationSupport(blank).reason).toContain("blank pages")
  })
  it("roundtrips sections, rich tables and Unicode without stored pages or automatic breaks", () => {
    const binding = source()
    const before = Y.encodeStateAsUpdate(binding.doc)
    expect(readFlow(binding)).toEqual(flowFixture())
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(before)
    const reopened = openFlowBinary(before, "letter")
    bindings.add(reopened)
    expect(readFlow(reopened)).toEqual(flowFixture())
    expect([...binding.doc.share.keys()]).not.toContain("pages")
    expect(() => openLayoutBinary(before, "letter")).toThrow()
    expect(() => openFlowBinary(before, "cv")).toThrow()
  })
  it("commits a hard break and receipt in one update and replays exactly once", () => {
    const binding = source(),
      basis = canonical(readFlow(binding))
    let updates = 0
    binding.doc.on("update", () => updates++)
    const receipt = value(commitFlowEdit(binding, "break-op", insert, basis))
    expect(updates).toBe(1)
    const after = Y.encodeStateAsUpdate(binding.doc)
    expect(value(commitFlowEdit(binding, "break-op", insert, basis))).toEqual(
      receipt
    )
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(after)
    expect(updates).toBe(1)
    expect(
      readFlow(binding).flow.children[0]?.children.map((node) => node.type)
    ).toEqual(["paragraph", "table", "pageBreak", "paragraph"])
    expect(
      commitFlowEdit(
        binding,
        "break-op",
        { ...insert, breakId: "different" },
        basis
      ).kind
    ).toBe("refused")
  })
  it("refuses stale or invalid edits without changing bytes, vector or receipts", () => {
    const binding = source(),
      bytes = Y.encodeStateAsUpdate(binding.doc),
      vector = Y.encodeStateVector(binding.doc)
    expect(commitFlowEdit(binding, "bad", insert, "stale").kind).toBe("refused")
    expect(
      commitFlowEdit(
        binding,
        "bad",
        { ...insert, breakId: "intro" },
        canonical(readFlow(binding))
      ).kind
    ).toBe("refused")
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
    expect(Y.encodeStateVector(binding.doc)).toEqual(vector)
  })
  it("Undo survives reopen and preserves later text and marks", () => {
    const binding = source()
    value(
      commitFlowEdit(binding, "break-op", insert, canonical(readFlow(binding)))
    )
    const body = element(binding.fragment, "intro").get(0)
    if (!(body instanceof Y.XmlElement)) throw new Error("Missing paragraph")
    const text = body.get(0)
    if (!(text instanceof Y.XmlText)) throw new Error("Missing text")
    text.insert(text.length, " later Việt", { bold: { stringValue: "on" } })
    const beforeUndo = readFlow(binding)
    const reopened = openFlowBinary(
      Y.encodeStateAsUpdate(binding.doc),
      "letter"
    )
    bindings.add(reopened)
    const undone = value(
      undoFlowEdit(reopened, "break-op", canonical(readFlow(reopened)))
    )
    expect(
      undone.flow.children[0]?.children.some(
        (node) => node.type === "pageBreak"
      )
    ).toBe(false)
    expect(undone.flow.children[0]?.children[0]).toEqual(
      beforeUndo.flow.children[0]?.children[0]
    )
    const bytes = Y.encodeStateAsUpdate(reopened.doc)
    value(undoFlowEdit(reopened, "break-op", canonical(undone)))
    expect(Y.encodeStateAsUpdate(reopened.doc)).toEqual(bytes)
  })
  it("refuses malformed raw section attributes without silently dropping content", () => {
    const binding = source()
    element(binding.fragment, "section-1").setAttribute(
      "settings",
      '{"columns":{"count":3}}'
    )
    const bytes = Y.encodeStateAsUpdate(binding.doc)
    expect(() => readFlow(binding)).toThrow()
    expect(() => openFlowBinary(bytes, "letter")).toThrow()
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
  })
  it("rejects unknown raw nodes before the editor can discard them", () => {
    const binding = source()
    const alien = new Y.XmlElement("unknownPage")
    element(binding.fragment, "section-1").insert(0, [alien])
    expect(() => readFlow(binding)).toThrow()
  })
  it("keeps content identities and formatting when splitting and merging sections", () => {
    const document = flowFixture(),
      page = document.presentation.page
    const split = value(
      prepareFlowEdit(document, {
        kind: "split-section",
        sectionId: "section-1",
        beforeId: "after",
        newSectionId: "section-2",
        settings: { start: "next-page", page, columns: { count: 2, gap: 360 } },
      })
    )
    expect(split.document.flow.children[1]?.children).toEqual(
      document.flow.children[0]?.children.slice(2)
    )
    expect(value(reverseFlowEdit(split.document, split.receipt))).toEqual(
      document
    )
    const merged = value(
      prepareFlowEdit(split.document, {
        kind: "merge-section",
        sectionId: "section-2",
      })
    )
    expect(merged.document).toEqual(document)
  })
  it("refuses overlapping layout Undo while preserving later work", () => {
    const binding = source()
    value(
      commitFlowEdit(binding, "break-op", insert, canonical(readFlow(binding)))
    )
    value(
      commitFlowEdit(
        binding,
        "break-op-2",
        { ...insert, breakId: "later-break" },
        canonical(readFlow(binding))
      )
    )
    const bytes = Y.encodeStateAsUpdate(binding.doc)
    expect(
      undoFlowEdit(binding, "break-op", canonical(readFlow(binding))).kind
    ).toBe("refused")
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
  })
  it("rejects impossible column widths, duplicate IDs and changed geometry in continuous sections", () => {
    const source = flowFixture(),
      first = source.flow.children[0]
    if (!first) throw new Error("Missing section")
    expect(
      flowDocumentSchema.safeParse({
        ...source,
        flow: {
          ...source.flow,
          children: [{ ...first, columns: { count: 2, gap: 360 } }],
        },
      }).success
    ).toBe(false)
    expect(
      prepareFlowEdit(source, {
        kind: "split-section",
        sectionId: first.id,
        beforeId: "after",
        newSectionId: first.id,
        settings: {
          start: "next-page",
          page: first.page,
          columns: first.columns,
        },
      }).kind
    ).toBe("refused")
    expect(
      prepareFlowEdit(source, {
        kind: "split-section",
        sectionId: first.id,
        beforeId: "after",
        newSectionId: "section-2",
        settings: {
          start: "continuous",
          page: { ...first.page, top: 1500 },
          columns: first.columns,
        },
      }).kind
    ).toBe("refused")
  })
})
