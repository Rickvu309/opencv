import { describe, expect, it } from "vitest"

import {
  type ContrastSample,
  type MotionSample,
  clipFindings,
  contrastFindings,
  contrastRatio,
  flatten,
  higSizes,
  motionFindings,
  requiredRatio,
  ringFindings,
} from "./hig-rules"
import { GRID } from "./viewport-grid"

const text = (over: Partial<ContrastSample> = {}): ContrastSample => ({
  name: '"Upload"',
  kind: "text",
  x: 4,
  y: 8,
  width: 60,
  height: 16,
  fontSize: 14,
  fontWeight: 400,
  color: [0, 0, 0, 1],
  layers: [[255, 255, 255, 1]],
  overImage: false,
  ...over,
})

const motion = (over: Partial<MotionSample> = {}): MotionSample => ({
  name: "pulse on div",
  rect: { x: 0, y: 0, width: 10, height: 10 },
  iterations: 1,
  duration: 200,
  properties: ["opacity"],
  progress: false,
  ...over,
})

describe("contrast from rendered colours", () => {
  it("measures the ratio people see", () => {
    expect(contrastRatio([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21, 1)
    expect(contrastRatio([118, 118, 118, 1], [255, 255, 255, 1])).toBeCloseTo(
      4.54,
      2
    )
  })

  it("asks 4.5:1 of body text, 3:1 of 18px or bold text and of icons", () => {
    expect(requiredRatio(text())).toBe(4.5)
    expect(requiredRatio(text({ fontSize: 18 }))).toBe(3)
    expect(requiredRatio(text({ fontWeight: 700 }))).toBe(3)
    expect(requiredRatio(text({ fontWeight: 600 }))).toBe(4.5)
    expect(requiredRatio(text({ kind: "icon" }))).toBe(3)
  })

  it("fires on grey body text under 4.5:1 and names both colours", () => {
    const found = contrastFindings([text({ color: [150, 150, 150, 1] })])
    expect(found).toHaveLength(1)
    expect(found[0].measured).toBe(
      "14px/400 text #969696 on #ffffff is 2.96:1, needs 4.5:1"
    )
    expect(found[0].rect).toEqual({ x: 4, y: 8, width: 60, height: 16 })
  })

  it("stays quiet at exactly the ratio and on large text that clears 3:1", () => {
    expect(contrastFindings([text({ color: [118, 118, 118, 1] })])).toEqual([])
    expect(
      contrastFindings([text({ color: [130, 130, 130, 1], fontSize: 24 })])
    ).toEqual([])
  })

  it("composites translucent text and translucent layers before measuring", () => {
    expect(flatten([[0, 0, 0, 0.5]])).toEqual([127.5, 127.5, 127.5, 1])
    const faded = contrastFindings([text({ color: [0, 0, 0, 0.4] })])
    expect(faded).toHaveLength(1)
    expect(faded[0].measured).toMatch(/#999999 on #ffffff/)
    const dark = contrastFindings([
      text({
        color: [255, 255, 255, 1],
        layers: [
          [0, 0, 0, 0.5],
          [20, 20, 20, 1],
        ],
      }),
    ])
    expect(dark).toEqual([])
  })

  it("skips text drawn over an image or gradient it cannot measure", () => {
    expect(
      contrastFindings([text({ color: [200, 200, 200, 1], overImage: true })])
    ).toEqual([])
  })
})

describe("text at 200 percent", () => {
  it("turns each clip into a finding with what was measured", () => {
    const found = clipFindings([
      {
        name: '"Language"',
        how: "clipped",
        measured: "content 120px wide in a 80px box",
        x: 1.4,
        y: 2.6,
        width: 80,
        height: 20,
      },
    ])
    expect(found[0].measured).toBe(
      "at 200% text: clipped, content 120px wide in a 80px box"
    )
    expect(found[0].rect).toEqual({ x: 1, y: 3, width: 80, height: 20 })
  })
})

describe("focus ring", () => {
  it("fires only on a control that shows no change when focused", () => {
    const rect = { x: 0, y: 0, width: 32, height: 18 }
    expect(
      ringFindings([
        { name: 'switch "Email"', ring: false, ...rect },
        { name: 'button "New"', ring: true, ...rect },
      ]).map((finding) => finding.name)
    ).toEqual(['switch "Email"'])
  })
})

describe("reduced motion", () => {
  it("fires on a repeating animation and on movement while Reduce Motion is on", () => {
    expect(
      motionFindings([
        motion({ iterations: null }),
        motion({ properties: ["transform", "opacity"] }),
      ]).map((finding) => finding.measured)
    ).toEqual([
      "with Reduce Motion on, an animation of 200ms repeats forever",
      "with Reduce Motion on, an animation of 200ms moves transform",
    ])
  })

  it("stays quiet on a one-off fade and on a progress indicator", () => {
    expect(
      motionFindings([
        motion(),
        motion({ iterations: null, properties: ["transform"], progress: true }),
      ])
    ).toEqual([])
  })
})

describe("sizes", () => {
  it("checks 1440 and 390 in the full grid and the one size asked for otherwise", () => {
    expect(higSizes(GRID)).toEqual([
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ])
    expect(higSizes([{ width: 820, height: 512 }])).toEqual([
      { width: 820, height: 512 },
    ])
  })
})
