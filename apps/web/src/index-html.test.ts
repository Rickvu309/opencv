import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const html = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../index.html"),
  "utf8"
)

describe("the document paints the shell before the app loads", () => {
  it("sets the page background to the same colour as the theme, in the head", () => {
    const theme = html.match(
      /<meta name="theme-color" content="(#[0-9a-fA-F]{6})" \/>/
    )
    expect(theme?.[1]).toBe("#f9f9fa")
    expect(html).toContain('<meta name="color-scheme" content="light" />')
    const schemeAt = html.indexOf('<meta name="color-scheme"')
    const styleAt = html.indexOf("<style>")
    const ruleAt = html.indexOf("html {")
    const backgroundAt = html.indexOf("background: #f9f9fa")
    const styleEnd = html.indexOf("</style>")
    expect(styleAt).toBeGreaterThan(schemeAt)
    expect(ruleAt).toBeGreaterThan(styleAt)
    expect(backgroundAt).toBeGreaterThan(ruleAt)
    expect(styleEnd).toBeGreaterThan(backgroundAt)
    expect(
      html.slice(
        backgroundAt + "background: ".length,
        backgroundAt + "background: #f9f9fa".length
      )
    ).toBe(theme?.[1])
  })
})
