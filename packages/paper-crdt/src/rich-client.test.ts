import { afterEach, describe, expect, it } from "vitest"
import * as Y from "yjs"
import {
  nativeProvenance,
  NATIVE_WRITER,
  nativePaperDocumentSchema,
  type RichPaperDocument,
} from "@workspace/domain"
import {
  openPaperClient,
  openRichPaperClient,
  type PaperClient,
} from "./client.js"
import { seedStoredYDoc } from "./stored-document.js"
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
function type(doc: Y.Doc) {
  const visit = (node: Y.XmlFragment): boolean => {
    for (const child of node.toArray()) {
      if (child instanceof Y.XmlText && child.length) {
        child.insert(child.length, " added 😀")
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

  it.each(["foreign", "reset", "malformed"])(
    "refuses %s recovery without acknowledgement or loss of pending bytes",
    (mistake) => {
      const remote = server("letter"),
        client = prime(remote)
      type(client.ydoc)
      const before = client.stored(),
        bytes = client.state(),
        sent = client.prepare({ pullOnly: true })
      if (mistake === "foreign") type(remote)
      if (mistake === "malformed")
        remote.getMap("paper").set("richText", "shadow copy")
      const result = client.receive(
        sent,
        reply(remote, 1, mistake === "reset", mistake === "foreign")
      )
      expect(result.failed).toBe(true)
      expect(client.stored()).toEqual(before)
      expect(client.state()).toEqual(bytes)
      expect(client.hasPending()).toBe(true)
    }
  )

  it("refuses orphan adoption and an old client without rewriting stored bytes", () => {
    const remote = server("letter"),
      client: PaperClient<RichPaperDocument> = prime(remote)
    type(client.ydoc)
    const stored = client.stored(),
      before = client.state()
    expect(client.adopt(stored)).toEqual({ adopted: false, failed: true })
    expect(client.state()).toEqual(before)
    expect(() =>
      openPaperClient(stored, { provenance: stored.provenance })
    ).toThrow("recovery bytes")
    const prose = nativePaperDocumentSchema.parse({
      version: 4,
      schemaRevision: 1,
      kind: "letter",
      clashes: [],
      blocks: [],
    })
    expect(() =>
      openRichPaperClient(stored, { provenance: nativeProvenance(prose) })
    ).toThrow()
    expect(NATIVE_WRITER.supportedSchemaRevisions).toEqual([1])
  })
})
