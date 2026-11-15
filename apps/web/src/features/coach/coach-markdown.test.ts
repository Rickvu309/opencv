import { describe, expect, it } from "vitest"

import {
  parseCoachMarkdown,
  parseInline,
} from "@/features/coach/coach-markdown.ts"

describe("parseCoachMarkdown", () => {
  it("renders lists, emphasis, and code from the allowlist", () => {
    const blocks = parseCoachMarkdown(
      "Try this:\n\n- **star** the card\n- move it to `Prep`\n\nThen *wait*.\n\n```\nconst x = 1\n```"
    )

    expect(blocks[0]).toEqual({
      type: "p",
      children: [{ type: "text", text: "Try this:" }],
    })
    expect(blocks[1]).toEqual({
      type: "ul",
      items: [
        [
          { type: "strong", children: [{ type: "text", text: "star" }] },
          { type: "text", text: " the card" },
        ],
        [
          { type: "text", text: "move it to " },
          { type: "code", text: "Prep" },
        ],
      ],
    })
    expect(blocks[2]).toEqual({
      type: "p",
      children: [
        { type: "text", text: "Then " },
        { type: "em", children: [{ type: "text", text: "wait" }] },
        { type: "text", text: "." },
      ],
    })
    expect(blocks[3]).toEqual({ type: "pre", text: "const x = 1" })
  })

  it("reads a heading and keeps raw tags as text", () => {
    expect(parseCoachMarkdown("## Hello <script>").at(0)).toEqual({
      type: "heading",
      level: 2,
      children: [{ type: "text", text: "Hello <script>" }],
    })
  })

  it("keeps a hash that belongs to a word in a heading", () => {
    expect(parseCoachMarkdown("# Learn C#").at(0)).toEqual({
      type: "heading",
      level: 1,
      children: [{ type: "text", text: "Learn C#" }],
    })
    expect(parseCoachMarkdown("### Next steps ##").at(0)).toEqual({
      type: "heading",
      level: 3,
      children: [{ type: "text", text: "Next steps" }],
    })
  })

  it("reads a comparison table and pads short rows", () => {
    expect(
      parseCoachMarkdown(
        "| Role | Fit |\n| --- | --- |\n| Analyst | **High** |\n| Intern |"
      )
    ).toEqual([
      {
        type: "table",
        header: [
          [{ type: "text", text: "Role" }],
          [{ type: "text", text: "Fit" }],
        ],
        rows: [
          [
            [{ type: "text", text: "Analyst" }],
            [{ type: "strong", children: [{ type: "text", text: "High" }] }],
          ],
          [[{ type: "text", text: "Intern" }], []],
        ],
      },
    ])
  })

  it("leaves a pipe line without a divider as a paragraph", () => {
    expect(parseCoachMarkdown("A | B").at(0)?.type).toBe("p")
  })
})

describe("parseInline", () => {
  it("does not treat asterisks inside code as emphasis", () => {
    expect(parseInline("use `*raw*`")).toEqual([
      { type: "text", text: "use " },
      { type: "code", text: "*raw*" },
    ])
  })
})

describe("parseInline links", () => {
  it("links safe web and mail addresses", () => {
    expect(parseInline("[the role](https://jobs.example.com/a?b=1)")).toEqual([
      {
        type: "link",
        href: "https://jobs.example.com/a?b=1",
        children: [{ type: "text", text: "the role" }],
      },
    ])
    expect(parseInline("[me](mailto:ada@example.com)").at(0)).toMatchObject({
      type: "link",
      href: "mailto:ada@example.com",
    })
  })

  it("links a bare address without its closing punctuation", () => {
    expect(parseInline("See https://example.com/job.")).toEqual([
      { type: "text", text: "See " },
      {
        type: "link",
        href: "https://example.com/job",
        children: [{ type: "text", text: "https://example.com/job" }],
      },
      { type: "text", text: "." },
    ])
  })

  it("keeps the label of an unsafe link as text", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "vbscript:x",
      "/relative",
    ]) {
      const nodes = parseInline(`[click](${href})`)
      expect(nodes.some((node) => node.type === "link")).toBe(false)
      expect(nodes.at(0)).toEqual({
        type: "text",
        text: expect.stringMatching(/^click/),
      })
    }
  })

  it("never nests a link inside a link label but keeps emphasis and code", () => {
    expect(
      parseInline("[Read https://example.com](https://other.com)")
    ).toEqual([
      {
        type: "link",
        href: "https://other.com/",
        children: [{ type: "text", text: "Read https://example.com" }],
      },
    ])
    expect(parseInline("[**Bold** `code`](https://other.com)")).toEqual([
      {
        type: "link",
        href: "https://other.com/",
        children: [
          { type: "strong", children: [{ type: "text", text: "Bold" }] },
          { type: "text", text: " " },
          { type: "code", text: "code" },
        ],
      },
    ])
  })
})
