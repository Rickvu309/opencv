import { describe, expect, it } from "vitest"
import * as Y from "yjs"
import {
  canonicalPaper,
  NATIVE_WRITER,
  RICH_NATIVE_WRITER,
  nativeAdmission,
  nativeProvenance,
  paperDocumentSchema,
  requirePaperDocument,
  storedPaperPhotoIds,
} from "@workspace/domain"
import { canonical } from "@workspace/domain/internal/paper-presentation"
import { seedStoredYDoc, materializeStored } from "./stored-document.js"
import { materialize, writeDocument } from "./ydoc.js"
import {
  commitFlowEdit,
  openFlowBinary,
  readFlow,
  undoFlowEdit,
} from "./native-layout-flow.js"
import { storedFlowFixture } from "./test/flow-fixture.js"

describe("rich document canonical storage", () => {
  it("stores rich documents without browser globals", () => {
    expect(typeof globalThis.document).toBe("undefined")
    expect(typeof globalThis.window).toBe("undefined")
    const source = storedFlowFixture()
    expect(materializeStored(seedStoredYDoc(source))).toEqual({
      ok: true,
      document: source,
    })
  })
  it.each(["cv", "letter"] as const)(
    "roundtrips %s rich cells, photos, semantic fields and hard breaks",
    (kind) => {
      const source = storedFlowFixture(kind)
      const bytes = seedStoredYDoc(source)
      const doc = new Y.Doc()
      Y.applyUpdate(doc, bytes)
      const before = Y.encodeStateAsUpdate(doc)
      expect(materializeStored(doc)).toEqual({ ok: true, document: source })
      expect(materializeStored(bytes)).toEqual({ ok: true, document: source })
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
      expect([...doc.share.keys()].sort()).toEqual(
        [
          kind === "cv" ? "private-native-cv-v4-r2" : "document-store",
          "paper",
        ].sort()
      )
      expect(materialize(doc).ok).toBe(false)
      expect(paperDocumentSchema.safeParse(source).success).toBe(false)
      expect(() => requirePaperDocument(source)).toThrow("rich Paper editor")
      expect(() =>
        writeDocument(
          doc,
          { version: 3, kind: "letter", clashes: [], blocks: [] },
          "old-editor"
        )
      ).toThrow()
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
      expect(storedPaperPhotoIds(source)).toEqual([
        "00000000-0000-4000-8000-000000000001",
      ])
      doc.destroy()
    }
  )

  it("retains command identity, retries and Undo across binary storage", () => {
    const binding = openFlowBinary(
      seedStoredYDoc(storedFlowFixture()),
      "letter"
    )
    const basis = canonical(readFlow(binding))
    const edit = {
      kind: "insert-page-break",
      sectionId: "section-1",
      beforeId: "after",
      breakId: "second-break",
    }
    const receipt = commitFlowEdit(binding, "stored-op", edit, basis)
    expect(receipt.kind).toBe("ok")
    const bytes = Y.encodeStateAsUpdate(binding.doc)
    expect(materializeStored(bytes).ok).toBe(true)
    const reopened = openFlowBinary(bytes, "letter")
    expect(commitFlowEdit(reopened, "stored-op", edit, basis)).toEqual(receipt)
    expect(Y.encodeStateAsUpdate(reopened.doc)).toEqual(bytes)
    expect(
      undoFlowEdit(reopened, "stored-op", canonical(readFlow(reopened))).kind
    ).toBe("ok")
    expect(materializeStored(reopened.doc)).toEqual({
      ok: true,
      document: storedFlowFixture(),
    })
    for (const value of [binding, reopened]) {
      value.engine._tiptapEditor.destroy()
      value.doc.destroy()
    }
  })

  it.each(["root", "mirror", "profile", "receipt", "identity"])(
    "refuses %s corruption without rewriting bytes",
    (mistake) => {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, seedStoredYDoc(storedFlowFixture()))
      const meta = doc.getMap<unknown>("paper")
      if (mistake === "root") doc.getText("second-document").insert(0, "hidden")
      if (mistake === "mirror") meta.set("richText", "second copy")
      if (mistake === "profile") meta.set("formattingProfile", "future-layout")
      if (mistake === "receipt")
        meta.set("flow-receipt:broken", {
          request: "x",
          receipt: {},
          undone: false,
        })
      if (mistake === "identity") meta.set("schemaRevision", 1)
      const before = Y.encodeStateAsUpdate(doc)
      expect(materializeStored(doc).ok).toBe(false)
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
      doc.destroy()
    }
  )

  it("requires every capability and the exact revision while old prose stays supported", () => {
    const document = storedFlowFixture()
    expect(nativeAdmission(document, RICH_NATIVE_WRITER)).toBeNull()
    expect(nativeAdmission(document, NATIVE_WRITER)).toContain("schema")
    for (const capability of RICH_NATIVE_WRITER.capabilities)
      expect(
        nativeAdmission(document, {
          ...RICH_NATIVE_WRITER,
          capabilities: RICH_NATIVE_WRITER.capabilities.filter(
            (item) => item !== capability
          ),
        })
      ).toContain("capability")
    expect(nativeProvenance(document).schemaRevision).toBe(2)
    const prose = paperDocumentSchema.parse({
      version: 3,
      kind: "letter",
      clashes: [],
      blocks: [],
    })
    const read = materializeStored(seedStoredYDoc(prose))
    expect(read.ok && canonicalPaper(read.document)).toBe(canonicalPaper(prose))
  })
})
