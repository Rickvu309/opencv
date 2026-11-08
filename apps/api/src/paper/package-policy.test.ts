import { describe, expect, it } from "vitest"
import { PaperPackage } from "./package-engine.js"
import {
  fixtureFiles,
  fixturePackage,
  fixtureZip,
  paragraph,
  rangeFixtures,
  relationship,
  run,
  story,
  type FixtureOptions,
} from "./package-fixtures.js"
import { witnessArchive } from "./package-witness.js"

const context = {
  docId: "cv",
  incarnation: "import-one",
  revision: "revision-one",
}

const tail = paragraph("untouched")

function mainXml(bytes: Buffer) {
  const part = witnessArchive(bytes).get("word/document.xml")
  if (!part) throw new Error("Missing main document part")
  return part.bytes
}

function editable(document: PaperPackage, text: string, occurrence = 0) {
  const region = document
    .read()
    .regions.filter(
      (region) => region.kind === "editable" && region.text === text
    )[occurrence]
  if (!region || region.kind !== "editable")
    throw new Error(`Missing editable target: ${text}`)
  return region
}

function edit(
  document: PaperPackage,
  before: string,
  after: string,
  occurrence = 0
) {
  return {
    docId: context.docId,
    basedOn: document.read().revision,
    edits: [
      {
        op: "replaceText",
        targetId: editable(document, before, occurrence).targetId,
        before,
        after,
      },
    ],
  }
}

async function unchangedRefusal(document: PaperPackage, request: unknown) {
  const bytes = document.export()
  const sidecar = document.sidecar()
  const view = document.read()
  await expect(document.prepare(request)).rejects.toThrow()
  expect(document.export()).toEqual(bytes)
  expect(document.sidecar()).toEqual(sidecar)
  expect(document.read()).toEqual(view)
}

