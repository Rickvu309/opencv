import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"

import { applyEligibleBytes } from "./package-canvas-eligible.js"
import { fixturePackage, paragraph } from "./package-fixtures.js"
import { paragraphText } from "./package-targets.js"
import { readPackageZip } from "./package-zip.js"
import { descendants, isWord, parsePackageXml } from "./package-xml.js"

function side(count: number) {
  return {
    version: 2 as const,
    paragraphs: Array.from({ length: count }, (_, ordinal) => ({
      key: randomUUID(),
      ordinal,
      textIds: [] as string[],
    })),
  }
}

async function texts(bytes: Uint8Array) {
  const xml = (await readPackageZip(bytes)).files.get("word/document.xml")
  if (!xml) throw new Error("missing document")
  const parsed = parsePackageXml(xml)
  return descendants(parsed.root)
    .filter((node) => isWord(node, "p"))
    .map((node) => paragraphText(node, parsed.source))
}

async function others(left: Uint8Array, right: Uint8Array) {
  const a = (await readPackageZip(left)).files
  const b = (await readPackageZip(right)).files
  const names = [...new Set([...a.keys(), ...b.keys()])]
    .filter((name) => name !== "word/document.xml")
    .sort()
  return names.every((name) => {
    const leftBytes = a.get(name)
    const rightBytes = b.get(name)
    return (
      leftBytes !== undefined &&
      rightBytes !== undefined &&
      leftBytes.equals(rightBytes)
    )
  })
}

