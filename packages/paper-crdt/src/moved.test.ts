import { paperDocumentSchema, type PaperDocument } from "@workspace/domain"
import * as Y from "yjs"
import { describe, expect, it } from "vitest"

import { loadYDoc, seedYDoc, writeDocument } from "./index.js"
import { FRAGMENT } from "./names.js"
import { groupOf } from "./reconcile.js"

function cv(ids: string[]): PaperDocument {
  return paperDocumentSchema.parse({
    version: 3,
    kind: "cv",
    clashes: [],
    header: {
      id: "header",
      type: "header",
      name: "Ada",
      email: "",
      phone: "",
      city: "",
      linkedin: "",
    },
    blocks: [
      { id: "s1", type: "section", kind: "summary", title: "Profile" },
      ...ids.map((id) => ({
        id,
        type: "paragraph",
        content: [{ text: `Text of ${id}` }],
      })),
    ],
  })
}

function containers(yDoc: Y.Doc) {
  const group = groupOf(yDoc.getXmlFragment(FRAGMENT))!
  return new Map(
    group
      .toArray()
      .map((child) => [
        (child as Y.XmlElement).getAttribute("id") as string,
        (child as Y.XmlElement)._item!.id.clock,
      ])
  )
}

describe("writeDocument with moved ids", () => {
  it("keeps the neighbours' containers and rebuilds only the moved block", () => {
    const yDoc = loadYDoc(seedYDoc(cv(["p1", "p2", "p3"])), [])
    const before = containers(yDoc)
    writeDocument(yDoc, cv(["p2", "p1", "p3"]), "coach", new Set(["p1"]))
    const after = containers(yDoc)
    expect([...after.keys()]).toEqual(["header", "s1", "p2", "p1", "p3"])
    expect(after.get("p2")).toBe(before.get("p2"))
    expect(after.get("p3")).toBe(before.get("p3"))
    expect(after.get("p1")).not.toBe(before.get("p1"))
  })

  it("rebuilds the other block when the move is named the other way round", () => {
    const yDoc = loadYDoc(seedYDoc(cv(["p1", "p2", "p3"])), [])
    const before = containers(yDoc)
    writeDocument(yDoc, cv(["p2", "p1", "p3"]), "coach", new Set(["p2"]))
    const after = containers(yDoc)
    expect(after.get("p1")).toBe(before.get("p1"))
    expect(after.get("p2")).not.toBe(before.get("p2"))
  })
})
