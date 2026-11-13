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
    const style = html.match(
      /<style>html\{background:(#[0-9a-fA-F]{6})\}<\/style>/
    )
    expect(theme?.[1]).toBe("#f9f9fa")
    expect(style?.[1]).toBe(theme?.[1])
    const schemeAt = html.indexOf('<meta name="color-scheme"')
    const styleAt = html.indexOf("<style>html{background:#f9f9fa}</style>")
    expect(styleAt).toBeGreaterThan(schemeAt)
  })
})
