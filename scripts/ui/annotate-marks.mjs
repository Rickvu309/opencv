export const MARK_RED = "#e11d2e"
export const MARK_OUTLINE = "#ffffff"
export const NUMBER_INK = "#ffffff"
export const GITHUB_COLUMN = 880

export const ON_SCREEN = Object.freeze({
  badge: 26,
  number: 14,
  ring: 2,
  shaft: 3.5,
  outline: 1.5,
  head: 15,
  headWidth: 13,
  reach: 60,
  clearance: 5,
})

export function readScale(outputWidth) {
  return outputWidth > GITHUB_COLUMN ? GITHUB_COLUMN / outputWidth : 1
}

export function markSizes(canvasWidth, scale) {
  const toCss = 1 / (readScale(canvasWidth * scale) * scale)
  const css = Object.fromEntries(
    Object.entries(ON_SCREEN).map(([key, value]) => [
      key,
      Math.round(value * toCss * 100) / 100,
    ])
  )
  return Object.freeze({ ...css, radius: css.badge / 2 })
}

function channel(value) {
  const unit = value / 255
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

export function hexRgb(hex) {
  const value = Number.parseInt(hex.replace("#", ""), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function luminance(rgb) {
  const [r, g, b] = rgb.map(channel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}
