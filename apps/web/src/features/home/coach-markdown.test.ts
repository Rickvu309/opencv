import { describe, expect, it } from "vitest"

import { parseCoachMarkdown, parseInline } from "@/features/home/coach-markdown.ts"

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

  it("leaves headings and raw tags as text", () => {
    expect(parseCoachMarkdown("## Hello <script>").at(0)).toEqual({
      type: "p",
      children: [{ type: "text", text: "## Hello <script>" }],
    })
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
