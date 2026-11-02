import { paperDocumentSchema, type PaperDocument } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import {
  absorbUpdate,
  landedInDeadContent,
  loadYDoc,
  seedYDoc,
  stateVectorOf,
  updateSince,
  writeDocument,
} from "./index.js"

function cv(texts: [string, string][]): PaperDocument {
  return paperDocumentSchema.parse({
    version: 3,
    kind: "cv",
    clashes: [],
    header: {
      id: "header",
      type: "header",
      name: "A",
      email: "",
      phone: "",
      city: "",
      linkedin: "",
    },
    blocks: [
      { id: "s1", type: "section", kind: "summary", title: "P" },
      ...texts.map(([id, text]) => ({
        id,
        type: "paragraph",
        content: [{ text }],
      })),
    ],
  })
}

const base = seedYDoc(
  cv([
    ["p1", "One"],
    ["p2", "Two"],
  ])
)

describe("landedInDeadContent", () => {
  it("is false for typing, backspace and typing in a live block", () => {
    const live = loadYDoc(base, [])
    const client = loadYDoc(base, [])
    const since = stateVectorOf(client)
    writeDocument(
      client,
      cv([
        ["p1", "OneQ"],
        ["p2", "Two"],
      ]),
      "person"
    )
    writeDocument(
      client,
      cv([
        ["p1", "One"],
        ["p2", "Two"],
      ]),
      "person"
    )
    writeDocument(
      client,
      cv([
        ["p1", "One ok"],
        ["p2", "Two"],
      ]),
      "person"
    )
    const update = updateSince(client, since)!
    absorbUpdate(live, update, "person")
    expect(landedInDeadContent(live, update)).toBe(false)
  })

  it("is true for typing into a block the server already rebuilt", () => {
    const live = loadYDoc(base, [])
    const client = loadYDoc(base, [])
    const fork = loadYDoc(base, [])
    const coach = writeDocument(
      fork,
      cv([
        ["p2", "Two"],
        ["p1", "One"],
      ]),
      "coach",
      new Set(["p1"])
    )!
    absorbUpdate(live, coach, "coach")
    const typed = writeDocument(
      client,
      cv([
        ["p1", "One more"],
        ["p2", "Two"],
      ]),
      "person"
    )!
    absorbUpdate(live, typed, "person")
    expect(landedInDeadContent(live, typed)).toBe(true)
  })

  it("is true for a delete in a block the server already rebuilt", () => {
    const live = loadYDoc(base, [])
    const client = loadYDoc(base, [])
    const fork = loadYDoc(base, [])
    const coach = writeDocument(
      fork,
      cv([
        ["p2", "Two"],
        ["p1", "One"],
      ]),
      "coach",
      new Set(["p1"])
    )!
    absorbUpdate(live, coach, "coach")
    const deleted = writeDocument(
      client,
      cv([
        ["p1", "On"],
        ["p2", "Two"],
      ]),
      "person"
    )!
    absorbUpdate(live, deleted, "person")
    expect(landedInDeadContent(live, deleted)).toBe(true)
  })
})
