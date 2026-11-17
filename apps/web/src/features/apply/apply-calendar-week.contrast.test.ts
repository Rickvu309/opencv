// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const CHART_2 = { l: 0.65, c: 0.13, h: 154.934 }
const FOREGROUND = { l: 0.218, c: 0, h: 0 }
const FILL_ALPHA = 0.09
const WEEKEND_TINT = 0.015
const FLOOR = 4.5

type Lab = [number, number, number]
type Rgb = [number, number, number]

function labOf(color: { l: number; c: number; h: number }): Lab {
  const hue = (color.h * Math.PI) / 180
  return [color.l, color.c * Math.cos(hue), color.c * Math.sin(hue)]
}

function mixLab(chart: Lab, ink: Lab, inkShare: number): Lab {
  const keep = 1 - inkShare
  return [
    chart[0] * keep + ink[0] * inkShare,
    chart[1] * keep + ink[1] * inkShare,
    chart[2] * keep + ink[2] * inkShare,
  ]
}

function labToSrgb(lab: Lab): Rgb {
  const [l, a, b] = lab
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mid = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * long - 3.3077115913 * mid + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * mid - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * mid + 1.707614701 * short,
  ]
  return linear.map((channel) => {
    const clipped = Math.min(1, Math.max(0, channel))
    const encoded =
      clipped <= 0.0031308
        ? 12.92 * clipped
        : 1.055 * clipped ** (1 / 2.4) - 0.055
    return Math.round(encoded * 255)
  }) as Rgb
}

function composite(top: Rgb, alpha: number, below: Rgb): Rgb {
  return top.map(
    (channel, index) => channel * alpha + below[index] * (1 - alpha)
  ) as Rgb
}

function luminance(rgb: Rgb) {
  const linear = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function ratio(front: Rgb, back: Rgb) {
  const lighter = Math.max(luminance(front), luminance(back))
  const darker = Math.min(luminance(front), luminance(back))
  return (lighter + 0.05) / (darker + 0.05)
}

function companyRatios(percent: number) {
  const ink = labToSrgb(
    mixLab(labOf(CHART_2), labOf(FOREGROUND), percent / 100)
  )
  const fill = labToSrgb(labOf(CHART_2))
  const page: Rgb = [255, 255, 255]
  const weekday = composite(fill, FILL_ALPHA, page)
  const weekend = composite(
    fill,
    FILL_ALPHA,
    composite(labToSrgb(labOf(FOREGROUND)), WEEKEND_TINT, page)
  )
  return { weekday: ratio(ink, weekday), weekend: ratio(ink, weekend) }
}

function lightestPassingPercent() {
  for (let percent = 0; percent <= 100; percent += 1) {
    const pair = companyRatios(percent)
    if (pair.weekday >= FLOOR && pair.weekend >= FLOOR) return percent
  }
  return 100
}

describe("calendar week company contrast", () => {
  it("uses the lightest foreground mix that clears 4.5 on weekday and weekend", () => {
    const source = readFileSync(
      new URL("./apply-calendar-week.tsx", import.meta.url),
      "utf8"
    )
    const line = source.split("\n").find((row) => row.includes("text-[11.5px]"))
    expect(line).toBeDefined()
    const match = line!.match(/var\(--foreground\)_(\d+)%/)
    expect(match).not.toBeNull()
    const percent = Number(match![1])
    const lightest = lightestPassingPercent()
    const chosen = companyRatios(percent)
    expect(chosen.weekday).toBeGreaterThanOrEqual(FLOOR)
    expect(chosen.weekend).toBeGreaterThanOrEqual(FLOOR)
    expect(percent).toBe(lightest)
  })
})
