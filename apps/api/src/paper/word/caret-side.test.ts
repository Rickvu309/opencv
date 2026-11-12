import { randomUUID } from "node:crypto"

import type { WordLean, WordParagraph } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { cvPackage, run } from "../package-fixtures.js"
import { paragraphsOf, projectParagraphs } from "./classify.js"
import { mutateWord } from "./mutate.js"

const bold = "<w:b/>"
const link = `<w:hyperlink r:id="link">${run("example site")}</w:hyperlink>`
const linkLine = `<w:p>${run("Portfolio at ")}${link}${run(" today")}</w:p>`
const breakLine = `<w:p>${run("Marketing Intern")}<w:r><w:br/></w:r>${run("Jun 2025")}</w:p>`
const boldLine = `<w:p>${run("Led ")}${run("data", bold)}</w:p>`

function opened(body: string) {
  const bytes = cvPackage(body)
  const keys = paragraphsOf(bytes).map(() => randomUUID())
  const side = {
    version: 2 as const,
    paragraphs: keys.map((key, ordinal) => ({ key, ordinal, textIds: [] })),
  }
  return { bytes, keys, side }
}

function typed(
  body: string,
  text: string,
  caret: number,
  lean?: WordLean
): WordParagraph["pieces"] | string {
  const page = opened(body)
  const handle = page.keys[0] as string
  const drafted = mutateWord(page.bytes, page.side, [
    {
      op: "setText",
      handle,
      text,
      caret,
      ...(lean ? { lean } : {}),
    },
  ])
  if (drafted.refused) return drafted.code ?? drafted.reason
  const read = projectParagraphs(drafted.bytes, page.keys)
  return read?.[0]?.pieces ?? "UNREAD"
}

describe("typing where two runs meet saves into the run the caret leans on", () => {
  it("keeps words typed at the start of the text after a link out of the words before it", () => {
    expect(typed(linkLine, "Portfolio at new today", 16, "after")).toEqual([
      { text: "Portfolio at ", editable: true },
      { text: "example site", editable: false, marks: ["link"] },
      { text: "new today", editable: true },
    ])
  })

  it("keeps words typed at the end of the text before a link before it", () => {
    expect(typed(linkLine, "Portfolio at my today", 15, "before")).toEqual([
      { text: "Portfolio at my", editable: true },
      { text: "example site", editable: false, marks: ["link"] },
      { text: " today", editable: true },
    ])
  })

  it("reads a caret without a lean the way older pages sent it", () => {
    expect(typed(linkLine, "Portfolio at my today", 15)).toEqual([
      { text: "Portfolio at my", editable: true },
      { text: "example site", editable: false, marks: ["link"] },
      { text: " today", editable: true },
    ])
  })

  it("types on the second side of a soft line break and keeps the break", () => {
    const pieces = typed(
      breakLine,
      "Marketing InternSince Jun 2025",
      22,
      "after"
    )
    expect(pieces).toEqual([
      { text: "Marketing Intern", editable: true },
      { text: "\n", editable: false },
      { text: "Since Jun 2025", editable: true },
    ])
  })

  it("follows the lean between a plain run and a bold run", () => {
    expect(typed(boldLine, "Led bigdata", 7, "before")).toEqual([
      { text: "Led big", editable: true },
      { text: "data", editable: true, marks: ["bold"] },
    ])
    expect(typed(boldLine, "Led bigdata", 7, "after")).toEqual([
      { text: "Led ", editable: true },
      { text: "bigdata", editable: true, marks: ["bold"] },
    ])
  })

  it("still refuses words that would cross a link instead of guessing a side", () => {
    expect(typed(linkLine, "Portfolio now", 13, "after")).toBe("HELD_GAP")
  })
})
