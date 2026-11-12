import { describe, expect, it } from "vitest"
import { PaperPackage } from "./package-engine.js"
import {
  fixturePackage,
  paragraph,
  relationship,
  run,
  packageMember,
} from "./package-fixtures.js"
import { readPackageZip } from "./package-zip.js"

const context = {
  docId: "cv",
  incarnation: "import-one",
  revision: "revision-one",
}

const tail = paragraph("untouched")

function linked(history = "") {
  const attribute = history ? ` w:history="${history}"` : ""
  return fixturePackage(
    `<w:p>${run("plain")}<w:hyperlink r:id="link"${attribute}>${run("linked")}</w:hyperlink></w:p>${tail}`,
    {
      relationships: [
        relationship(
          "link",
          "hyperlink",
          "https://example.invalid/private",
          true
        ),
      ],
    }
  )
}

async function open(bytes: Buffer) {
  return PaperPackage.open(bytes, context)
}

function regions(document: PaperPackage) {
  return document.read().regions
}

function code(document: PaperPackage, text: string) {
  const region = regions(document).find((region) => region.text === text)
  if (!region || region.kind !== "locked")
    throw new Error(`Missing locked region ${text}`)
  return region.reason.code
}

function edit(document: PaperPackage, before: string, after: string) {
  const region = regions(document).find(
    (region) => region.kind === "editable" && region.text === before
  )
  if (!region || region.kind !== "editable")
    throw new Error(`Missing editable region ${before}`)
  return {
    docId: context.docId,
    basedOn: document.read().revision,
    edits: [
      {
        op: "replaceText" as const,
        targetId: region.targetId,
        before,
        after,
      },
    ],
  }
}

async function mainXml(bytes: Buffer) {
  return (
    (await readPackageZip(bytes)).files.get("word/document.xml")?.toString() ??
    ""
  )
}