describe("eligible imported paragraphs", () => {
  it("splits one ordinary paragraph and leaves the rest of the file", async () => {
    const bytes = fixturePackage(paragraph("Hello"))
    const basis = side(1)
    const applied = applyEligibleBytes(
      bytes,
      { op: "split", paragraph: basis.paragraphs[0].key, at: 2 },
      basis
    )
    expect(applied.status).toBe("APPLIED")
    expect(await texts(applied.bytes)).toEqual(["He", "llo"])
    expect(await others(bytes, applied.bytes)).toBe(true)
    expect(applied.sidecar.paragraphs).toHaveLength(2)
    expect(applied.sidecar.paragraphs[0].key).not.toBe(basis.paragraphs[0].key)
  })

  it("joins two ordinary paragraphs and refuses a paragraph in a table", async () => {
    const bytes = fixturePackage(`${paragraph("He")}${paragraph("llo")}`)
    const basis = side(2)
    const applied = applyEligibleBytes(
      bytes,
      { op: "mergePrevious", paragraph: basis.paragraphs[1].key },
      basis
    )
    expect(applied.status).toBe("APPLIED")
    expect(await texts(applied.bytes)).toEqual(["Hello"])
    const table = fixturePackage(
      "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>"
    )
    const tableSide = side(1)
    const refused = applyEligibleBytes(
      table,
      { op: "split", paragraph: tableSide.paragraphs[0].key, at: 1 },
      tableSide
    )
    expect(refused.status).toBe("REFUSED")
    expect(Buffer.from(refused.bytes).equals(table)).toBe(true)
  })

  it("removes an empty ordinary paragraph and refuses a section mark", async () => {
    const bytes = fixturePackage(`${paragraph("")}${paragraph("Stay")}`)
    const basis = side(2)
    const applied = applyEligibleBytes(
      bytes,
      { op: "deleteParagraph", paragraph: basis.paragraphs[0].key },
      basis
    )
    expect(applied.status).toBe("APPLIED")
    expect(await texts(applied.bytes)).toEqual(["Stay"])
    const marked = fixturePackage(
      "<w:p><w:pPr><w:sectPr/></w:pPr><w:r><w:t>No</w:t></w:r></w:p>"
    )
    const markedSide = side(1)
    const refused = applyEligibleBytes(
      marked,
      { op: "split", paragraph: markedSide.paragraphs[0].key, at: 1 },
      markedSide
    )
    expect(refused.status).toBe("REFUSED")
    expect(Buffer.from(refused.bytes).equals(marked)).toBe(true)
  })

  it("splits two styles and refuses a paragraph mark", async () => {
    const bytes = fixturePackage(
      `${paragraph(
        "Hello",
        '<w:pStyle w:val="Normal"/><w:jc w:val="center"/>'
      )}<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="231F20"/></w:rPr><w:t>Next</w:t></w:r></w:p>`
    )
    const basis = side(2)
    const applied = applyEligibleBytes(
      bytes,
      { op: "split", paragraph: basis.paragraphs[0].key, at: 1 },
      basis
    )
    expect(applied.status).toBe("APPLIED")
    expect(await texts(applied.bytes)).toEqual(["H", "ello", "Next"])
    const marked = [
      fixturePackage(
        paragraph(
          "Hello",
          '<w:pPrChange w:id="2"><w:pPr><w:pStyle w:val="Normal"/></w:pPr></w:pPrChange>'
        )
      ),
      fixturePackage(
        paragraph(
          "Hello",
          '<w:rPr><w:rPrChange w:id="1" w:author="A" w:date="2020-01-01T00:00:00Z"><w:rPr/></w:rPrChange></w:rPr><w:pPrChange w:id="2" w:author="A" w:date="2020-01-01T00:00:00Z"><w:pPr><w:pStyle w:val="Normal"/></w:pPr></w:pPrChange>'
        )
      ),
      fixturePackage(
        '<w:p><w:r><w:rPr><w:rFonts w:ascii="Calibri"/><w:rPrChange w:id="1"><w:rPr/></w:rPrChange></w:rPr><w:t>Hello</w:t></w:r></w:p>'
      ),
    ]
    for (const source of marked) {
      const markedSide = side(1)
      const refused = applyEligibleBytes(
        source,
        { op: "split", paragraph: markedSide.paragraphs[0].key, at: 1 },
        markedSide
      )
      expect(refused.status).toBe("REFUSED")
      expect(Buffer.from(refused.bytes).equals(source)).toBe(true)
    }
  })

  it("refuses a comment in the run or its properties", () => {
    for (const body of [
      "<w:p><w:r><w:rPr><w:b/></w:rPr><!--x--><w:t>Hello</w:t></w:r></w:p>",
      "<w:p><w:r><w:rPr><!--x--><w:b/></w:rPr><w:t>Hello</w:t></w:r></w:p>",
    ]) {
      const bytes = fixturePackage(body)
      const basis = side(1)
      const refused = applyEligibleBytes(
        bytes,
        { op: "split", paragraph: basis.paragraphs[0].key, at: 1 },
        basis
      )
      expect(refused.status).toBe("REFUSED")
      expect(Buffer.from(refused.bytes).equals(bytes)).toBe(true)
    }
  })

  it("refuses an opaque text node", () => {
    const bytes = fixturePackage(
      "<w:p><w:r><w:t>He<!--x-->llo</w:t></w:r></w:p>"
    )
    const basis = side(1)
    const refused = applyEligibleBytes(
      bytes,
      { op: "split", paragraph: basis.paragraphs[0].key, at: 1 },
      basis
    )
    expect(refused.status).toBe("REFUSED")
    expect(Buffer.from(refused.bytes).equals(bytes)).toBe(true)
  })

  it("refuses an opaque paragraph property", () => {
    const bytes = fixturePackage(
      "<w:p><w:pPr><!--x--></w:pPr><w:r><w:t>Hello</w:t></w:r></w:p>"
    )
    const basis = side(1)
    const refused = applyEligibleBytes(
      bytes,
      { op: "split", paragraph: basis.paragraphs[0].key, at: 1 },
      basis
    )
    expect(refused.status).toBe("REFUSED")
    expect(Buffer.from(refused.bytes).equals(bytes)).toBe(true)
  })
})
