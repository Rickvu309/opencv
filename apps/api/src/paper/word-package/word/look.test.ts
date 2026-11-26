import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  cvPackage,
  fixtureFiles,
  fixtureZip,
  paragraph,
  run,
  story,
} from "../../package-fixtures.js"
import { paragraphsOf, projectParagraphs } from "./classify.js"

const styles = story(
  "styles",
  [
    ["Normal", "Normal"],
    ["Title", "Title"],
    ["Heading1", "heading 1"],
    ["Kop2", "heading 2"],
    ["ListBullet", "List Bullet"],
  ]
    .map(
      ([id, name]) =>
        `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/></w:style>`
    )
    .join("")
)

const numbering = story(
  "numbering",
  '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>' +
    '<w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="lowerLetter"/></w:lvl></w:abstractNum>' +
    '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>'
)

function listed(num: number, level: number, text: string) {
  return paragraph(
    text,
    `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${num}"/></w:numPr>`
  )
}

function read(body: string, withParts = true) {
  const bytes = withParts
    ? fixtureZip(
        fixtureFiles(body, {
          parts: {
            "word/styles.xml": styles,
            "word/numbering.xml": numbering,
          },
        })
      )
    : cvPackage(body)
  const keys = paragraphsOf(bytes).map(() => randomUUID())
  const paragraphs = projectParagraphs(bytes, keys)
  if (!paragraphs) throw new Error("projection refused")
  return paragraphs
}

describe("the Word page read carries what the page needs to draw a line", () => {
  it("marks bold, italic and underlined pieces and leaves plain pieces bare", () => {
    const [line] = read(
      `<w:p>${run("Led ")}${run("data", "<w:b/>")}${run(" work", "<w:i/>")}${run(" here", '<w:u w:val="single"/>')}${run(" off", '<w:b w:val="0"/><w:u w:val="none"/>')}${run(" all", "<w:b/><w:i/><w:u/>")}</w:p>`
    )
    expect(line?.text).toBe("Led data work here off all")
    expect(line?.pieces).toEqual([
      { text: "Led ", editable: true },
      { text: "data", editable: true, marks: ["bold"] },
      { text: " work", editable: true, marks: ["italic"] },
      { text: " here", editable: true, marks: ["underline"] },
      { text: " off", editable: true },
      {
        text: " all",
        editable: true,
        marks: ["bold", "italic", "underline"],
      },
    ])
    expect(line?.form).toBeUndefined()
    expect(line?.align).toBeUndefined()
  })

  it("does not read a complex-script bold as bold", () => {
    const [line] = read(`<w:p>${run("only cs", "<w:bCs/><w:iCs/>")}</w:p>`)
    expect(line?.pieces).toEqual([{ text: "only cs", editable: true }])
  })

  it("marks a link piece as a link and keeps it out of typing", () => {
    const [line] = read(
      `<w:p>${run("Portfolio at ")}<w:hyperlink r:id="link">${run("example site", "<w:b/>")}</w:hyperlink></w:p>`,
      false
    )
    expect(line?.pieces).toEqual([
      { text: "Portfolio at ", editable: true },
      { text: "example site", editable: false, marks: ["bold", "link"] },
    ])
  })

  it("reads a title and headings by style name, whatever the style id", () => {
    const lines = read(
      paragraph("Linh Nguyen", '<w:pStyle w:val="Title"/>') +
        paragraph("Experience", '<w:pStyle w:val="Heading1"/>') +
        paragraph("Marketing Intern", '<w:pStyle w:val="Kop2"/>') +
        paragraph("Body words")
    )
    expect(lines.map((line) => line.form)).toEqual([
      { kind: "title" },
      { kind: "heading", level: 1 },
      { kind: "heading", level: 2 },
      undefined,
    ])
  })

  it("reads bulleted and numbered lines at two levels from the numbering part", () => {
    const lines = read(
      listed(1, 0, "Bullet one") +
        listed(1, 1, "Bullet two") +
        listed(2, 0, "Number one") +
        listed(2, 1, "Number two") +
        paragraph("Styled bullet", '<w:pStyle w:val="ListBullet"/>') +
        listed(0, 0, "Numbering turned off")
    )
    expect(lines.map((line) => line.form)).toEqual([
      { kind: "bullet", level: 0 },
      { kind: "bullet", level: 1 },
      { kind: "number", level: 0 },
      { kind: "number", level: 1 },
      { kind: "bullet", level: 0 },
      undefined,
    ])
  })

  it("reads a list line as numbered when the numbering part does not say", () => {
    const [line] = read(listed(1, 0, "Grew revenue"), false)
    expect(line?.form).toEqual({ kind: "number", level: 0 })
  })

  it("reads alignment", () => {
    const lines = read(
      paragraph("centered", '<w:jc w:val="center"/>') +
        paragraph("right", '<w:jc w:val="right"/>') +
        paragraph("justified", '<w:jc w:val="both"/>') +
        paragraph("left", '<w:jc w:val="left"/>')
    )
    expect(lines.map((line) => line.align)).toEqual([
      "center",
      "end",
      "justify",
      undefined,
    ])
  })

  it("gives a held line no look, only its message", () => {
    const [line] = read(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r></w:p>`
    )
    expect(line?.held).toBe(true)
    expect(line?.message).not.toBe("")
    expect(line?.form).toBeUndefined()
    expect(line?.pieces).toEqual([{ text: line?.text, editable: false }])
  })

  it("reads a soft line break as a kept piece the page can see, outside the line's text", () => {
    const [line] = read(
      `<w:p>${run("Marketing Intern", "<w:b/>")}<w:r><w:br/></w:r>${run("Jun 2025 to now")}</w:p>`
    )
    expect(line?.held).toBe(false)
    expect(line?.text).toBe("Marketing InternJun 2025 to now")
    expect(line?.pieces).toEqual([
      { text: "Marketing Intern", editable: true, marks: ["bold"] },
      { text: "\n", editable: false },
      { text: "Jun 2025 to now", editable: true },
    ])
  })
})
