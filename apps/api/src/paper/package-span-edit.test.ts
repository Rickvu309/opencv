import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { handleApiError } from "../middleware.js"
import { CommandError } from "../registry/errors.js"
import { PaperPackage } from "./package-engine.js"
import { PaperPackageRefusal } from "./package-errors.js"
import { fixturePackage, run } from "./package-fixtures.js"
import { parsePackageXml, descendants, isWord } from "./package-xml.js"
import { witnessArchive } from "./package-witness.js"

const context = {
  docId: "cv",
  incarnation: "import-one",
  revision: "revision-one",
}

function line(parts: readonly string[]) {
  return `<w:p>${parts.map((text) => run(text)).join("")}</w:p>`
}

function inners(bytes: Buffer) {
  const xml = witnessArchive(bytes).get("word/document.xml")?.bytes.toString()
  if (!xml) throw new Error("Missing main document part")
  const part = parsePackageXml(Buffer.from(xml))
  return descendants(part.root)
    .filter((node) => isWord(node, "t"))
    .map((node) => xml.slice(node.openEnd, node.closeStart))
}

describe("editable spans share one replacement decision", () => {
  it("treats a refusal as a client error with its own reason", async () => {
    const error = new PaperPackageRefusal("BEFORE_TEXT_MISMATCH", "kept")
    expect(error).toBeInstanceOf(CommandError)
    expect(error.status).not.toBe(500)
    expect(error.status).toBe(400)
    expect(error.code).toBe("BEFORE_TEXT_MISMATCH")
    expect(error.message).toContain(
      "The text to replace does not exactly match this span."
    )
    expect(error.detail).toEqual({})
    expect(error.packageDetail).toBe("kept")
    const app = new Hono()
    app.onError(handleApiError)
    app.get("/boom", () => {
      throw error
    })
    const res = await app.request("/boom")
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "BEFORE_TEXT_MISMATCH",
        message: error.message,
      },
    })
  })

  it("replaces each editable piece and leaves the other piece bytes unchanged", async () => {
    const parts = ["Email", ":", " ", "name", "@mail.test"]
    const bytes = fixturePackage(line(parts))
    const document = await PaperPackage.open(bytes, context)
    const editable = document
      .read()
      .regions.filter((region) => region.kind === "editable")
    expect(editable.map((region) => region.text)).toEqual(parts)
    for (const [index, region] of editable.entries()) {
      if (region.kind !== "editable") continue
      const prepared = await document.prepare({
        docId: context.docId,
        basedOn: document.read().revision,
        edits: [
          {
            op: "replaceText",
            targetId: region.targetId,
            before: region.text,
            after: `${region.text}Q`,
          },
        ],
      })
      const next = inners(prepared.package.export())
      const previous = inners(bytes)
      expect(next.filter((_, at) => at !== index)).toEqual(
        previous.filter((_, at) => at !== index)
      )
      expect(next[index]).toBe(`${previous[index]}Q`)
      const original = witnessArchive(bytes)
      const witness = witnessArchive(prepared.package.export())
      for (const [name, part] of original)
        if (name !== "word/document.xml")
          expect(witness.get(name)).toEqual(part)
    }
  })

  it("applies a joined line to the piece that changed", async () => {
    const parts = ["Email", ":", " ", "name", "@mail.test"]
    const bytes = fixturePackage(line(parts) + line(["untouched"]))
    const document = await PaperPackage.open(bytes, context)
    const regions = document.read().regions
    const editable = regions.filter((region) => region.kind === "editable")
    const first = editable[0]
    if (!first || first.kind !== "editable") throw new Error("Missing piece")
    const before = parts.join("")
    const prepared = await document.prepare({
      docId: context.docId,
      basedOn: document.read().revision,
      edits: [
        {
          op: "replaceText",
          targetId: first.targetId,
          before,
          after: `${before} QA1284.`,
        },
      ],
    })
    const previous = inners(bytes)
    const next = inners(prepared.package.export())
    expect(next.slice(0, 4)).toEqual(previous.slice(0, 4))
    expect(next[4]).toBe(`${previous[4]} QA1284.`)
    expect(next[5]).toBe(previous[5])
    const savedArchive = witnessArchive(prepared.package.export())
    const source = witnessArchive(bytes)
      .get("word/document.xml")
      ?.bytes.toString()
    const saved = savedArchive.get("word/document.xml")?.bytes.toString()
    const part = parsePackageXml(Buffer.from(source ?? ""))
    const node = descendants(part.root).filter((item) => isWord(item, "t"))[4]
    if (!source || !saved || !node) throw new Error("Missing text span")
    expect(saved).toBe(
      source.slice(0, node.openEnd) + next[4] + source.slice(node.closeStart)
    )
    const original = witnessArchive(bytes)
    for (const [name, item] of original) {
      if (name !== "word/document.xml")
        expect(savedArchive.get(name)).toEqual(item)
    }
  })
})
