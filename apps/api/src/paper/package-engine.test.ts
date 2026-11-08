import { describe, expect, it } from "vitest"
import { PaperPackage } from "./package-engine.js"
import { fixturePackage, paragraph, run } from "./package-fixtures.js"
import { witnessArchive } from "./package-witness.js"
import { paragraphText } from "./package-targets.js"
import { parsePackageXml } from "./package-xml.js"

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
      const witness = witnessArchive(candidate.export())
      const expected = witnessArchive(
        fixturePackage(paragraph(expectedXml) + tail)
      )
      expect(witness.get("word/document.xml")?.bytes).toEqual(
        expected.get("word/document.xml")?.bytes
      )
      for (const [name, part] of witnessArchive(bytes)) {
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
    expect(mainXml(spaced.export()).toString()).toContain(
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
    const original = witnessArchive(bytes)
    const changed = witnessArchive(candidate.export())
    expect(changed.get("archive/opaque.xml")).toEqual(
      original.get("archive/opaque.xml")
    )
    expect(changed.size).toBe(original.size)
    expect(mainXml(candidate.export()).toString()).toContain(
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
        mainXml(bytes).toString().replace("Welcome ", "Request ")
      )
      expect(
        witnessArchive(candidate.export()).get("word/document.xml")?.bytes
      ).toEqual(expected)
      expect(
        witnessArchive(candidate.export())
          .get("word/document.xml")
          ?.bytes.toString()
      ).toContain(following)
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
    expect(
      witnessArchive(candidate.export()).get("word/document.xml")?.bytes
    ).toEqual(
      witnessArchive(
        fixturePackage(
          `<w:p>${run("first", "<w:b/>")}${run("second", "<w:i/>")}</w:p>${tail}`
        )
      ).get("word/document.xml")?.bytes
    )
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
    expect(
      witnessArchive(candidate.export()).get("word/document.xml")?.bytes
    ).toEqual(
      Buffer.from(mainXml(bytes).toString().replace(" A&#160;", " C&#160;"))
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
    expect(
      witnessArchive(candidate.export()).get("word/document.xml")?.bytes
    ).toEqual(
      Buffer.from(mainXml(bytes).toString().replace("Start-Ups", "Startups"))
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
