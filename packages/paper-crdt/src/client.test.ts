import { paperDocumentSchema, type PaperDocument } from "@workspace/domain"
import * as Y from "yjs"
import { describe, expect, it, vi } from "vitest"

import { writeAsEditor } from "./editor-write.js"
import { openPaperClient } from "./client.js"
import { seedYDoc, writeDocument } from "./ydoc.js"

const skipped = vi.hoisted(() => ({ writes: 0 }))

vi.mock("./ydoc.js", async (original) => {
  const module = await original<typeof import("./ydoc.js")>()
  return {
    ...module,
    writeDocument: (...args: Parameters<typeof module.writeDocument>) => {
      if (skipped.writes > 0) {
        skipped.writes -= 1
        return null
      }
      return module.writeDocument(...args)
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

function textOf(doc: PaperDocument | null, id: string) {
  const block = doc?.blocks.find((candidate) => candidate.id === id)
  return block && "content" in block
    ? block.content.map((run) => run.text).join("")
    : null
}

function replica(update: Uint8Array) {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, update)
  return doc
}

describe("the editor document rebuild", () => {
  it("rebuilds from the replica and the target once when the write misses, keeps typing once and announces a reset", () => {
    const seed = seedYDoc(letter(["p1", "alpha"], ["p2", "beta"]))
    const server = new Y.Doc()
    Y.applyUpdate(server, seed)
    const client = openPaperClient({
      epoch: 1,
      server: seed,
      pending: Y.encodeStateAsUpdate(new Y.Doc()),
      revision: 1,
    })
    const changes: string[] = []
    client.subscribe((change) => changes.push(change))
    writeAsEditor(
      client.ydoc,
      letter(["p1", "alpha TYPED"], ["p2", "beta"]),
      "person"
    )
    const sent = client.prepare()
    const known = Y.encodeStateVector(replica(seed))
    writeDocument(server, letter(["p2", "beta COACH"]), "coach")
    skipped.writes = 1
    const receipt = client.receive(sent, {
      epoch: 1,
      revision: 2,
      reset: false,
      stale: true,
      update: Y.encodeStateAsUpdate(server, known),
      stateVector: Y.encodeStateVector(server),
    })
    expect(receipt.rebased).toBe(true)
    expect(client.rebuilds).toBe(1)
    expect(changes).toContain("reset")
    const doc = client.document()
    expect(textOf(doc, "p1")).toBe("alpha TYPED")
    expect(textOf(doc, "p2")).toBe("beta COACH")
    expect(doc?.blocks).toHaveLength(2)
    expect(client.hasPending()).toBe(true)
  })
})