describe("spans beside a preserved neighbor or a proofing mark", () => {
  it("replaces one ordinary run beside an external link and keeps the link", async () => {
    const bytes = linked("")
    const document = await open(bytes)
    expect(
      regions(document).find((region) => region.text === "plain")?.kind
    ).toBe("editable")
    expect(code(document, "linked")).toBe("PRESERVED_NEIGHBOR")
    const candidate = (
      await document.prepare(edit(document, "plain", "changed"))
    ).package
    expect(await mainXml(candidate.export())).toContain(
      `<w:hyperlink r:id="link">${run("linked")}</w:hyperlink>`
    )
    expect(await mainXml(candidate.export())).toContain(run("changed"))
    expect(
      await packageMember(candidate.export(), "word/_rels/document.xml.rels")
    ).toEqual(await packageMember(bytes, "word/_rels/document.xml.rels"))
  })

  it("allows a history value of 1 on that link", async () => {
    const document = await open(linked("1"))
    expect(
      regions(document).find((region) => region.text === "plain")?.kind
    ).toBe("editable")
    expect(code(document, "linked")).toBe("PRESERVED_NEIGHBOR")
  })

  it("locks the paragraph when the link history is not a known value", async () => {
    const document = await open(linked("maybe"))
    expect(
      regions(document).some(
        (region) => region.kind === "editable" && region.text === "plain"
      )
    ).toBe(false)
    expect(code(document, "plainlinked")).toBe("UNSUPPORTED_TARGET_PROPERTY")
    expect(
      regions(document).find((region) => region.text === "untouched")?.kind
    ).toBe("editable")
  })

  it("locks the package when the link id is missing", async () => {
    const document = await open(
      fixturePackage(
        `<w:p>${run("plain")}<w:hyperlink r:id="missing">${run("linked")}</w:hyperlink></w:p>${tail}`
      )
    )
    expect(code(document, "plainlinked")).toBe("DANGLING_RELATIONSHIP")
    expect(code(document, "untouched")).toBe("DANGLING_RELATIONSHIP")
  })

  it("locks the paragraph when the link has an unknown attribute", async () => {
    const document = await open(
      fixturePackage(
        `<w:p>${run("plain")}<w:hyperlink r:id="link" w:tooltip="x">${run("linked")}</w:hyperlink></w:p>${tail}`,
        {
          relationships: [
            relationship(
              "link",
              "hyperlink",
              "https://example.invalid/private",
              true
            ),
          ],
        }
      )
    )
    expect(code(document, "plainlinked")).toBe("UNSUPPORTED_TARGET_PROPERTY")
  })

  it("locks an internal anchor paragraph and leaves the next paragraph editable", async () => {
    const document = await open(
      fixturePackage(
        `<w:p><w:bookmarkStart w:id="1" w:name="dest"/>${run("kept")}<w:bookmarkEnd w:id="1"/></w:p><w:p><w:hyperlink w:anchor="dest">${run("linked")}</w:hyperlink>${run("plain")}</w:p>${tail}`
      )
    )
    expect(code(document, "kept")).toBe("UNSUPPORTED_TARGET_PROPERTY")
    expect(code(document, "linkedplain")).toBe("UNSUPPORTED_TARGET_PROPERTY")
    expect(
      regions(document).some(
        (region) => region.kind === "editable" && region.text === "plain"
      )
    ).toBe(false)
    expect(
      regions(document).find((region) => region.text === "untouched")?.kind
    ).toBe("editable")
  })

  it("locks every paragraph when a known link target is missing", async () => {
    const document = await open(
      fixturePackage(`${paragraph("kept")}${tail}`, {
        relationships: [relationship("gone", "hyperlink", "missing.xml")],
      })
    )
    expect(regions(document).map((region) => region.kind)).toEqual([
      "locked",
      "locked",
    ])
    expect(code(document, "kept")).toBe("DANGLING_RELATIONSHIP")
    expect(code(document, "untouched")).toBe("DANGLING_RELATIONSHIP")
  })

  it("locks every paragraph when the same link id is declared twice", async () => {
    const document = await open(
      fixturePackage(`${paragraph("kept")}${tail}`, {
        relationships: [
          relationship("link", "hyperlink", "https://example.invalid/a", true),
          relationship("link", "hyperlink", "https://example.invalid/b", true),
        ],
      })
    )
    expect(code(document, "kept")).toBe("UNPROVEN_RELATIONSHIP")
    expect(code(document, "untouched")).toBe("UNPROVEN_RELATIONSHIP")
  })

  it("replaces the run after a line break and keeps the break", async () => {
    const brake = `<w:r><w:rPr><w:i/></w:rPr><w:br/></w:r>`
    const document = await open(
      fixturePackage(
        `<w:p>${run("first")}${brake}${run("second")}</w:p>${tail}`
      )
    )
    expect(code(document, "\n")).toBe("PRESERVED_NEIGHBOR")
    expect(
      regions(document).find((region) => region.text === "second")?.kind
    ).toBe("editable")
    const candidate = (
      await document.prepare(edit(document, "second", "changed"))
    ).package
    const xml = await mainXml(candidate.export())
    expect(xml).toContain(brake)
    expect(xml).toContain(run("first"))
    expect(xml).toContain(run("changed"))
  })

  it("locks a page break for the whole paragraph", async () => {
    const document = await open(
      fixturePackage(
        `<w:p>${run("plain")}<w:r><w:br w:type="page"/></w:r></w:p>${tail}`
      )
    )
    expect(code(document, "plain\n")).toBe("UNSUPPORTED_TARGET_PROPERTY")
    expect(
      regions(document).some(
        (region) => region.kind === "editable" && region.text === "plain"
      )
    ).toBe(false)
    expect(
      regions(document).find((region) => region.text === "untouched")?.kind
    ).toBe("editable")
  })

  it("replaces a run outside a grammar mark and keeps the mark", async () => {
    const marked = `<w:proofErr w:type="gramStart"/>${run("marked")}<w:proofErr w:type="gramEnd"/>`
    const document = await open(
      fixturePackage(`<w:p>${marked}${run("plain")}</w:p>${tail}`)
    )
    expect(code(document, "marked")).toBe("PROOFING_RANGE")
    expect(
      regions(document).find((region) => region.text === "plain")?.kind
    ).toBe("editable")
    const xml = await mainXml(
      (
        await document.prepare(edit(document, "plain", "changed"))
      ).package.export()
    )
    expect(xml).toContain(marked)
    expect(xml).toContain(run("changed"))
    expect(xml).not.toContain(run("plain"))
  })

  it("keeps a run inside overlapping spelling and grammar marks locked", async () => {
    const document = await open(
      fixturePackage(
        `<w:p><w:proofErr w:type="gramStart"/><w:proofErr w:type="spellStart"/>${run("both")}<w:proofErr w:type="spellEnd"/><w:proofErr w:type="gramEnd"/>${run("plain")}</w:p>${tail}`
      )
    )
    expect(code(document, "both")).toBe("PROOFING_RANGE")
    expect(
      regions(document).some(
        (region) => region.kind === "editable" && region.text === "both"
      )
    ).toBe(false)
    expect(
      regions(document).find((region) => region.text === "plain")?.kind
    ).toBe("editable")
  })

  it("locks only the paragraph that holds an unmatched grammar mark", async () => {
    const document = await open(
      fixturePackage(
        `<w:p><w:proofErr w:type="gramEnd"/>${run("one")}</w:p>${paragraph("two")}`
      )
    )
    expect(code(document, "one")).toBe("UNRESOLVED_PROOFING")
    expect(
      regions(document).some(
        (region) => region.kind === "editable" && region.text === "one"
      )
    ).toBe(false)
    expect(
      regions(document).find((region) => region.text === "two")?.kind
    ).toBe("editable")
  })

  it("locks both paragraphs when a grammar mark crosses them", async () => {
    const document = await open(
      fixturePackage(
        `<w:p><w:proofErr w:type="gramStart"/>${run("one")}</w:p><w:p>${run("two")}<w:proofErr w:type="gramEnd"/></w:p>${paragraph("three")}`
      )
    )
    expect(code(document, "one")).toBe("UNRESOLVED_PROOFING")
    expect(code(document, "two")).toBe("UNRESOLVED_PROOFING")
    expect(
      regions(document).find((region) => region.text === "three")?.kind
    ).toBe("editable")
  })

  it("locks a paragraph with two grammar starts", async () => {
    const document = await open(
      fixturePackage(
        `<w:p><w:proofErr w:type="gramStart"/><w:proofErr w:type="gramStart"/>${run("one")}<w:proofErr w:type="gramEnd"/></w:p>${tail}`
      )
    )
    expect(code(document, "one")).toBe("UNRESOLVED_PROOFING")
    expect(
      regions(document).find((region) => region.text === "untouched")?.kind
    ).toBe("editable")
  })

  it("locks a proof mark inside a run", async () => {
    const document = await open(
      fixturePackage(
        `<w:p><w:r><w:proofErr w:type="gramStart"/><w:t>one</w:t></w:r></w:p>${tail}`
      )
    )
    expect(code(document, "one")).toBe("UNSUPPORTED_TARGET_PROPERTY")
  })

  it("locks an unknown proof mark type", async () => {
    const document = await open(
      fixturePackage(
        `<w:p><w:proofErr w:type="grammar"/>${run("one")}</w:p>${tail}`
      )
    )
    expect(code(document, "one")).toBe("UNSUPPORTED_TARGET_PROPERTY")
    expect(
      regions(document).find((region) => region.text === "untouched")?.kind
    ).toBe("editable")
  })

  it("does not merge two runs that carry the same properties", async () => {
    const bold = run("left", "<w:b/>")
    const document = await open(
      fixturePackage(`<w:p>${bold}${run("right", "<w:b/>")}</w:p>${tail}`)
    )
    expect(
      regions(document).filter((region) => region.kind === "editable")
    ).toHaveLength(3)
    const xml = await mainXml(
      (
        await document.prepare(edit(document, "left", "changed"))
      ).package.export()
    )
    expect(xml).toContain(run("changed", "<w:b/>"))
    expect(xml).toContain(run("right", "<w:b/>"))
    expect(xml.match(/<w:b\/>/g)).toHaveLength(2)
  })
})
