import { describe, expect, it, vi } from "vitest"
import { PaperPackage } from "./package-engine.js"
import {
  fixturePackage,
  fixtureFiles,
  fixtureZip,
  paragraph,
  run,
  story,
  relationship,
} from "./package-fixtures.js"
import { readPackageZip } from "./package-zip.js"
import { paragraphText } from "./package-targets.js"
import { parsePackageXml } from "./package-xml.js"
import * as packageXml from "./package-xml.js"

const context = {
  docId: "cv",
  incarnation: "import-one",
  revision: "revision-one",
}

const tail = paragraph("untouched")

async function files(bytes: Buffer) {
  return (await readPackageZip(bytes)).files
}

async function mainXml(bytes: Buffer) {
  const part = (await files(bytes)).get("word/document.xml")
  if (!part) throw new Error("Missing main document part")
  return part
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

describe("immutable Word package replacement", () => {
  it.each([
    ["ordinary text", "alpha", "aXpha", "aXpha"],
    ["XML escapes", "A &amp; B", 'A < B & "C"', 'A &lt; B &amp; "C"'],
    ["Unicode and repeated space", "one  two&#160;three", "👩🏽‍💻  é é", "👩🏽‍💻  é é"],
    ["empty retained text", "alpha", "", ""],
  ])(
    "preserves the independent XML reference and ZIP records: %s",
    async (_, beforeXml, after, expectedXml) => {
      const body = paragraph(beforeXml) + tail
      const bytes = fixturePackage(body)
      const original = await PaperPackage.open(bytes, context)
      const before = original.read().regions[0].text
      const candidate = (await original.prepare(edit(original, before, after)))
        .package
      const witness = await files(candidate.export())
      const expected = await files(
        fixturePackage(paragraph(expectedXml) + tail)
      )
      expect(witness.get("word/document.xml")).toEqual(
        expected.get("word/document.xml")
      )
      for (const [name, part] of await files(bytes)) {
        if (name !== "word/document.xml")
          expect(witness.get(name)).toEqual(part)
      }
      expect(original.export()).toEqual(bytes)
      expect(candidate.sidecar().paragraphs).toEqual(
        original.sidecar().paragraphs
      )
      const { docId, incarnation, revision } = candidate.read()
      const reopened = await PaperPackage.open(
        candidate.export(),
        { docId, incarnation, revision },
        candidate.sidecar()
      )
      expect(reopened.read()).toEqual(candidate.read())
    }
  )

  it("adds required space preservation while refusing empty selections and refill", async () => {
    const document = await PaperPackage.open(
      fixturePackage(paragraph("alpha") + tail),
      context
    )
    const spaced = (await document.prepare(edit(document, "alpha", " next ")))
      .package
    expect((await mainXml(spaced.export())).toString()).toContain(
      '<w:t xml:space="preserve"> next </w:t>'
    )
    const empty = (await document.prepare(edit(document, "alpha", ""))).package
    expect(empty.read().regions[0].kind).toBe("locked")
    expect(empty.sidecar().paragraphs).toEqual(document.sidecar().paragraphs)
    const request = edit(document, "alpha", "changed")
    await unchangedRefusal(document, {
      ...request,
      edits: [{ ...request.edits[0], before: "" }],
    })
  })

  it("carries an unreachable opaque part byte-identically through a text edit", async () => {
    const bytes = fixturePackage(paragraph("alpha") + tail, {
      parts: {
        "archive/opaque.xml": '<opaque xmlns="urn:unreached">retained</opaque>',
      },
    })
    const document = await PaperPackage.open(bytes, context)
    const candidate = (
      await document.prepare(edit(document, "alpha", "changed"))
    ).package
    const original = await files(bytes)
    const changed = await files(candidate.export())
    expect(changed.get("archive/opaque.xml")).toEqual(
      original.get("archive/opaque.xml")
    )
    expect(changed.size).toBe(original.size)
    expect((await mainXml(candidate.export())).toString()).toContain(
      "<w:t>changed</w:t>"
    )
  })

  it("retains a self-closing empty text node and its paragraph key without exposing insertion", async () => {
    const bytes = fixturePackage("<w:p><w:r><w:t/></w:r></w:p>" + tail)
    const document = await PaperPackage.open(bytes, context)
    expect(document.read().regions[0].kind).toBe("locked")
    expect(document.export()).toEqual(bytes)
    expect(
      (await PaperPackage.open(bytes, context, document.sidecar())).sidecar()
    ).toEqual(document.sidecar())
  })

  it("exports an unedited or no-op archive byte for byte", async () => {
    const bytes = fixturePackage(paragraph("alpha"))
    const document = await PaperPackage.open(bytes, context)
    expect(document.export()).toEqual(bytes)
    expect(
      (
        await document.prepare(edit(document, "alpha", "alpha"))
      ).package.export()
    ).toEqual(bytes)
    const copy = document.export()
    copy.fill(0)
    expect(document.export()).toEqual(bytes)
  })

  it("binds duplicate text to distinct targets and preserves the other occurrence", async () => {
    const document = await PaperPackage.open(
      fixturePackage(paragraph("same") + paragraph("same")),
      context
    )
    expect(editable(document, "same").targetId).not.toBe(
      editable(document, "same", 1).targetId
    )
    const candidate = (
      await document.prepare(edit(document, "same", "changed", 1))
    ).package
    expect(candidate.read().regions.map((region) => region.text)).toEqual([
      "same",
      "changed",
    ])
  })

  it("edits a single ordinary paragraph in a simple table cell", async () => {
    const bytes = fixturePackage(
      `<w:tbl><w:tr><w:tc><w:tcPr/>${paragraph("cell")}</w:tc></w:tr></w:tbl>${tail}`
    )
    const document = await PaperPackage.open(bytes, context)
    const candidate = (
      await document.prepare(edit(document, "cell", "changed"))
    ).package
    expect(candidate.read().regions.map((region) => region.text)).toEqual([
      "changed",
      "untouched",
    ])
  })

  it.each(["<w:i/>", "<w:b/>"])(
    "exposes separate run targets without merging their formatting: %s",
    async (followingProperties) => {
      const following = run("bold ending", followingProperties)
      const bytes = fixturePackage(
        `<w:p>${run("Welcome ", "<w:b/>")}${following}</w:p>${tail}`
      )
      const document = await PaperPackage.open(bytes, context)
      const target = editable(document, "Welcome ")
      expect(target.context.paragraphText).toBe("Welcome bold ending")
      expect(target.targetId).not.toBe(
        editable(document, "bold ending").targetId
      )
      const candidate = (
        await document.prepare(edit(document, "Welcome ", "Request "))
      ).package
      const expected = Buffer.from(
        (await mainXml(bytes)).toString().replace("Welcome ", "Request ")
      )
      const candDoc = (await files(candidate.export())).get("word/document.xml")
      expect(candDoc).toEqual(expected)
      expect(candDoc?.toString()).toContain(following)
      expect(document.export()).toEqual(bytes)
    }
  )

  it("checks both replacements in one paragraph and retains repeated-text identity", async () => {
    const bytes = fixturePackage(
      `<w:p>${run("same", "<w:b/>")}${run("same", "<w:i/>")}</w:p>${tail}`
    )
    const document = await PaperPackage.open(bytes, context)
    const first = edit(document, "same", "first")
    const second = edit(document, "same", "second", 1)
    const candidate = (
      await document.prepare({
        ...first,
        edits: [...first.edits, ...second.edits],
      })
    ).package
    expect(candidate.read().regions.map((region) => region.text)).toEqual([
      "first",
      "second",
      "untouched",
    ])
    const candDoc = (await files(candidate.export())).get("word/document.xml")
    const expectedDoc = (
      await files(
        fixturePackage(
          `<w:p>${run("first", "<w:b/>")}${run("second", "<w:i/>")}</w:p>${tail}`
        )
      )
    ).get("word/document.xml")
    expect(candDoc).toEqual(expectedDoc)
    expect(candidate.sidecar().paragraphs).toEqual(
      document.sidecar().paragraphs
    )
    await unchangedRefusal(document, {
      ...first,
      edits: [{ ...first.edits[0], before: "samesame" }],
    })
    const partial = (
      await document.prepare({
        ...first,
        edits: [{ ...first.edits[0], before: "sam", after: "new" }],
      })
    ).package
    expect(partial.read().regions.map((region) => region.text)).toEqual([
      "newe",
      "same",
      "untouched",
    ])
  })

  it("preserves encoded unchanged text and Unicode scalar boundaries inside the target", async () => {
    const bytes = fixturePackage(
      paragraph("&#128105;&#127997;‍💻 A&#160;&amp;B e&#769;")
    )
    const document = await PaperPackage.open(bytes, context)
    const candidate = (
      await document.prepare(edit(document, "👩🏽‍💻 A &B é", "👩🏽‍💻 C &B é"))
    ).package
    expect((await files(candidate.export())).get("word/document.xml")).toEqual(
      Buffer.from(
        (await mainXml(bytes)).toString().replace(" A&#160;", " C&#160;")
      )
    )
  })

  it("keeps a tab-stop setting out of the target text and replaces the exact CV18 wording", async () => {
    const before = "President and CEO: Manufacturing Start-Ups and Turnarounds "
    const after = "President and CEO: Manufacturing Startups and Turnarounds "
    const properties = '<w:tabs><w:tab w:val="left" w:pos="9360"/></w:tabs>'
    const bytes = fixturePackage(paragraph(before, properties) + tail)
    const document = await PaperPackage.open(bytes, context)
    expect(document.read().regions[0].text).toBe(before)
    const candidate = (await document.prepare(edit(document, before, after)))
      .package
    expect(candidate.read().regions[0].text).toBe(after)
    expect((await files(candidate.export())).get("word/document.xml")).toEqual(
      Buffer.from(
        (await mainXml(bytes)).toString().replace("Start-Ups", "Startups")
      )
    )
  })

  it("distinguishes tab-stop settings from actual tabs and breaks", () => {
    const xml =
      '<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:pPr><w:tabs><w:tab w:pos="9360"/></w:tabs></w:pPr><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t><w:br/><w:t>C</w:t></w:r><w:del><w:r><w:t>deleted</w:t></w:r></w:del><w:moveFrom><w:r><w:t>moved</w:t></w:r></w:moveFrom><w:p><w:r><w:t>nested</w:t></w:r></w:p></w:p>'
    const part = parsePackageXml(Buffer.from(xml))
    expect(paragraphText(part.root, part.source)).toBe("A\tB\nC")
  })

  it.each([
    "stale",
    "foreign document",
    "foreign target",
    "duplicate target",
    "wrong before",
    "normalization",
    "newlines",
    "surrogate",
    "bidi",
    "operation",
    "partial batch",
  ])("refuses the whole batch unchanged: %s", async (failure) => {
    const document = await PaperPackage.open(
      fixturePackage(paragraph("é") + tail),
      context
    )
    const request = edit(document, "é", "changed")
    let input: unknown = request
    if (failure === "stale") request.basedOn = "older"
    if (failure === "foreign document") request.docId = "other"
    if (failure === "foreign target") {
      const other = await PaperPackage.open(document.export(), {
        ...context,
        incarnation: "other-import",
      })
      request.edits[0].targetId = editable(other, "é").targetId
    }
    if (failure === "duplicate target")
      request.edits.push({ ...request.edits[0] })
    if (failure === "wrong before") request.edits[0].before = "wrong"
    if (failure === "normalization") request.edits[0].before = "é"
    if (failure === "newlines") request.edits[0].after = "line\nbreak"
    if (failure === "surrogate") request.edits[0].after = "\ud800"
    if (failure === "bidi") request.edits[0].after = "changed\u202e"
    if (failure === "operation")
      input = {
        ...request,
        edits: [{ ...request.edits[0], op: "deleteBlock" }],
      }
    if (failure === "partial batch")
      request.edits.push({
        ...request.edits[0],
        targetId: editable(document, "untouched").targetId,
        before: "wrong",
      })
    await unchangedRefusal(document, input)
  })

  it("does not let old targets address a new revision, even after identical bytes return", async () => {
    const original = await PaperPackage.open(
      fixturePackage(paragraph("alpha")),
      context
    )
    const changed = (await original.prepare(edit(original, "alpha", "beta")))
      .package
    const restored = (await changed.prepare(edit(changed, "beta", "alpha")))
      .package
    expect(restored.read().revision).not.toBe(original.read().revision)
    await unchangedRefusal(restored, edit(original, "alpha", "stale"))
  })

  it("rejects a sidecar from another package or document", async () => {
    const bytes = fixturePackage(paragraph("alpha"))
    const document = await PaperPackage.open(bytes, context)
    await expect(
      PaperPackage.open(
        fixturePackage(paragraph("beta")),
        context,
        document.sidecar()
      )
    ).rejects.toThrow("SIDECAR_MAPPING_MISMATCH")
    await expect(
      PaperPackage.open(
        bytes,
        { ...context, docId: "other" },
        document.sidecar()
      )
    ).rejects.toThrow("SIDECAR_MAPPING_MISMATCH")
  })
})

describe("style closure work", () => {
  it("indexes style and numbering definitions once per package", async () => {
    const count = 96
    const definitions = Array.from(
      { length: count },
      (_, i) => `<w:style w:type="paragraph" w:styleId="S${i}"/>`
    ).join("")
    const numbers = Array.from(
      { length: count },
      (_, i) =>
        `<w:num w:numId="${i + 1}"><w:abstractNumId w:val="${i + 1}"/></w:num><w:abstractNum w:abstractNumId="${i + 1}"><w:lvl w:ilvl="0"/></w:abstractNum>`
    ).join("")
    const body = Array.from({ length: 64 }, (_, i) =>
      paragraph(
        `target${i}`,
        '<w:pStyle w:val="S95"/><w:numPr><w:numId w:val="96"/><w:ilvl w:val="0"/></w:numPr>'
      )
    ).join("")
    const files = fixtureFiles(body, {
      parts: {
        "word/styles.xml": story("styles", definitions),
        "word/numbering.xml": story("numbering", numbers),
      },
      relationships: [relationship("numbering", "numbering", "numbering.xml")],
    })
    files["[Content_Types].xml"] = files["[Content_Types].xml"]
      .toString()
      .replace(
        "</Types>",
        '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>'
      )
    const spy = vi.spyOn(packageXml, "wordAttribute")
    try {
      const document = await PaperPackage.open(fixtureZip(files), context)
      expect(document.read().regions[0]).toMatchObject({ kind: "editable" })
      expect(
        document.read().regions.filter((region) => region.kind === "editable")
      ).toHaveLength(64)
      const scans = spy.mock.calls.filter(
        ([node, name]) =>
          (node.local === "style" && name === "styleId") ||
          (node.local === "num" && name === "numId") ||
          (node.local === "abstractNum" && name === "abstractNumId")
      )
      expect(scans.length).toBeLessThanOrEqual(count * 8)
    } finally {
      spy.mockRestore()
    }
  })

  it("checks inherited style and default trees once including refused closures", async () => {
    const definitions = Array.from(
      { length: 32 },
      (_, i) =>
        `<w:style w:type="paragraph" w:styleId="S${i}">${i ? `<w:basedOn w:val="S${i - 1}"/>` : ""}<w:rPr>${"<w:b/>".repeat(16)}</w:rPr></w:style>`
    ).join("")
    const styles = story(
      "styles",
      definitions +
        '<w:style w:type="paragraph" w:styleId="Bad"><w:rPrChange/></w:style><w:docDefaults><w:rPrDefault><w:rPr><w:b/></w:rPr></w:rPrDefault></w:docDefaults>'
    )
    const body = Array.from(
      { length: 32 },
      (_, i) =>
        paragraph(`target${i}`, '<w:pStyle w:val="S31"/>') +
        paragraph(`locked${i}`, '<w:pStyle w:val="Bad"/>')
    ).join("")
    const spy = vi.spyOn(packageXml, "descendants")
    try {
      const document = await PaperPackage.open(
        fixturePackage(body, { parts: { "word/styles.xml": styles } }),
        context
      )
      expect(
        document.read().regions.filter((region) => region.kind === "editable")
      ).toHaveLength(32)
      expect(
        document.read().regions.filter((region) => region.kind === "locked")
      ).toHaveLength(32)
      const scans = spy.mock.calls.filter(([node]) =>
        ["style", "docDefaults"].includes(node.local)
      )
      expect(scans.length).toBeLessThanOrEqual(36)
    } finally {
      spy.mockRestore()
    }
  })
})

describe("cached dependency refusals", () => {
  it.each([
    ["missing", "", "UNPROVEN_STYLE"],
    [
      "duplicate",
      '<w:style w:type="paragraph" w:styleId="Bad"/><w:style w:type="paragraph" w:styleId="Bad"/>',
      "UNPROVEN_STYLE",
    ],
    [
      "wrong type",
      '<w:style w:type="character" w:styleId="Bad"/>',
      "UNPROVEN_STYLE",
    ],
    [
      "cycle",
      '<w:style w:type="paragraph" w:styleId="Bad"><w:basedOn w:val="Bad"/></w:style>',
      "UNPROVEN_STYLE",
    ],
    [
      "theme",
      '<w:style w:type="paragraph" w:styleId="Bad"><w:rPr><w:rFonts w:asciiTheme="majorAscii"/></w:rPr></w:style>',
      "UNPROVEN_THEME",
    ],
    [
      "numbering",
      '<w:style w:type="paragraph" w:styleId="Bad"><w:pPr><w:numPr><w:numId w:val="1"/><w:ilvl w:val="0"/></w:numPr></w:pPr></w:style>',
      "UNPROVEN_NUMBERING",
    ],
  ])(
    "retains %s refusal without contaminating another target or package",
    async (_, bad, code) => {
      const normal = '<w:style w:type="paragraph" w:styleId="Normal"/>'
      const body = Array.from(
        { length: 8 },
        () => paragraph("blocked", '<w:pStyle w:val="Bad"/>') + tail
      ).join("")
      const document = await PaperPackage.open(
        fixturePackage(body, {
          parts: { "word/styles.xml": story("styles", normal + bad) },
        }),
        context
      )
      expect(
        document
          .read()
          .regions.map((region) =>
            region.kind === "locked" ? region.reason.code : "editable"
          )
      ).toEqual(Array.from({ length: 8 }, () => [code, "editable"]).flat())
      const clean = await PaperPackage.open(
        fixturePackage(body, {
          parts: {
            "word/styles.xml": story(
              "styles",
              normal + '<w:style w:type="paragraph" w:styleId="Bad"/>'
            ),
          },
        }),
        context
      )
      expect(
        clean.read().regions.every((region) => region.kind === "editable")
      ).toBe(true)
    }
  )
})
