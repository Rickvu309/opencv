// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./landing.css", import.meta.url), "utf8")

describe("landing contrast floors on gradients", () => {
  it("the lead quote role on the soft gradient mixes at least 59.7% foreground, the lowest mix that clears 4.5:1 at 14px", () => {
    const rule = css.match(
      /\.landing-quote-lead \.landing-quote-role\s*\{([^}]*)\}/
    )
    expect(rule).not.toBeNull()
    const mix = rule![1].match(
      /color-mix\(in oklch, var\(--foreground\) ([\d.]+)%, var\(--background\)\)/
    )
    expect(mix).not.toBeNull()
    expect(Number(mix![1])).toBeGreaterThanOrEqual(59.7)
  })
})
