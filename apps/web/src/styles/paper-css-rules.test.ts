// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./paper.css", import.meta.url), "utf8")

function ruleBody(selector: string): string {
  expect(css).toContain(selector)
  const open = css.indexOf("{", css.indexOf(selector))
  return css.slice(open + 1, css.indexOf("}", open))
}

function blocksFor(selector: string): string[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) =>
      match[1]!.split(",").some((part) => part.trim() === selector)
    )
    .map((match) => match[2]!)
}

describe("paper.css rules", () => {
  it("canvas add and remove controls show on focus-within and focus-visible, not only hover", () => {
    const revealing = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
      (match) =>
        match[1]!.includes(".paper-canvas-affordance") &&
        /opacity:\s*1\b/.test(match[2]!)
    )
    expect(revealing).toBeDefined()
    const selectors = revealing![1]!.split(",").map((part) => part.trim())
    expect(selectors).toContain(
      ".paper-canvas-block:focus-within .paper-canvas-affordance"
    )
    expect(selectors).toContain(".paper-canvas-affordance:focus-visible")
  })

  it("the empty-section next step is never hidden on hover", () => {
    const blocks = blocksFor(".paper-canvas-next-step")
    expect(blocks.some((body) => /opacity:\s*1\b/.test(body))).toBe(true)
    expect(blocks.some((body) => /opacity:\s*0\b/.test(body))).toBe(false)
  })

  it("Paper editor controls list their transitions, so the box-shadow focus ring shows on the first frame", () => {
    const body = ruleBody("[data-paper-editor] button,")
    expect(body).toMatch(/transition-property:/)
    expect(body).not.toContain("box-shadow")
  })

  it("the A4 fit-width page has no transform, so tap targets keep their size", () => {
    const blocks = blocksFor(".cv-a4-fit")
    expect(blocks.length).toBeGreaterThan(0)
    for (const body of blocks) expect(body).not.toContain("transform")
  })
})
