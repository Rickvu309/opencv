import { randomUUID } from "node:crypto"

import type {
  WordBatch,
  WordLean,
  WordParagraph,
} from "@workspace/domain/paper-doc"
import { describe, expect, it } from "vitest"

import { cvPackage, run } from "../../package-fixtures.js"
import { paragraphsOf, projectParagraphs } from "./classify.js"
import { draftBatch } from "./document.js"
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
  caret: number | null,
  lean?: WordLean,
  keptBefore?: number
): WordParagraph["pieces"] | string {
  const page = opened(body)
  const handle = page.keys[0] as string
  const drafted = mutateWord(page.bytes, page.side, [
    {
      op: "setText",
      handle,
      text,
      ...(caret === null ? {} : { caret }),
      ...(lean ? { lean } : {}),
      ...(keptBefore === undefined ? {} : { keptBefore }),
    },
  ])
  if (drafted.refused) return drafted.code ?? drafted.reason
  const read = projectParagraphs(drafted.bytes, page.keys)
  return read?.[0]?.pieces ?? "UNREAD"
}

describe("typing where two runs meet saves into the run the caret leans on", () => {
  it("keeps words typed at the start of the text after a link out of the words before it", () => {
    expect(typed(linkLine, "Portfolio at new today", 16, "after", 1)).toEqual([
      { text: "Portfolio at ", editable: true },
      { text: "example site", editable: false, marks: ["link"] },
      { text: "new today", editable: true },
    ])
  })

  it("keeps words typed at the end of the text before a link before it", () => {
    expect(typed(linkLine, "Portfolio at my today", 15, "before", 0)).toEqual([
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
      "after",
      1
    )
    expect(pieces).toEqual([
      { text: "Marketing Intern", editable: true },
      { text: "\n", editable: false },
      { text: "Since Jun 2025", editable: true },
    ])
  })

  it("follows the lean between a plain run and a bold run", () => {
    expect(typed(boldLine, "Led bigdata", 7, "before", 0)).toEqual([
      { text: "Led big", editable: true },
      { text: "data", editable: true, marks: ["bold"] },
    ])
    expect(typed(boldLine, "Led bigdata", 7, "after", 0)).toEqual([
      { text: "Led ", editable: true },
      { text: "bigdata", editable: true, marks: ["bold"] },
    ])
  })

  it("still refuses words that would cross a link instead of guessing a side", () => {
    expect(typed(linkLine, "Portfolio now", 13, "after", 1)).toBe("HELD_GAP")
  })
})

const brk = "<w:r><w:br/></w:r>"
const otherLink = `<w:hyperlink r:id="other">${run("second site")}</w:hyperlink>`
const site = { text: "example site", editable: false, marks: ["link"] }
const second = { text: "second site", editable: false, marks: ["link"] }
const softBreak = { text: "\n", editable: false }
const emptyBeforeLink = `<w:p>${run("")}${link}${run(" today")}</w:p>`
const emptyAfterLink = `<w:p>${run("Portfolio at ")}${link}${run("")}</w:p>`
const emptyBeforeBreak = `<w:p>${run("")}${brk}${run("Jun 2025")}</w:p>`
const emptyAfterBreak = `<w:p>${run("Marketing Intern")}${brk}${run("")}</w:p>`
const emptyBetweenLinks = `<w:p>${run("A")}${link}${run("")}${otherLink}${run("C")}</w:p>`

describe("an empty run is still a run the caret can sit in", () => {
  it.each(["before", "after"] as const)(
    "types into the empty run before a link with lean %s",
    (lean) => {
      expect(typed(emptyBeforeLink, "Hi  today", 3, lean, 0)).toEqual([
        { text: "Hi ", editable: true },
        site,
        { text: " today", editable: true },
      ])
    }
  )

  it.each(["before", "after"] as const)(
    "types into the empty run before a soft break with lean %s",
    (lean) => {
      expect(typed(emptyBeforeBreak, "LeadJun 2025", 4, lean, 0)).toEqual([
        { text: "Lead", editable: true },
        softBreak,
        { text: "Jun 2025", editable: true },
      ])
    }
  )

  it.each(["before", "after"] as const)(
    "types into the empty run after a link with lean %s",
    (lean) => {
      expect(typed(emptyAfterLink, "Portfolio at now", 16, lean, 1)).toEqual([
        { text: "Portfolio at ", editable: true },
        site,
        { text: "now", editable: true },
      ])
    }
  )

  it.each(["before", "after"] as const)(
    "types into the empty run after a soft break with lean %s",
    (lean) => {
      expect(
        typed(emptyAfterBreak, "Marketing InternJun", 19, lean, 1)
      ).toEqual([
        { text: "Marketing Intern", editable: true },
        softBreak,
        { text: "Jun", editable: true },
      ])
    }
  )

  it("types into the empty run between two links", () => {
    expect(typed(emptyBetweenLinks, "AxC", 2, "after", 1)).toEqual([
      { text: "A", editable: true },
      site,
      { text: "x", editable: true },
      second,
      { text: "C", editable: true },
    ])
  })

  it("keeps the runs on either side of an empty run between two links apart", () => {
    expect(typed(emptyBetweenLinks, "AbC", 2, "before", 0)).toEqual([
      { text: "Ab", editable: true },
      site,
      { text: "", editable: true },
      second,
      { text: "C", editable: true },
    ])
    expect(typed(emptyBetweenLinks, "AbC", 2, "after", 2)).toEqual([
      { text: "A", editable: true },
      site,
      { text: "", editable: true },
      second,
      { text: "bC", editable: true },
    ])
  })

  it("types at the start of the text after a link when an empty run sits before it", () => {
    expect(typed(emptyBeforeLink, "new today", 3, "after", 1)).toEqual([
      { text: "", editable: true },
      site,
      { text: "new today", editable: true },
    ])
  })

  it("reads an empty run before a link the way older pages sent it", () => {
    expect(typed(emptyBeforeLink, "Hi  today", 3)).toEqual([
      { text: "Hi ", editable: true },
      site,
      { text: " today", editable: true },
    ])
  })

  it("refuses a caret named on a side of the link where it does not sit", () => {
    expect(typed(linkLine, "Portfolio xat  today", 11, "before", 1)).toBe(
      "CARET"
    )
  })

  it("takes the marks of the letters after an empty run at the start of the words", () => {
    expect(
      typed(`<w:p>${run("")}${run("Led", bold)}</w:p>`, "xLed", 1, "after", 0)
    ).toEqual([
      { text: "", editable: true },
      { text: "xLed", editable: true, marks: ["bold"] },
    ])
  })
})

describe("changes that are not a single caret at a boundary", () => {
  it("deletes the first letter after a link without touching the text before it", () => {
    expect(typed(linkLine, "Portfolio at today", 13, "after", 1)).toEqual([
      { text: "Portfolio at ", editable: true },
      site,
      { text: "today", editable: true },
    ])
  })

  it("deletes the last letter before a link without touching the text after it", () => {
    expect(typed(linkLine, "Portfolio at today", 12, "before", 0)).toEqual([
      { text: "Portfolio at", editable: true },
      site,
      { text: " today", editable: true },
    ])
  })

  it("refuses a delete across a link", () => {
    expect(typed(linkLine, "Portfolio attoday", 12, "before", 0)).toBe(
      "HELD_GAP"
    )
  })

  it("refuses a replaced selection that spans a link", () => {
    expect(typed(linkLine, "Portfolio Xtoday", 11, "before", 0)).toBe(
      "HELD_GAP"
    )
  })

  it("refuses a replaced selection that spans a soft break", () => {
    expect(typed(breakLine, "Marketing X 2025", 11, "before", 0)).toBe(
      "HELD_GAP"
    )
  })

  it("puts several letters typed at once after a link on the caret's side", () => {
    expect(
      typed(linkLine, "Portfolio at and more today", 21, "after", 1)
    ).toEqual([
      { text: "Portfolio at ", editable: true },
      site,
      { text: "and more today", editable: true },
    ])
  })

  it("holds a line that is only a link", () => {
    expect(
      typed(`<w:p>${link}</w:p>`, "example site now", 12, "after", 1)
    ).toBe("WORD_FEATURE")
  })
})

describe("a batch names the caret side whole or not at all", () => {
  const batchWith = (side: object) => ({
    doc: randomUUID(),
    basedOn: randomUUID(),
    ops: [
      {
        op: "setText" as const,
        handle: randomUUID(),
        text: "Portfolio at new today",
        caret: 16,
        ...side,
      },
    ],
  })

  it.each([
    ["a lean without keptBefore", { lean: "after" }],
    ["a keptBefore without a lean", { keptBefore: 1 }],
  ])("refuses %s before reading the page", async (_, side) => {
    const drafted = await draftBatch(randomUUID(), batchWith(side) as WordBatch)
    expect(drafted).toMatchObject({ refused: true, code: "BATCH" })
  })

  it("places words by the caret alone when neither is sent, as before", () => {
    expect(typed(linkLine, "Portfolio at new today", 16)).toEqual([
      { text: "Portfolio at new", editable: true },
      { text: "example site", editable: false, marks: ["link"] },
      { text: " today", editable: true },
    ])
  })

  it("places words on the named side when both are sent", () => {
    expect(typed(linkLine, "Portfolio at new today", 16, "after", 1)).toEqual([
      { text: "Portfolio at ", editable: true },
      { text: "example site", editable: false, marks: ["link"] },
      { text: "new today", editable: true },
    ])
  })
})
