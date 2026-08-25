import { describe, expect, it } from "vitest"

import { paperContentToHtml } from "./paper-markdown.ts"

describe("paper markdown", () => {
  it("renders headings, paragraphs, lists, and emphasis", () => {
    const html = paperContentToHtml(
      "## Hello\n\nA **bold** line\n\n- one\n- two\n"
    )

    expect(html).toContain("<h2>Hello</h2>")
    expect(html).toContain("<strong>bold</strong>")
    expect(html).toContain("<ul>")
    expect(html).toContain("<li>one</li>")
    expect(html).toContain("<li>two</li>")
  })

  it("escapes raw HTML in content", () => {
    expect(paperContentToHtml("<script>alert(1)</script>")).toContain(
      "&lt;script&gt;"
    )
  })
})
