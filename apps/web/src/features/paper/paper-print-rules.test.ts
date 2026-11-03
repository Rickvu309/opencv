import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "paper-print.css"),
  "utf8"
)

function rule(selector: string) {
  const at = css.indexOf(selector)
  expect(at, selector).toBeGreaterThanOrEqual(0)
  const open = css.indexOf("{", at)
  const close = css.indexOf("}", open)
  return css.slice(open, close)
}

describe("print sheet rules", () => {
  it("keeps the screen clone visibility hidden so scrollHeight still counts", () => {
    expect(rule(".paper-print-measure {")).toContain("visibility: hidden")
  })

  it("zeros the field min height so a narrow print layout does not grow each line", () => {
    expect(rule("[data-paper-print] .paper-canvas-field,")).toContain(
      "min-height: 0"
    )
  })

  it("hides the affordance row so the head can keep the first bullets", () => {
    expect(
      rule(
        "[data-paper-print] .cv-print-entry > .flex:not(.cv-print-entry-head)"
      )
    ).toContain("display: none")
  })

  it("floats the product sidebar in the on-screen measure the way print does", () => {
    expect(rule("[data-paper-measure] .cv-template-product-sidebar")).toContain(
      "float: left"
    )
  })

  it("lists measure bullets as blocks so the height matches the printed pages", () => {
    expect(rule("[data-paper-measure] li")).toContain("display: block")
  })

  it("drops the full-page min height so the last line is not orphaned", () => {
    expect(rule("[data-paper-measure] .cv-template-root,")).toContain(
      "min-height: 0"
    )
  })

  it("floats the printed product sidebar because flex columns do not fragment", () => {
    expect(
      rule(
        'body[data-print="paper"] [data-paper-print] .cv-template-product-sidebar'
      )
    ).toContain("float: left")
  })

  it("lets a section taller than one page continue instead of clipping", () => {
    expect(
      rule(
        'body[data-print="paper"] [data-paper-print] .cv-template-root section'
      )
    ).toContain("break-inside: auto")
  })

  it("prints a bullet as a block so a long line can split", () => {
    const block = rule('body[data-print="paper"] [data-paper-print] li {')
    expect(block).toContain("display: block")
    expect(block).toContain("break-inside: auto")
  })

  it("keeps a lone last bullet with the line above when that line fits", () => {
    expect(rule("li:nth-last-child(2)")).toContain("break-after: avoid")
  })
})
