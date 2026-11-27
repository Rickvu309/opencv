import { readFile, readdir } from "node:fs/promises"

import type { Block, Run } from "@workspace/domain/paper-doc"
import { describe, expect, it } from "vitest"

import {
  fixturePackage,
  fixtureZip,
  relationship,
} from "../import/package-fixtures.js"
import { readDocx } from "./read-docx.js"
import { writeDocx } from "./write-docx.js"

const corpus = new URL(
  "../../../../../packages/paper-corpus/tests/fixtures/cvs/",
  import.meta.url
)
const cvIds = (await readdir(corpus))
  .filter((name) => name.endsWith(".docx"))
  .map((name) => name.slice(0, -5))
  .sort()

function plainText(runs: Run[] = []) {
  return runs.map((run) => (run.type === "text" ? run.text : "\n")).join("")
}

function summarize(block: Block) {
  switch (block.type) {
    case "text_block": {
      const { kind, list, level, rightTabMpt } = block.attrs
      const links: { text: string; href: string }[] = []
      let active: { text: string; href: string } | undefined
      for (const run of block.content ?? []) {
        if (run.type === "hard_break") {
          active = undefined
          continue
        }
        const link = run.marks?.find((mark) => mark.type === "link")
        if (!link) active = undefined
        else if (active?.href === link.attrs.href) active.text += run.text
        else {
          active = { text: run.text, href: link.attrs.href }
          links.push(active)
        }
      }
      return {
        kind,
        text: plainText(block.content),
        ...(list && { list: { kind: list, level } }),
        ...(links.length > 0 && { links }),
        ...(rightTabMpt && {
          rightTabStop: { positionTwips: rightTabMpt / 50 },
        }),
      }
    }
    case "image":
      return { kind: "image", alt: block.attrs.alt }
    case "table":
      return {
        kind: "table",
        rows: block.content.map((row) =>
          row.content.map((cell) => plainText(cell.content))
        ),
      }
    case "page_break":
      return { kind: "pageBreak" }
    case "divider":
      return { kind: "divider" }
  }
}

describe("a Word CV comes into Paper", () => {
  it("covers the full 20-CV corpus", () => {
    expect(cvIds).toHaveLength(20)
  })

  it.each(cvIds)(
    "reads %s and keeps the same Paper after writing Word",
    async (id) => {
      const expected = JSON.parse(
        await readFile(new URL(`${id}.expected.json`, corpus), "utf8")
      )
      const imported = await readDocx(
        await readFile(new URL(`${id}.docx`, corpus))
      )
      const blocks = imported.document.content.map(summarize)
      expect(blocks).toEqual(expected.blocks)
      expect(imported.document.attrs.page).toEqual({
        size: "A4",
        orientation: "portrait",
        marginsMpt: { top: 56700, right: 56700, bottom: 56700, left: 56700 },
      })
      expect(imported.files.size).toBe(
        blocks.filter((block) => block.kind === "image").length
      )
      const roundTrip = await readDocx(
        writeDocx(imported.document, imported.files)
      )
      expect(roundTrip.document).toEqual(imported.document)
      expect(roundTrip.files).toEqual(imported.files)
      expect(roundTrip.dropped).toEqual([])
      if (
        process.env.OPENCV_WORD_READER_PROOF &&
        ["en-01", "vi-02"].includes(id)
      ) {
        console.log(
          JSON.stringify({
            id,
            kinds: blocks.map((block) => block.kind),
            dropped: imported.dropped,
          })
        )
      }
    }
  )
})

