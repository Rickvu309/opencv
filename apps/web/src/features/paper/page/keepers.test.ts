import { expect, it } from "vitest"

import {
  bindTails,
  headerSplitNote,
  joinKeptGroups,
  paintHeaders,
  paintRules,
} from "./keepers.ts"

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

function page(html: string) {
  return `<section class="docx"><article>${html}</article></section>`
}

function rootOf(html: string) {
  const root = document.createElement("div")
  root.innerHTML = html
  return root
}

it("pulls a short heading, its rule, a greeting, and the source header onto the next page", () => {
  const root = rootOf(
    [
      page(
        `<p class="source-header">COVER LETTER EXAMPLE</p><p>Education</p><div class="source-rule" role="separator"></div>`
      ),
      page("<p>Bachelor of Arts</p>"),
      page("<p>Dear Mr. Curtis:</p>"),
      page("<p>I am writing to apply.</p>"),
    ].join("")
  )
  joinKeptGroups(root)
  const pages = [...root.querySelectorAll("section.docx")]
  expect(pages[1]?.textContent).toContain("Education")
  expect(pages[1]?.textContent).toContain("COVER LETTER EXAMPLE")
  expect(pages[1]?.querySelector(".source-rule")).not.toBeNull()
  expect(headerSplitNote(root)).toBe("")
  const example = rootOf(
    [
      page(`<p class="source-header">COVER LETTER EXAMPLE</p>`),
      page("<p>Mr. John M. Curtis</p>"),
    ].join("")
  )
  joinKeptGroups(example)
  expect(example.querySelectorAll("section.docx")[1]?.textContent).toContain(
    "COVER LETTER EXAMPLE"
  )
  expect(headerSplitNote(example)).toBe("")
  const greeting = rootOf(
    [
      page("<p>Dear Mr. Curtis:</p>"),
      page("<p>I am writing to apply.</p>"),
    ].join("")
  )
  joinKeptGroups(greeting)
  expect(greeting.querySelectorAll("section.docx")[1]?.textContent).toContain(
    "Dear Mr. Curtis:"
  )
})

it("pulls the previous section column group when its last line is a short heading", () => {
  const root = rootOf(
    [
      `<section class="docx"><article><div class="source-columns"><p>Skills</p></div></article></section>`,
      page("<p>Tax preparation and review.</p>"),
    ].join("")
  )
  joinKeptGroups(root)
  expect(
    root.querySelectorAll("section.docx")[1]?.querySelector(".source-columns")
  ).not.toBeNull()
})

it("leaves a long paragraph on its own page", () => {
  const root = rootOf(
    [
      page("<p>This opening paragraph is longer than forty characters.</p>"),
      page("<p>Next paragraph.</p>"),
    ].join("")
  )
  joinKeptGroups(root)
  expect(root.querySelectorAll("section.docx")[0]?.textContent).toContain(
    "opening paragraph"
  )
})

it("keeps a space-run tail on one line and stops at the first break", () => {
  const root = rootOf(
    `<article><p>Role title        May 2020<br>City, State</p></article>`
  )
  bindTails(root)
  const tail = root.querySelector(".source-tail")
  expect(tail?.textContent).toBe("May 2020")
  expect(root.querySelector("br")?.nextSibling?.textContent).toContain("City")
})

it("keeps a right-tab tail on one line", () => {
  const root = rootOf(
    `<article><p>Role title<span>\u2003</span>May 2020</p></article>`
  )
  bindTails(root)
  expect(root.querySelector(".source-tail")?.textContent).toBe("May 2020")
})

it("places one read-only header for the section it introduces", () => {
  const documentXml = `<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>
    <w:p><w:r><w:t>Mr. John M. Curtis</w:t></w:r></w:p>
    <w:sectPr><w:headerReference w:type="default" r:id="rId9"/></w:sectPr>
  </w:body></w:document>`
  const header = `<w:hdr xmlns:w="${W}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:AlternateContent><mc:Choice><w:txbxContent><w:p><w:r><w:t>COVER LETTER EXAMPLE</w:t></w:r></w:p></w:txbxContent></mc:Choice><mc:Fallback><w:p><w:r><w:t>COVER LETTER FORMAT</w:t></w:r></w:p></mc:Fallback></mc:AlternateContent></w:hdr>`
  const root = rootOf(page("<p>Mr. John M. Curtis</p>"))
  paintHeaders(root, documentXml, { rId9: header })
  const headers = [...root.querySelectorAll(".source-header")]
  expect(headers).toHaveLength(1)
  expect(headers[0]?.textContent).toBe("COVER LETTER EXAMPLE")
  expect(headers[0]).toHaveAttribute("contenteditable", "false")
})

it("draws the connector as a rule after its paragraph", () => {
  const documentXml = `<w:document xmlns:w="${W}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
    <w:body><w:p><w:r><w:t>EDUCATION</w:t></w:r><w:r><wps:wsp><wps:spPr><a:xfrm><a:ext cx="2743200" cy="0"/></a:xfrm><a:prstGeom prst="straightConnector1"/></wps:spPr></wps:wsp></w:r></w:p></w:body>
  </w:document>`
  const root = rootOf(page("<p>EDUCATION</p>"))
  paintRules(root, documentXml)
  const rule = root.querySelector(".source-rule")
  expect(rule).toHaveAttribute("role", "separator")
  expect(rule).toHaveStyle({ width: "288px" })
})
