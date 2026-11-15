import {
  canonicalPaper,
  nativePaperDocumentSchema,
  nativeProvenance,
  paperDocumentSchema,
} from "@workspace/domain"
import * as Y from "yjs"
import { describe, expect, it } from "vitest"

import { openPaperClient } from "./client.js"
import { writeAsEditor } from "./editor-write.js"
import { FRAGMENT, META } from "./names.js"
import { loadYDoc } from "./sync.js"
import { materialize, seedYDoc, writeDocument, writeRepair } from "./ydoc.js"

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
      reason: expect.stringMatching(/Unsupported native (node|structure)/),
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

it("forbids cross-schema writes and refuses future metadata without changing bytes", () => {
  const doc = loadYDoc(seedYDoc(document()), [])
  const before = Y.encodeStateAsUpdate(doc)
  expect(() =>
    writeDocument(
      doc,
      { version: 3, kind: "letter", blocks: [], clashes: [] },
      "person"
    )
  ).toThrow()
  expect(() =>
    writeRepair(
      doc,
      { version: 3, kind: "letter", blocks: [], clashes: [] },
      "server",
      new Set(),
      new Map()
    )
  ).toThrow(/schema/)
  expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  doc.getMap<string>(META).set("version", "5")
  const future = Y.encodeStateAsUpdate(doc)
  expect(materialize(doc).ok).toBe(false)
  expect(Y.encodeStateAsUpdate(doc)).toEqual(future)
})

it("rejects an unannounced epoch change and an older revision before client mutation", () => {
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
  const before = client.stored()
  for (const patch of [
    { epoch: 3, revision: 5 },
    { epoch: 2, revision: 3 },
  ]) {
    expect(
      client.receive(client.prepare(), {
        ...patch,
        provenance,
        reset: false,
        stale: false,
        update: empty(),
        stateVector: empty(),
      }).failed
    ).toBe(true)
    expect(client.stored()).toEqual(before)
  }
})

it("refuses nested content that native materialization cannot preserve", () => {
  const doc = loadYDoc(seedYDoc(document()), [])
  const root = doc.getXmlFragment(FRAGMENT).get(0)
  if (!(root instanceof Y.XmlElement)) throw new Error("Missing root")
  const container = root.get(0)
  if (!(container instanceof Y.XmlElement)) throw new Error("Missing container")
  container.insert(container.length, [new Y.XmlElement("blockGroup")])
  const before = Y.encodeStateAsUpdate(doc)
  expect(materialize(doc)).toMatchObject({
    ok: false,
    reason: "Unsupported native structure",
  })
  expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
})

it("refuses inline text in an empty-content block before it can be discarded", () => {
  const doc = loadYDoc(seedYDoc(document()), [])
  const root = doc.getXmlFragment(FRAGMENT).get(0)
  if (!(root instanceof Y.XmlElement)) throw new Error("Missing root")
  const container = root.get(0)
  if (!(container instanceof Y.XmlElement)) throw new Error("Missing container")
  container.delete(0, 1)
  const divider = new Y.XmlElement("divider")
  const text = new Y.XmlText()
  text.insert(0, "Preserve me")
  divider.insert(0, [text])
  container.insert(0, [divider])
  expect(materialize(doc)).toMatchObject({
    ok: false,
    reason: "Unsupported native structure",
  })
})

it("refuses editor schema and kind changes without changing encoded bytes, then accepts a valid write", () => {
  const native = document()
  const legacy = paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks: [],
    clashes: [],
  })
  for (const [current, target] of [
    [native, legacy],
    [legacy, native],
  ] as const) {
    const doc = loadYDoc(seedYDoc(current), [])
    const before = Y.encodeStateAsUpdate(doc)
    expect(() => writeAsEditor(doc, target, "person")).toThrow(/schema/)
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    writeAsEditor(doc, current, "person")
    expect(recovered(doc)).toEqual(current)
  }
  const doc = loadYDoc(seedYDoc(native), [])
  doc.getMap<string>(META).set("kind", "cv")
  const before = Y.encodeStateAsUpdate(doc)
  expect(() => writeAsEditor(doc, native, "person")).toThrow(/schema/)
  expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
})

it.each([
  ["kind", "future"],
  ["kind", undefined],
  ["version", "5"],
  ["version", "3"],
  ["version", undefined],
  ["schemaRevision", "2"],
  ["schemaRevision", undefined],
] as const)(
  "refuses editor writes against unsupported %s=%s metadata before mutation",
  (key, value) => {
    const doc = loadYDoc(seedYDoc(document()), [])
    const meta = doc.getMap<string>(META)
    if (value === undefined) meta.delete(key)
    else meta.set(key, value)
    const before = Y.encodeStateAsUpdate(doc)
    expect(() => writeAsEditor(doc, document("Refused"), "person")).toThrow(
      /schema/
    )
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  }
)

it("parses the editor target before identity admission and rejects unknown native revisions", () => {
  const doc = loadYDoc(seedYDoc(document()), [])
  const before = Y.encodeStateAsUpdate(doc)
  expect(() =>
    Reflect.apply(writeAsEditor, undefined, [
      doc,
      { ...document(), schemaRevision: 2 },
      "person",
    ])
  ).toThrow()
  expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
})

it("keeps empty and absent-version legacy editor writes legacy and refuses an unidentified Y.Doc", () => {
  const legacy = paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks: [],
    clashes: [],
  })
  const doc = loadYDoc(seedYDoc(legacy), [])
  doc.getMap<string>(META).delete("version")
  const changed = paperDocumentSchema.parse({
    ...legacy,
    blocks: [{ id: "p1", type: "paragraph", content: "Legacy typed 😀" }],
  })
  writeAsEditor(doc, changed, "person")
  expect(recovered(doc)).toEqual(changed)
  expect(doc.getMap<string>(META).has("version")).toBe(false)
  writeAsEditor(doc, legacy, "person")
  expect(recovered(doc)).toEqual(legacy)
  const unidentified = new Y.Doc()
  const before = Y.encodeStateAsUpdate(unidentified)
  expect(() => writeAsEditor(unidentified, legacy, "person")).toThrow(/schema/)
  expect(Y.encodeStateAsUpdate(unidentified)).toEqual(before)
})