describe("Word features and import notices", () => {
  it("reads style names, marks, and mixed list levels with numbering overrides", async () => {
    const read = await readDocx(
      fixturePackage(
        '<w:p><w:pPr><w:pStyle w:val="Titre"/><w:numPr><w:ilvl w:val="1"/><w:numId w:val="7"/></w:numPr></w:pPr><w:hyperlink r:id="link"><w:r><w:rPr><w:b/><w:i/><w:u w:val="single"/><w:strike/><w:color w:val="FF2233"/><w:rFonts w:ascii="Cambria"/><w:sz w:val="23"/></w:rPr><w:t>Role</w:t></w:r></w:hyperlink></w:p>',
        {
          relationships: [
            relationship("link", "hyperlink", "https://example.com/work", true),
            relationship("num", "numbering", "cv-numbers.xml"),
          ],
          parts: {
            "word/styles.xml":
              '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Titre"><w:name w:val="Title"/></w:style></w:styles>',
            "word/cv-numbers.xml":
              '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="1"><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:lvlOverride></w:num></w:numbering>',
          },
        }
      )
    )
    expect(read.document.content[0]).toMatchObject({
      type: "text_block",
      attrs: { kind: "title", list: "bullet", level: 1 },
      content: [
        {
          type: "text",
          text: "Role",
          marks: [
            { type: "bold" },
            { type: "italic" },
            { type: "underline" },
            { type: "strike" },
            { type: "link", attrs: { href: "https://example.com/work" } },
            { type: "color", attrs: { value: "#ff2233" } },
            { type: "font", attrs: { family: "Liberation Serif" } },
            { type: "size", attrs: { mpt: 11500 } },
          ],
        },
      ],
    })
    expect(read.dropped).toEqual([
      "Cambria was replaced with Liberation Serif.",
    ])
  })

  it("keeps visible field results, reports omissions and leaves unsafe links as text", async () => {
    const read = await readDocx(
      fixturePackage(
        '<w:p><w:commentRangeStart w:id="1"/><w:fldSimple w:instr="PAGE"><w:r><w:t>Page 1</w:t></w:r></w:fldSimple><w:r><w:footnoteReference w:id="1"/><w:pict><w:txbxContent><w:p><w:r><w:t>Hidden text</w:t></w:r></w:p></w:txbxContent></w:pict></w:r><w:hyperlink r:id="unsafe"><w:r><w:t>plain</w:t></w:r></w:hyperlink></w:p>',
        {
          relationships: [
            relationship("unsafe", "hyperlink", "javascript:alert(1)", true),
          ],
        }
      )
    )
    expect(read.document.content.map(summarize)).toEqual([
      { kind: "paragraph", text: "Page 1plain" },
    ])
    expect(read.dropped).toEqual(
      expect.arrayContaining([
        "Comments were left out.",
        "Footnotes were left out.",
        "Text boxes were left out.",
        "Word fields were converted to their displayed text where available.",
        "Some links were left as plain text.",
      ])
    )
  })
})

describe("Word import boundaries", () => {
  it("reads Letter page settings and positive dimensions", async () => {
    const read = await readDocx(
      fixtureZip({
        "word/document.xml":
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/><w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="1440" w:bottom="0" w:left="360"/></w:sectPr></w:body></w:document>',
      })
    )
    expect(read.document.attrs.page).toEqual({
      size: "Letter",
      orientation: "landscape",
      marginsMpt: { top: 36000, right: 72000, bottom: 0, left: 18000 },
    })
    expect(await readDocx(writeDocx(read.document, read.files))).toEqual(read)
  })

  it("rejects entity declarations in a Word part", async () => {
    const input = fixtureZip({
      "word/document.xml":
        '<!DOCTYPE w:document [<!ENTITY repeated "text">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>&repeated;</w:body></w:document>',
    })
    await expect(readDocx(input)).rejects.toThrow("UNSAFE_XML")
  })

  it("keeps the package limit on highly compressed members", async () => {
    const input = fixtureZip({ "word/document.xml": " ".repeat(250_000) })
    await expect(readDocx(input)).rejects.toThrow("ZIP_EXPANSION_LIMIT")
  })

  it("keeps the package input size limit", async () => {
    await expect(readDocx(Buffer.alloc(8 * 1024 * 1024 + 1))).rejects.toThrow(
      "ZIP_INPUT_LIMIT"
    )
  })
})
