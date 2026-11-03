import { paperDocumentSchema, type PaperDocument } from "@workspace/domain"
import * as Y from "yjs"
import { describe, expect, it, vi } from "vitest"

import { writeAsEditor } from "./editor-write.js"
import { openPaperClient } from "./client.js"
import { seedYDoc, writeDocument } from "./ydoc.js"

const fallback = vi.hoisted(() => ({
  mode: "merge" as "merge" | "beside" | "throw",
}))

vi.mock("@workspace/domain", async (original) => {
  const domain = await original<typeof import("@workspace/domain")>()
  return {
    ...domain,
    rebasePending: (input: Parameters<typeof domain.rebasePending>[0]) => {
      if (fallback.mode === "throw") throw new Error("rebase refused")
      if (fallback.mode === "beside") {
        return domain.rebasePending(input, () => {
          throw new Error("merge refused")
        })
      }
      return domain.rebasePending(input)
    },
  }
})

const letter = (...blocks: [string, string][]): PaperDocument =>
  paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks: blocks.map(([id, text]) => ({
      id,
      type: "paragraph",
      content: [{ text }],
    })),
    clashes: [],
  })

function words(doc: PaperDocument | null) {
  return (doc?.blocks ?? [])
    .flatMap((block) =>
      "content" in block ? block.content.map((run) => run.text) : []
    )
    .join(" ")
    .split(/\s+/)
    .filter(Boolean)
}

function typedAgainstCoach() {
  const seed = seedYDoc(letter(["p1", "alpha"], ["p2", "beta"]))
  const server = new Y.Doc()
  Y.applyUpdate(server, seed)
  const known = Y.encodeStateVector(server)
  const client = openPaperClient({
    epoch: 1,
    server: seed,
    pending: Y.encodeStateAsUpdate(new Y.Doc()),
    revision: 1,
  })
  writeAsEditor(
    client.ydoc,
    letter(["p1", "alpha MINE"], ["p2", "beta"]),
    "person"
  )
  writeDocument(server, letter(["p1", "alpha"], ["p2", "beta COACH"]), "coach")
  return { client, server, known }
}

describe("a pending rebase whose merge falls back", () => {
  it("reports failed on a stale reply and keeps both sides' words", () => {
    fallback.mode = "beside"
    const { client, server, known } = typedAgainstCoach()
    const sent = client.prepare()
    const receipt = client.receive(sent, {
      epoch: 1,
      revision: 2,
      reset: false,
      stale: true,
      update: Y.encodeStateAsUpdate(server, known),
      stateVector: Y.encodeStateVector(server),
    })
    expect(receipt).toMatchObject({ rebased: true, failed: true })
    expect(words(client.document())).toEqual(
      expect.arrayContaining(["MINE", "COACH"])
    )
  })

  it("reports failed on a reset reply and keeps both sides' words", () => {
    fallback.mode = "beside"
    const { client } = typedAgainstCoach()
    const sent = client.prepare()
    const fresh = seedYDoc(letter(["p1", "alpha"], ["p2", "beta RESET"]))
    const reseeded = new Y.Doc()
    Y.applyUpdate(reseeded, fresh)
    const receipt = client.receive(sent, {
      epoch: 2,
      revision: 3,
      reset: true,
      stale: false,
      update: fresh,
      stateVector: Y.encodeStateVector(reseeded),
    })
    expect(receipt).toMatchObject({ reset: true, failed: true })
    expect(words(client.document())).toEqual(
      expect.arrayContaining(["MINE", "RESET"])
    )
  })

  it("reports failed and keeps both sides by the Yjs merge when the rebase throws", () => {
    fallback.mode = "throw"
    const { client, server, known } = typedAgainstCoach()
    const sent = client.prepare()
    const receipt = client.receive(sent, {
      epoch: 1,
      revision: 2,
      reset: false,
      stale: true,
      update: Y.encodeStateAsUpdate(server, known),
      stateVector: Y.encodeStateVector(server),
    })
    expect(receipt.failed).toBe(true)
    expect(words(client.document())).toEqual(
      expect.arrayContaining(["MINE", "COACH"])
    )
  })

  it("does not report failed when the merge succeeds", () => {
    fallback.mode = "merge"
    const { client, server, known } = typedAgainstCoach()
    const sent = client.prepare()
    const receipt = client.receive(sent, {
      epoch: 1,
      revision: 2,
      reset: false,
      stale: true,
      update: Y.encodeStateAsUpdate(server, known),
      stateVector: Y.encodeStateVector(server),
    })
    expect(receipt).toMatchObject({ rebased: true, failed: false })
  })
})
