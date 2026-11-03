// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./paper.css", import.meta.url), "utf8")
const printCss = readFileSync(
  new URL("../features/paper/paper-print.css", import.meta.url),
  "utf8"
)

const CV_TYPE_FONT_SIZE = [
  [".cv-type-page-title", "22px"],
  [".cv-type-section-title", "10px"],
  [".cv-type-body", "13px"],
  [".cv-type-label", "13px"],
  [".cv-type-micro", "11px"],
] as const

const CV_TYPE_RESIZE = new Set(["font-size", "zoom", "transform"])

type StyleRule = {
  selector: string
  declarations: { property: string; value: string }[]
  print: boolean
}

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

function parseStyleRules(source: string): StyleRule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, " ")
  const rules: StyleRule[] = []
  const stack: { at: boolean; print: boolean; rule: number | null }[] = []
  let buffer = ""
  let quote = ""

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index]!
    if (quote) {
      buffer += ch
      if (ch === "\\" && index + 1 < text.length) {
        buffer += text[index + 1]!
        index += 1
        continue
      }
      if (ch === quote) quote = ""
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      buffer += ch
      continue
    }
    if (ch === "{") {
      const header = buffer.trim()
      buffer = ""
      const at = header.startsWith("@")
      const print =
        stack.some((frame) => frame.print) ||
        (at && /@media\b[\s\S]*\bprint\b/.test(header))
      let rule: number | null = null
      if (!at) {
        rule = rules.length
        rules.push({ selector: header, declarations: [], print })
      }
      stack.push({ at, print, rule })
      continue
    }
    if (ch === "}") {
      const frame = stack.pop()
      const body = buffer
      buffer = ""
      if (frame?.rule != null) {
        rules[frame.rule]!.declarations = readDeclarations(body)
      }
      continue
    }
    buffer += ch
  }
  return rules
}

function readDeclarations(body: string): { property: string; value: string }[] {
  const declarations: { property: string; value: string }[] = []
  for (const match of body.matchAll(/(?:^|;)\s*([-\w]+)\s*:\s*([^;]*)/g)) {
    const property = match[1]
    if (!property) continue
    declarations.push({ property, value: (match[2] ?? "").trim() })
  }
  return declarations
}

function selectorHasClass(selector: string, className: string): boolean {
  for (const match of selector.matchAll(/\.cv-type-[A-Za-z0-9_-]+/g)) {
    if (match[0] === className) return true
  }
  return false
}

function cvTypeFontSizes(
  rules: StyleRule[],
  className: string,
  print: boolean
): string[] {
  const sizes: string[] = []
  for (const rule of rules) {
    if (rule.print !== print) continue
    if (!selectorHasClass(rule.selector, className)) continue
    for (const declaration of rule.declarations) {
      if (declaration.property === "font-size") sizes.push(declaration.value)
    }
  }
  return sizes
}

function cvTypeResize(rules: StyleRule[], onlyPrint: boolean): string[] {
  const hits: string[] = []
  for (const rule of rules) {
    if (onlyPrint && !rule.print) continue
    if (!/\.cv-type-[A-Za-z0-9_-]+/.test(rule.selector)) continue
    for (const declaration of rule.declarations) {
      if (!CV_TYPE_RESIZE.has(declaration.property)) continue
      const selector = rule.selector.replace(/\s+/g, " ").trim()
      hits.push(`${selector} { ${declaration.property}: ${declaration.value} }`)
    }
  }
  return hits
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

  it("keeps the five CV type sizes in paper.css, and print CSS does not resize or zoom them", () => {
    const screen = parseStyleRules(css)
    const printSheet = parseStyleRules(printCss)
    for (const [className, size] of CV_TYPE_FONT_SIZE) {
      expect(cvTypeFontSizes(screen, className, false)).toEqual([size])
    }
    expect(cvTypeResize(printSheet, false)).toEqual([])
    expect(cvTypeResize(screen, true)).toEqual([])
  })
})
