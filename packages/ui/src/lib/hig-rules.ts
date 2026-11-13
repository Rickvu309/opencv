import type { Viewport } from "./dialog-fit"

type Rect = { x: number; y: number; width: number; height: number }
export type Rgba = [number, number, number, number]

export type HigRuleId =
  "hig-contrast" | "hig-text-size" | "hig-focus-ring" | "hig-reduced-motion"

export type HigSource = { page: string; url: string; quote: string }

const HIG = "https://developer.apple.com/design/human-interface-guidelines"

export const HIG_SOURCES: Record<HigRuleId, HigSource> = {
  "hig-contrast": {
    page: "Accessibility",
    url: `${HIG}/accessibility`,
    quote:
      "Strive to meet color contrast minimum standards. Up to 17 pts: 4.5:1; 18 pts: 3:1; Bold: 3:1.",
  },
  "hig-text-size": {
    page: "Typography",
    url: `${HIG}/typography`,
    quote:
      "Make sure your app's layout adapts to all font sizes. Keep text truncation to a minimum as font size increases.",
  },
  "hig-focus-ring": {
    page: "Accessibility",
    url: `${HIG}/accessibility`,
    quote:
      "Let people use the keyboard alone to navigate and interact with your app.",
  },
  "hig-reduced-motion": {
    page: "Accessibility",
    url: `${HIG}/accessibility`,
    quote:
      "When this setting is active, ensure your app or game responds by reducing automatic and repetitive animations, including zooming, scaling, and peripheral motion.",
  },
}

export const HIG_SIZES: readonly Viewport[] = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]

export const TEXT_SCALE = 2
export const LARGE_TEXT_PX = 18
export const BOLD_WEIGHT = 700
export const TEXT_RATIO = 4.5
export const LARGE_RATIO = 3
export const ICON_RATIO = 3

export type ContrastSample = Rect & {
  name: string
  kind: "text" | "icon"
  fontSize: number
  fontWeight: number
  color: Rgba
  layers: Rgba[]
  overImage: boolean
}

export type ClipSample = Rect & {
  name: string
  how: "clipped" | "truncated" | "did not grow" | "page scrolls sideways"
  measured: string
}

export type RingSample = Rect & {
  name: string
  ring: boolean
}

export type MotionSample = {
  name: string
  rect: Rect | null
  iterations: number | null
  duration: number
  properties: string[]
  progress: boolean
}

export type HigSample = {
  contrast: ContrastSample[]
  clips: ClipSample[]
  rings: RingSample[]
  motion: MotionSample[]
}

export type HigFinding = {
  rule: HigRuleId
  name: string
  measured: string
  rect: Rect | null
}

const WHITE: Rgba = [255, 255, 255, 1]

export function over(top: Rgba, below: Rgba): Rgba {
  const alpha = top[3] + below[3] * (1 - top[3])
  if (alpha === 0) return [0, 0, 0, 0]
  const mix = (at: number) =>
    (top[at] * top[3] + below[at] * below[3] * (1 - top[3])) / alpha
  return [mix(0), mix(1), mix(2), alpha]
}

export function flatten(layers: Rgba[]): Rgba {
  return [...layers].reverse().reduce((below, top) => over(top, below), WHITE)
}

function luminance([r, g, b]: Rgba): number {
  const linear = (value: number) => {
    const channel = value / 255
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

export function contrastRatio(foreground: Rgba, background: Rgba): number {
  const back = flatten([background])
  const front = over(foreground, back)
  const [light, dark] = [luminance(front), luminance(back)].sort(
    (a, b) => b - a
  )
  return (light + 0.05) / (dark + 0.05)
}

export function requiredRatio(
  sample: Pick<ContrastSample, "kind" | "fontSize" | "fontWeight">
) {
  if (sample.kind === "icon") return ICON_RATIO
  return sample.fontSize >= LARGE_TEXT_PX || sample.fontWeight >= BOLD_WEIGHT
    ? LARGE_RATIO
    : TEXT_RATIO
}

const hex = ([r, g, b]: Rgba) =>
  `#${[r, g, b]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`

const rectOf = ({ x, y, width, height }: Rect): Rect => ({
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(width),
  height: Math.round(height),
})

export function contrastFindings(samples: ContrastSample[]): HigFinding[] {
  const found: HigFinding[] = []
  for (const sample of samples) {
    if (sample.overImage) continue
    const background = flatten(sample.layers)
    const ratio = contrastRatio(sample.color, background)
    const needed = requiredRatio(sample)
    if (ratio + 0.005 >= needed) continue
    const what =
      sample.kind === "icon"
        ? "icon"
        : `${Math.round(sample.fontSize)}px/${sample.fontWeight} text`
    found.push({
      rule: "hig-contrast",
      name: sample.name,
      measured: `${what} ${hex(over(sample.color, background))} on ${hex(background)} is ${ratio.toFixed(2)}:1, needs ${needed}:1`,
      rect: rectOf(sample),
    })
  }
  return found
}

export function clipFindings(samples: ClipSample[]): HigFinding[] {
  return samples.map((sample) => ({
    rule: "hig-text-size",
    name: sample.name,
    measured: `at ${TEXT_SCALE * 100}% text: ${sample.how}, ${sample.measured}`,
    rect: rectOf(sample),
  }))
}

export function ringFindings(samples: RingSample[]): HigFinding[] {
  return samples
    .filter((sample) => !sample.ring)
    .map((sample) => ({
      rule: "hig-focus-ring",
      name: sample.name,
      measured:
        "focused with Tab, it shows no outline, ring, border or fill change",
      rect: rectOf(sample),
    }))
}

const MOVING =
  /^(transform|translate|scale|rotate|top|left|right|bottom|inset|margin|width|height|offset)/

export function motionFindings(samples: MotionSample[]): HigFinding[] {
  const found: HigFinding[] = []
  for (const sample of samples) {
    if (sample.progress) continue
    const repeats = sample.iterations === null
    const moves = sample.properties.filter((property) => MOVING.test(property))
    if (!repeats && moves.length === 0) continue
    const what = [
      repeats ? "repeats forever" : null,
      moves.length ? `moves ${moves.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" and ")
    found.push({
      rule: "hig-reduced-motion",
      name: sample.name,
      measured: `with Reduce Motion on, an animation of ${Math.round(sample.duration)}ms ${what}`,
      rect: sample.rect ? rectOf(sample.rect) : null,
    })
  }
  return found
}

export function higFindings(sample: HigSample): HigFinding[] {
  return [
    ...contrastFindings(sample.contrast),
    ...clipFindings(sample.clips),
    ...ringFindings(sample.rings),
    ...motionFindings(sample.motion),
  ]
}

export function higSizes(grid: readonly Viewport[]): Viewport[] {
  const wanted = HIG_SIZES.filter((size) =>
    grid.some(
      (cell) => cell.width === size.width && cell.height === size.height
    )
  )
  return wanted.length ? wanted : grid.slice(0, 1)
}
