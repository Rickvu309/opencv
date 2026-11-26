import { afterEach, describe, expect, it } from "vitest"
import * as Y from "yjs"
import {
  canonicalPaper,
  richPaperDocumentSchema,
  nativeProvenance,
} from "@workspace/domain/paper-doc"
import { openRichPaperClient } from "./client.js"
import { materializeStored, seedStoredYDoc } from "./stored-document.js"
import { storedFlowFixture } from "./test/flow-fixture.js"

const documents = new Set<Y.Doc>()
afterEach(() => {
  for (const doc of documents) doc.destroy()
  documents.clear()
})
function server(kind: "cv" | "letter") {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, seedStoredYDoc(storedFlowFixture(kind)))
  documents.add(doc)
  return doc
}
function reply(doc: Y.Doc, revision = 0, reset = false, stale = false) {
  return {
    provenance: nativeProvenance(storedFlowFixture()),
    epoch: 1,
    revision,
    reset,
    stale,
    update: Y.encodeStateAsUpdate(doc),
    stateVector: Y.encodeStateVector(doc),
  }
}
function prime(doc: Y.Doc) {
  const client = openRichPaperClient(null, {
    provenance: reply(doc).provenance,
  })
  expect(client.receive(client.prepare(), reply(doc)).failed).toBe(false)
  documents.add(client.ydoc)
  return client
}
function type(doc: Y.Doc, value = " added 😀") {
  const visit = (node: Y.XmlFragment): boolean => {
    for (const child of node.toArray()) {
      if (child instanceof Y.XmlText && child.length) {
        child.insert(child.length, value)
        return true
      }
      if (child instanceof Y.XmlElement && visit(child)) return true
    }
    return false
  }
  const kind = doc.getMap("paper").get("kind")
  if (
    !visit(
      doc.getXmlFragment(
        kind === "cv" ? "private-native-cv-v4-r2" : "document-store"
      )
    )
  )
    throw new Error("Missing editable text")
}

describe("rich local recovery keeps the canonical editor update", () => {
  it.each(["cv", "letter"] as const)(
    "reopens pending %s content and settles the exact server acknowledgement",
    (kind) => {
      const remote = server(kind),
        client = prime(remote)
      expect(client.document()).toEqual(storedFlowFixture(kind))
      type(client.ydoc)
      const expected = client.document()
      expect(expected).not.toEqual(storedFlowFixture(kind))
      const stored = client.stored()
      const recovered = openRichPaperClient(stored, {
        provenance: stored.provenance!,
      })
      documents.add(recovered.ydoc)
      expect(recovered.document()).toEqual(expected)
      expect(recovered.hasPending()).toBe(true)
      const sent = recovered.prepare()
      Y.applyUpdate(remote, sent.update)
      expect(recovered.receive(sent, reply(remote, 1))).toEqual({
        reset: false,
        stale: false,
        rebased: false,
        failed: false,
      })
      expect(recovered.hasPending()).toBe(false)
      expect(recovered.document()).toEqual(expected)
      expect(recovered.rebuilds).toBe(0)
    }
  )

  it("keeps new typing pending when an earlier save is acknowledged", () => {
    const remote = server("letter"),
      client = prime(remote)
    type(client.ydoc)
    const sent = client.prepare()
    type(client.ydoc)
    const expected = client.document()
    Y.applyUpdate(remote, sent.update)
    expect(client.receive(sent, reply(remote, 1)).failed).toBe(false)
    expect(client.document()).toEqual(expected)
    expect(client.hasPending()).toBe(true)
  })

  it("pulls valid remote changes with no pending work", () => {
    const remote = server("letter"),
      client = prime(remote)
    const sent = client.prepare()
    type(remote)
    expect(client.receive(sent, reply(remote, 1)).failed).toBe(false)
    expect(client.hasPending()).toBe(false)
    expect(client.document()).not.toEqual(storedFlowFixture())
  })

  it.each(["cv", "letter"] as const)(
    "converges simultaneous %s edits, including typing during a stale reply, to canonical server content",
    (kind) => {
      const remote = server(kind)
      const first = prime(remote)
      const second = prime(remote)
      type(first.ydoc, " first-tab Việt 😀")
      type(second.ydoc, " second-tab 東京")
      const sent = second.prepare()
      type(second.ydoc, " during-save")
      const firstSent = first.prepare()
      Y.applyUpdate(remote, firstSent.update)
      expect(first.receive(firstSent, reply(remote, 1)).failed).toBe(false)
      expect(second.receive(sent, reply(remote, 1, false, true))).toEqual({
        reset: false,
        stale: true,
        rebased: false,
        failed: false,
      })
      expect(second.hasPending()).toBe(true)
      const retry = second.prepare()
      Y.applyUpdate(remote, retry.update)
      expect(second.receive(retry, reply(remote, 2)).failed).toBe(false)
      expect(first.receive(first.prepare(), reply(remote, 2)).failed).toBe(
        false
      )
      const result = materializeStored(remote)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error(result.reason)
      expect(richPaperDocumentSchema.safeParse(result.document).success).toBe(
        true
      )
      const canonical = canonicalPaper(result.document)
      for (const token of [
        "first-tab Việt 😀",
        "second-tab 東京",
        "during-save",
      ])
        expect(canonical).toContain(token)
      for (const client of [first, second]) {
        expect(canonicalPaper(client.document())).toBe(canonical)
        expect(client.hasPending()).toBe(false)
        expect(client.rebuilds).toBe(0)
      }
      const reopened = prime(remote)
      expect(canonicalPaper(reopened.document())).toBe(canonical)
    }
  )

  it.each(["reset", "malformed"])(
    "refuses %s recovery without acknowledgement or loss of pending bytes",
    (mistake) => {
      const remote = server("letter"),
        client = prime(remote)
      type(client.ydoc)
      const before = client.stored(),
        bytes = client.state(),
        sent = client.prepare({ pullOnly: true })
      if (mistake === "malformed")
        remote.getMap("paper").set("richText", "shadow copy")
      const result = client.receive(sent, reply(remote, 1, mistake === "reset"))
      expect(result.failed).toBe(true)
      expect(client.stored()).toEqual(before)
      expect(client.state()).toEqual(bytes)
      expect(client.hasPending()).toBe(true)
    }
  )
})
