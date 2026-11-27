import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { pasteHtml } from "./paste-html.ts"

const clipboardFixtures = [
  [
    "word",
    [
      "heading",
      "paragraph",
      "bullet",
      "bullet",
      "bullet",
      "numbered",
      "numbered",
    ],
    "https://example.com/paper-corpus/inspection",
  ],
  [
    "google-docs",
    ["subheading", "paragraph", "bullet", "bullet"],
    "https://example.com/paper-corpus/ban-giao",
  ],
  [
    "web-job-listing",
    [
      "subheading",
      "paragraph",
      "subheading",
      "numbered",
      "numbered",
      "paragraph",
    ],
    "https://example.com/paper-corpus/mo-ta-cong-viec",
  ],
  [
    "web-project-readme",
    ["subheading", "paragraph", "table", "paragraph"],
    "https://example.com/paper-corpus/worksheet",
  ],
  [
    "web-reference",
    [
      "subheading",
      "paragraph",
      "paragraph",
      "bullet",
      "bullet",
      "bullet",
      "paragraph",
    ],
    "https://example.com/paper-corpus/collection-glossary",
  ],
] as const

describe("Paper HTML clipboard normalization", () => {
  it.each(clipboardFixtures)(
    "keeps supported blocks from %s",
    (name, expected, href) => {
      const file = path.resolve(
        __dirname,
        `../../../../../../packages/paper-corpus/tests/fixtures/clipboard/${name}.html`
      )
      const result = pasteHtml(readFileSync(file, "utf8"), 360000)
      expect(
        result.map((block) => {
          if (block.type !== "text_block") return block.type
          return block.attrs.list ?? block.attrs.kind
        }),
        JSON.stringify(result)
      ).toEqual(expected)
      expect(JSON.stringify(result)).toContain(href)
      if (name === "word" || name === "google-docs") {
        const nested = result.filter(
          (block) => block.type === "text_block" && block.attrs.level === 1
        )
        expect(nested).toHaveLength(1)
      }
      if (name === "web-project-readme") {
        const table = result.find((block) => block.type === "table")
        expect(table?.content.map((row) => row.content.length)).toEqual([
          2, 2, 2,
        ])
      }
    }
  )

  it("keeps safe text and line breaks while dropping unsafe markup", () => {
    const result = pasteHtml(
      '<p><b>Work<br>History</b> <a href="javascript:alert(1)">Unsafe</a></p><script>Spam</script><iframe src="https://example.com"></iframe>',
      360000
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: "text_block",
      content: [
        { type: "text", text: "Work", marks: [{ type: "bold" }] },
        { type: "hard_break" },
        { type: "text", text: "History", marks: [{ type: "bold" }] },
        { type: "text", text: " Unsafe" },
      ],
    })
    expect(JSON.stringify(result)).not.toMatch(/javascript:|Spam/)
  })
})
