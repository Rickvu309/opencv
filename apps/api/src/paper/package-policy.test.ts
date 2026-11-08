import { describe, expect, it, vi } from "vitest"
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
import { PACKAGE_LIMITS } from "./package-limits.js"
import * as packageXml from "./package-xml.js"

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

describe("review regressions", () => {
  it.each([
    ...["ins", "del", "moveFrom", "moveTo", "trPrChange"].map((name) => [
      "trPr",
      name,
    ]),
    ...["cellIns", "cellDel", "cellMerge", "tcPrChange"].map((name) => [
      "tcPr",
      name,
    ]),
  ])(
    "B1 locks table revision %s/%s without a row identity",
    async (property, change) => {
      const revision = `<w:${property}><w:${change} w:id="1" w:author="Person"/></w:${property}>`
      const bytes = fixturePackage(
        `<w:tbl><w:tr>${property === "trPr" ? revision : ""}<w:tc>${property === "tcPr" ? revision : ""}${paragraph("target")}</w:tc></w:tr></w:tbl>` +
          tail
      )
      const document = await PaperPackage.open(bytes, context)
      expect(document.read().regions[0]).toMatchObject({
        kind: "locked",
        text: "target",
      })
      expect(editable(document, "untouched").kind).toBe("editable")
      expect(document.export()).toEqual(bytes)
    }
  )

  it("B1 keeps an ordinary table cell editable", async () => {
    const document = await PaperPackage.open(
      fixturePackage(
        `<w:tbl><w:tr><w:trPr/><w:tc><w:tcPr/><w:p>${run("target")}</w:p></w:tc></w:tr></w:tbl>`
      ),
      context
    )
    expect(
      (
        await document.prepare(edit(document, "target", "changed"))
      ).package.read().regions[0]
    ).toMatchObject({ kind: "editable", text: "changed" })
  })

  it("B2 bounds whole-part identity traversals independently of paragraph count", async () => {
    const spy = vi.spyOn(packageXml, "descendants")
    try {
      const body = Array.from({ length: 64 }, (_, index) =>
        paragraph(`target ${index}`).replace(
          "<w:p>",
          `<w:p w14:paraId="${(index + 1).toString(16).padStart(8, "0")}">`
        )
      ).join("")
      const document = await PaperPackage.open(fixturePackage(body), context)
      expect(
        document.read().regions.filter((region) => region.kind === "editable")
      ).toHaveLength(64)
      expect(
        spy.mock.calls.filter(([node]) => packageXml.isWord(node, "document"))
          .length
      ).toBeLessThanOrEqual(6)
    } finally {
      spy.mockRestore()
    }
  })

  it("B2 still locks duplicate paragraph identities and keeps independent identities editable", async () => {
    const p = (text: string, id: string) =>
      paragraph(text).replace("<w:p>", `<w:p w14:paraId="${id}">`)
    const document = await PaperPackage.open(
      fixturePackage(
        p("first", "1111abcd") +
          p("second", "1111ABCD") +
          p("third", "22222222")
      ),
      context
    )
    expect(document.read().regions.map((region) => region.kind)).toEqual([
      "locked",
      "locked",
      "editable",
    ])
  })

  it.each(["&#13;", "&#9;", "&#10;", "\t", "\n", "&#13;&#10;"])(
    "B3 locks decoded text control %j",
    async (control) => {
      const bytes = fixturePackage(
        `<w:p><w:r><w:t>a${control}b</w:t></w:r></w:p>` + tail
      )
      const document = await PaperPackage.open(bytes, context)
      expect(document.read().regions[0].kind).toBe("locked")
      expect(editable(document, "untouched").kind).toBe("editable")
      expect(document.export()).toEqual(bytes)
    }
  )

  it.each(["XML", "RELS"])(
    "B4 classifies the case-variant %s part before dependency checks",
    async (extension) => {
      const files = fixtureFiles(paragraph("target"))
      if (extension === "XML") {
        files["opaque.XML"] = story("p", run("consumer"))
      } else {
        const name = "word/_rels/document.xml.rels"
        const source = files[name]
        files["word/_rels/document.xml.RELS"] = source
          .toString()
          .replace(
            "</Relationships>",
            `<Relationship Id="future" Type="urn:unproven:consumer" Target="document.xml"/></Relationships>`
          )
        delete files[name]
      }
      const name =
        extension === "XML" ? "/opaque.XML" : "/word/_rels/document.xml.RELS"
      const type =
        extension === "XML"
          ? "application/xml"
          : "application/vnd.openxmlformats-package.relationships+xml"
      files["[Content_Types].xml"] = files["[Content_Types].xml"]
        .toString()
        .replace(
          "</Types>",
          `<Override PartName="${name}" ContentType="${type}"/></Types>`
        )
      const bytes = fixtureZip(files)
      const document = await PaperPackage.open(bytes, context)
      expect(document.read().regions[0].kind).toBe("locked")
      expect(document.export()).toEqual(bytes)
    }
  )

  it.each([PACKAGE_LIMITS.targetBytes, PACKAGE_LIMITS.targetBytes + 1])(
    "B5 bounds complete paragraph context at %i bytes",
    async (size) => {
      const text = "é".repeat(Math.floor(size / 2)) + (size % 2 ? "x" : "")
      const document = await PaperPackage.open(
        fixturePackage(
          `<w:p>${run(text.slice(0, 2048))}${run(text.slice(2048))}</w:p>`,
          {}
        ),
        context
      )
      expect(document.read().regions[0].kind).toBe(
        size <= PACKAGE_LIMITS.targetBytes ? "editable" : "locked"
      )
      if (size === PACKAGE_LIMITS.targetBytes) {
        for (const region of document.read().regions) {
          if (region.kind === "editable")
            expect(Buffer.byteLength(region.context.paragraphText)).toBe(size)
        }
      }
    }
  )
})
