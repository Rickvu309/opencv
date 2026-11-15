import {
  canonicalPaper,
  nativePaperDocumentSchema,
  nativeProvenance,
} from "@workspace/domain"
import * as Y from "yjs"
import { describe, expect, it } from "vitest"

import { openPaperClient } from "./client.js"
import { writeAsEditor } from "./editor-write.js"
import { FRAGMENT, META } from "./names.js"
import { loadYDoc } from "./sync.js"
import { materialize, seedYDoc } from "./ydoc.js"

const document = (text = "Việt Nam é 😀") =>
  nativePaperDocumentSchema.parse({
    version: 4,
    schemaRevision: 1,
    kind: "letter",
    blocks: [
      {
        id: "p1",
        type: "paragraph",
        content: [
          {
            text,
            bold: true,
            italic: true,
            underline: true,
            href: "https://example.com",
          },
        ],
      },
    ],
    clashes: [],
  })

const empty = () => Y.encodeStateAsUpdate(new Y.Doc())

function recovered(doc: Y.Doc) {
  const result = materialize(doc)
  if (!result.ok) throw new Error(result.reason)
  return result.document
}

describe("native underline in the authoritative Y.Doc", () => {
  it("round trips mixed marks and Unicode through seed, edit, bytes, Undo and Redo", () => {
    const source = document()
    const doc = loadYDoc(seedYDoc(source), [])
    expect(canonicalPaper(recovered(doc))).toBe(canonicalPaper(source))
    const undo = new Y.UndoManager(doc.getXmlFragment(FRAGMENT), {
      trackedOrigins: new Set(["person"]),
    })
    const changed = document("Việt Nam é 😀 typed")
    writeAsEditor(doc, changed, "person")
    expect(canonicalPaper(recovered(doc))).toBe(canonicalPaper(changed))
    undo.undo()
    expect(canonicalPaper(recovered(doc))).toBe(canonicalPaper(source))
    undo.redo()
    expect(canonicalPaper(recovered(doc))).toBe(canonicalPaper(changed))
    const reload = loadYDoc(Y.encodeStateAsUpdate(doc), [])
    expect(canonicalPaper(recovered(reload))).toBe(canonicalPaper(changed))
    undo.destroy()
  })

  it.each(["futureStyle", "textColor"])(
    "refuses unsupported raw %s before converting native content",
    (mark) => {
      const doc = loadYDoc(seedYDoc(document()), [])
      const text = doc
        .getXmlFragment(FRAGMENT)
        .createTreeWalker((node) => node instanceof Y.XmlText)
        .next().value
      if (!(text instanceof Y.XmlText)) throw new Error("Missing native text")
      text.format(0, text.length, { [mark]: { value: "red" } })
      expect(materialize(doc)).toMatchObject({
        ok: false,
        reason: "Unsupported native text mark",
      })
      const before = Y.encodeStateAsUpdate(doc)
      expect(materialize(doc).ok).toBe(false)
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    }
  )

  it("refuses unsupported native nodes before a parser can discard them", () => {
    const doc = loadYDoc(seedYDoc(document()), [])
    const root = doc.getXmlFragment(FRAGMENT).get(0)
    if (!(root instanceof Y.XmlElement)) throw new Error("Missing native root")
    root.insert(0, [new Y.XmlElement("futureGrid")])
    expect(materialize(doc)).toMatchObject({
      ok: false,
      reason: "Unsupported native node",
    })
  })

  it("rejects incompatible replies before changing the epoch, revision or bytes", () => {
    const source = document()
    const provenance = nativeProvenance(source)
    const client = openPaperClient(
      {
        epoch: 2,
        revision: 4,
        server: seedYDoc(source),
        pending: empty(),
        provenance,
      },
      { provenance }
    )
    writeAsEditor(client.ydoc, document("Việt Nam é 😀 pending"), "person")
    const before = client.state()
    const sent = client.prepare()
    const reply = {
      epoch: 3,
      revision: 5,
      reset: true,
      stale: false,
      update: seedYDoc(document("foreign")),
      stateVector: empty(),
    }
    expect(client.receive(sent, reply).failed).toBe(true)
    expect(client.state()).toEqual(before)
    expect(client.epoch).toBe(2)
    expect(client.revision).toBe(4)
    expect(client.hasPending()).toBe(true)
    const unknown = loadYDoc(reply.update, [])
    unknown.getMap<string>(META).set("schemaRevision", "2")
    expect(
      client.receive(sent, {
        ...reply,
        provenance,
        update: Y.encodeStateAsUpdate(unknown),
      }).failed
    ).toBe(true)
    expect(client.state()).toEqual(before)
    expect(client.revision).toBe(4)
    expect(() => openPaperClient(client.stored())).toThrow(/different schema/)
  })

  it("refuses a native body falsely labelled as legacy recovery", () => {
    const source = document()
    expect(() =>
      openPaperClient({
        epoch: 2,
        revision: 4,
        server: seedYDoc(source),
        pending: empty(),
      })
    ).toThrow(/schema identity/)
    const client = openPaperClient()
    const before = client.state()
    expect(
      client.receive(client.prepare(), {
        epoch: 2,
        revision: 4,
        reset: true,
        stale: false,
        update: seedYDoc(source),
        stateVector: empty(),
      }).failed
    ).toBe(true)
    expect(client.state()).toEqual(before)
    expect(client.epoch).toBe(0)
  })
})