describe("conservative surface and references", () => {
  const ranges = [
    ["field", rangeFixtures.fieldStart, rangeFixtures.fieldEnd, {}],
    [
      "bookmark",
      rangeFixtures.bookmarkStart,
      rangeFixtures.bookmarkEnd,
      { parts: { "word/header1.xml": rangeFixtures.bookmarkHeader } },
    ],
    [
      "comment",
      rangeFixtures.commentStart,
      rangeFixtures.commentEnd,
      { parts: { "word/comments.xml": rangeFixtures.commentPart } },
    ],
    [
      "move",
      `<w:p><w:moveFromRangeStart w:id="9" w:name="MoveMark"/>${run("begin")}</w:p>`,
      `<w:p>${run("end")}<w:moveFromRangeEnd w:id="9"/></w:p>`,
      {},
    ],
  ] satisfies [string, string, string, FixtureOptions][]

  it.each(ranges)(
    "locks a %s across paragraphs while preserving a target outside",
    async (_, start, end, options) => {
      const document = await PaperPackage.open(
        fixturePackage(
          start + paragraph("inside") + end + paragraph("outside"),
          options
        ),
        context
      )
      expect(
        document.read().regions.find((region) => region.text === "inside")?.kind
      ).toBe("locked")
      const candidate = (
        await document.prepare(edit(document, "outside", "changed"))
      ).package
      expect(
        candidate.read().regions.find((region) => region.text === "inside")
          ?.kind
      ).toBe("locked")
      for (const [name, part] of witnessArchive(document.export())) {
        if (name !== "word/document.xml")
          expect(witnessArchive(candidate.export()).get(name)).toEqual(part)
      }
    }
  )

  it.each([
    ["typed tab", `<w:p><w:r><w:t>ab</w:t><w:tab/></w:r>${run("cd")}</w:p>`],
    ["line break", `<w:p><w:r><w:t>ab</w:t><w:br/></w:r>${run("cd")}</w:p>`],
    [
      "simple field",
      `<w:p><w:fldSimple w:instr="PAGE">${run("target")}</w:fldSimple></w:p>`,
    ],
    [
      "tracked insertion",
      `<w:ins w:id="8" w:author="Person">${paragraph("target")}</w:ins>`,
    ],
    [
      "complex cell",
      `<w:tbl><w:tr><w:tc>${paragraph("target")}${paragraph("second")}</w:tc></w:tr></w:tbl>`,
    ],
    ["section boundary", paragraph("target", "<w:sectPr/>")],
  ])(
    "locks the unsupported %s without silently widening the profile",
    async (_, body) => {
      const document = await PaperPackage.open(
        fixturePackage(body + tail),
        context
      )
      expect(document.read().regions[0].kind).toBe("locked")
      expect(editable(document, "untouched").kind).toBe("editable")
      const region = document.read().regions[0]
      if (region.kind !== "locked") throw new Error("Expected a locked region")
      expect(region.complete).toBe(true)
      expect(region.reason.code).toMatch(/^[A-Z_]+$/)
      expect(region.reason.message).not.toBe(region.reason.code)
      expect(region.reason.message).toMatch(/\.$/)
      expect(region.reason.message).not.toContain("word/")
    }
  )

  it.each([
    ["unbalanced field", rangeFixtures.fieldStart, {}],
    ["unbalanced bookmark", rangeFixtures.bookmarkStart, {}],
    [
      "dangling bookmark",
      "",
      { parts: { "word/header1.xml": rangeFixtures.bookmarkHeader } },
    ],
    [
      "dangling comment",
      rangeFixtures.commentStart + rangeFixtures.commentEnd,
      {},
    ],
    [
      "unknown part",
      "",
      { parts: { "word/commentsExtended.xml": "<unknown/>" } },
    ],
    ["unknown markup", "<w:p><w:futureRef/></w:p>", {}],
    [
      "external active relationship",
      "",
      {
        relationships: [
          relationship(
            "active",
            "styles",
            "https://example.invalid/styles",
            true
          ),
        ],
      },
    ],
  ] satisfies [string, string, FixtureOptions][])(
    "makes the package read-only for %s and preserves its archive",
    async (_, prefix, options) => {
      const bytes = fixturePackage(prefix + tail, options)
      const document = await PaperPackage.open(bytes, context)
      expect(
        document.read().regions.every((region) => region.kind === "locked")
      ).toBe(true)
      expect(document.export()).toEqual(bytes)
      await unchangedRefusal(document, {
        docId: context.docId,
        basedOn: context.revision,
        edits: [
          {
            op: "replaceText",
            targetId: `t_${"0".repeat(64)}`,
            before: "untouched",
            after: "changed",
          },
        ],
      })
    }
  )

  it.each(["signed", "unsigned"] as const)(
    "validates and preserves %s ZIP descriptors",
    async (descriptor) => {
      const bytes = fixtureZip(
        fixtureFiles(paragraph("alpha") + tail),
        8,
        descriptor
      )
      const document = await PaperPackage.open(bytes, context)
      const candidate = (
        await document.prepare(edit(document, "alpha", "changed"))
      ).package
      expect(mainXml(candidate.export())).toEqual(
        Buffer.from(mainXml(bytes).toString().replace("alpha", "changed"))
      )
      for (const [name, part] of witnessArchive(bytes))
        if (name !== "word/document.xml")
          expect(witnessArchive(candidate.export()).get(name)).toEqual(part)
      const corrupt = Buffer.from(bytes)
      const descriptorAt = corrupt.indexOf(
        Buffer.from([0x50, 0x4b, 0x07, 0x08])
      )
      if (descriptor === "signed") {
        corrupt[descriptorAt + 4] ^= 1
        await expect(PaperPackage.open(corrupt, context)).rejects.toThrow(
          "ZIP_DESCRIPTOR_MISMATCH"
        )
      }
    }
  )

  it("requires a unique exact nonempty phrase including overlapping occurrences", async () => {
    const document = await PaperPackage.open(
      fixturePackage(paragraph("prefix aaa suffix") + tail),
      context
    )
    const request = edit(document, "prefix aaa suffix", "changed")
    await unchangedRefusal(document, {
      ...request,
      edits: [{ ...request.edits[0], before: "aa" }],
    })
    const candidate = (
      await document.prepare({
        ...request,
        edits: [{ ...request.edits[0], before: "aaa", after: "one" }],
      })
    ).package
    expect(mainXml(candidate.export())).toEqual(
      Buffer.from(
        mainXml(document.export())
          .toString()
          .replace("prefix aaa suffix", "prefix one suffix")
      )
    )
  })

  it("advances existing paragraph versions deterministically and retains scoped history", async () => {
    const identity = '<w:p w14:paraId="12345678" w14:textId="23456789">'
    const bytes = fixturePackage(
      paragraph("alpha").replace("<w:p>", identity) + tail
    )
    const document = await PaperPackage.open(bytes, context)
    const request = edit(document, "alpha", "beta")
    const first = (await document.prepare(request)).package
    const retry = (await document.prepare(request)).package
    expect(retry.export()).toEqual(first.export())
    expect(retry.sidecar()).toEqual(first.sidecar())
    expect(first.sidecar().paragraphs[0].textIds).toHaveLength(2)
    const inverse = (await first.prepare(edit(first, "beta", "alpha"))).package
    expect(inverse.sidecar().paragraphs[0].textIds).toHaveLength(3)
    expect(new Set(inverse.sidecar().paragraphs[0].textIds).size).toBe(3)
    expect(
      mainXml(inverse.export())
        .toString()
        .replace(/w14:textId="[0-9A-F]+"/, 'w14:textId="23456789"')
    ).toBe(mainXml(bytes).toString())
    expect(mainXml(first.export()).toString()).toContain(
      'w14:paraId="12345678"'
    )
    expect(
      (
        await document.prepare(edit(document, "alpha", "alpha"))
      ).package.sidecar()
    ).toEqual(document.sidecar())
  })

  it.each([
    [
      "version without paragraph identity",
      paragraph("target").replace("<w:p>", '<w:p w14:textId="12345678">'),
      {},
    ],
    ["missing style", paragraph("target", '<w:pStyle w:val="Missing"/>'), {}],
    [
      "cycle in reached style",
      paragraph("target", '<w:pStyle w:val="A"/>'),
      {
        parts: {
          "word/styles.xml": story(
            "styles",
            '<w:style w:type="paragraph" w:styleId="Normal"/><w:style w:type="paragraph" w:styleId="A"><w:basedOn w:val="A"/></w:style>'
          ),
        },
      },
    ],
    [
      "duplicate reached style",
      paragraph("target", '<w:pStyle w:val="A"/>'),
      {
        parts: {
          "word/styles.xml": story(
            "styles",
            '<w:style w:type="paragraph" w:styleId="Normal"/><w:style w:type="paragraph" w:styleId="A"/><w:style w:type="paragraph" w:styleId="A"/>'
          ),
        },
      },
    ],
  ] satisfies [string, string, FixtureOptions][])(
    "locks %s without vetoing an independent target",
    async (_, body, options) => {
      const document = await PaperPackage.open(
        fixturePackage(body + tail, options),
        context
      )
      expect(document.read().regions[0].kind).toBe("locked")
      const candidate = (
        await document.prepare(edit(document, "untouched", "changed"))
      ).package
      expect(candidate.read().regions[0].kind).toBe("locked")
    }
  )

  it("retains an external hyperlink without fetching or rewriting it", async () => {
    const link = `<w:p><w:hyperlink r:id="link">${run("linked")}</w:hyperlink></w:p>`
    const bytes = fixturePackage(link + tail, {
      relationships: [
        relationship(
          "link",
          "hyperlink",
          "https://example.invalid/private",
          true
        ),
      ],
    })
    const document = await PaperPackage.open(bytes, context)
    expect(document.read().regions[0].kind).toBe("locked")
    const candidate = (
      await document.prepare(edit(document, "untouched", "changed"))
    ).package
    expect(
      witnessArchive(candidate.export())
        .get("word/document.xml")
        ?.bytes.toString()
    ).toContain(link)
    expect(
      witnessArchive(candidate.export()).get("word/_rels/document.xml.rels")
    ).toEqual(witnessArchive(bytes).get("word/_rels/document.xml.rels"))
  })

  it("retains UTF-8 BOM and line endings outside the changed text envelope", async () => {
    const files = fixtureFiles(paragraph("alpha") + tail)
    files["word/document.xml"] =
      '\ufeff<?xml version="1.0" encoding="UTF-8"?>\r\n' +
      files["word/document.xml"]
    const document = await PaperPackage.open(fixtureZip(files), context)
    const candidate = (
      await document.prepare(edit(document, "alpha", "changed"))
    ).package
    expect(
      witnessArchive(candidate.export()).get("word/document.xml")?.bytes
    ).toEqual(
      Buffer.from(
        String(files["word/document.xml"]).replace(
          "<w:t>alpha</w:t>",
          "<w:t>changed</w:t>"
        )
      )
    )
  })
})
