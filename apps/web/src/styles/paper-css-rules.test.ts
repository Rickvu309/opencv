// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./paper.css", import.meta.url), "utf8")

function ruleBody(selector: string): string {
  expect(css).toContain(selector)
  const open = css.indexOf("{", css.indexOf(selector))
  return css.slice(open + 1, css.indexOf("}", open))
}

describe("paper.css rules", () => {
  it("Paper editor controls list their transitions, so the box-shadow focus ring shows on the first frame", () => {
    const body = ruleBody("[data-paper-editor] button,")
    expect(body).toMatch(/transition-property:/)
    expect(body).not.toContain("box-shadow")
  })

  it("the A4 fit-width page has no transform, so tap targets keep their size", () => {
    expect(ruleBody(".cv-a4-fit {")).not.toContain("transform")
  })
})
