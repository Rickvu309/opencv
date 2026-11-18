import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "shell-navigation.css"),
  "utf8"
)

function oklchToLinear(L: number, C: number, H: number) {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  let l = L + 0.3963377774 * a + 0.2158037573 * b
  let m = L - 0.1055613458 * a - 0.0638541728 * b
  let s = L - 0.0894841775 * a - 1.291485548 * b
  l **= 3
  m **= 3
  s **= 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function linToSrgb(channel: number) {
  const v =
    channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * Math.pow(Math.max(channel, 0), 1 / 2.4) - 0.055
  return Math.min(1, Math.max(0, v))
}

function srgbToLin(channel: number) {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

function contrast(fg: number[], bg: number[], alpha: number) {
  const mixed = fg
    .map(linToSrgb)
    .map(
      (channel, index) => channel * alpha + linToSrgb(bg[index]!) * (1 - alpha)
    )
    .map(srgbToLin)
  const y = (rgb: number[]) =>
    0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!
  const left = y(mixed)
  const right = y(bg)
  const lighter = Math.max(left, right)
  const darker = Math.min(left, right)
  return (lighter + 0.05) / (darker + 0.05)
}

function srgbByteToLinear(channel: number) {
  const unit = channel / 255
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

const ACTIVE = [0xe1, 0xe1, 0xe2].map(srgbByteToLinear)

const LIGHT = {
  fg: oklchToLinear(0.465, 0.003, 286.275),
  bg: oklchToLinear(0.952, 0.001, 286.375),
  hover: oklchToLinear(0.931, 0.001, 286.374),
  active: ACTIVE,
}
function passes(alpha: number) {
  return (
    contrast(LIGHT.fg, LIGHT.bg, alpha) >= 4.5 &&
    contrast(LIGHT.fg, LIGHT.hover, alpha) >= 4.5 &&
    contrast(LIGHT.fg, LIGHT.active, alpha) >= 4.5
  )
}

describe("Your work contrast", () => {
  it("ships the lightest muted-foreground alpha that passes 4.5:1", () => {
    const match = css.match(
      /\[data-slot="sidebar-group-label"\]\) \{\n {2}color: color-mix\(in oklab, var\(--muted-foreground\) (\d+)%, transparent\);/
    )
    expect(match).not.toBeNull()
    const percent = Number(match?.[1])
    let lightest = 100
    for (let step = 1; step <= 100; step += 1) {
      if (passes(step / 100)) {
        lightest = step
        break
      }
    }
    expect(percent).toBe(lightest)
    expect(css).not.toMatch(/#969799/)
    expect(passes(percent / 100)).toBe(true)
    expect(passes((percent - 1) / 100)).toBe(false)
  })

  it("does not pad or position another feature's header", () => {
    expect(css).not.toMatch(
      /page-header|writing-document-header|paper-library-header|letter-start-header|letter-drafting-header|cv-editor-header|letter-editor-header|sidebar-expand|padding-inline-start/
    )
  })
})
