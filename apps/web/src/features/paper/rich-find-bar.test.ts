import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function maskedSearchColors(css: string) {
  const hits: string[] = []
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1]?.trim() ?? ""
    if (!/\.paper-search-(?:match|current)\b/.test(selector)) continue
    for (const declaration of (rule[2] ?? "").matchAll(
      /(?:^|;)\s*(background-color|color)\s*:\s*([^;]+)/g
    )) {
      if (!/!important\s*$/.test(declaration[2] ?? ""))
        hits.push(`${selector}: ${declaration[1]}`)
    }
  }
  return hits
}

describe("search decorations over inline text formatting", () => {
  it("detects colors that the editor's inline marks would mask", () => {
    expect(
      maskedSearchColors(
        ".paper-search-match { background-color: Highlight; color: HighlightText; }"
      )
    ).toEqual([
      ".paper-search-match: background-color",
      ".paper-search-match: color",
    ])
    expect(
      maskedSearchColors(
        ".paper-search-match { background-color: Highlight !important; color: HighlightText !important; }"
      )
    ).toEqual([])
  })

  it("keeps matches visible over native foreground and highlight marks", () => {
    const css = readFileSync("src/features/paper/rich-find-bar.css", "utf8")
    expect(maskedSearchColors(css)).toEqual([])
  })

  it("keeps the current match clear of the document pane edge", () => {
    const css = readFileSync("src/features/paper/rich-find-bar.css", "utf8")
    expect(css).toMatch(
      /\[data-paper-search-active\]\s*\{[^}]*scroll-margin-block:\s*4rem/
    )
  })
})
