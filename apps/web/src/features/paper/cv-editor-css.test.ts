import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

const css = readFileSync("src/features/paper/cv-editor.css", "utf8")

it.each([
  ".bn-block-outer",
  ".bn-block-content",
  ".bn-block-content::before",
  ".bn-block-group .bn-block-group .bn-block-outer::before",
  ".collaboration-cursor__caret",
  ".collaboration-cursor__label",
])("keeps keyboard editing still on %s", (selector) => {
  const bodies = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) =>
      match[1]
        ?.split(",")
        .some((part) => part.trim() === `[data-paper-editor] ${selector}`)
    )
    .map((match) => match[2] ?? "")
  expect(
    bodies.some((body) => /(?:^|;)\s*transition:\s*none\s*;/.test(body))
  ).toBe(true)
})

it("contains no literal transition or animation duration", () => {
  expect(css).not.toMatch(
    /(?:transition|animation)-duration\s*:[^;]*\d(?:ms|s)/
  )
})
