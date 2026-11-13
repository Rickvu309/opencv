import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  GITHUB_COLUMN,
  MARK_OUTLINE,
  MARK_RED,
  NUMBER_INK,
  ON_SCREEN,
  contrast,
  hexRgb,
  markSizes,
  readScale,
} from "./annotate-marks.mjs"
import { CANVAS, canvasWidth } from "./annotate.mjs"
import { planComposite } from "./composite.mjs"
import { decodePng } from "./png-pixels.mjs"

const FIXTURES = fileURLToPath(new URL("./fixtures/annotate/", import.meta.url))
const ctx = {
  fs: {
    read: (file) => readFileSync(file, "utf8"),
    readBytes: (file) => readFileSync(file),
  },
}
const RED = hexRgb(MARK_RED)
const WHITE = hexRgb(MARK_OUTLINE)
const LIGHT_PAGE = [255, 255, 255]
const DARK_PAGE = [0, 0, 0]
const TIP_BACK = 6

test("the red holds 3:1 against light and dark screenshots and the white number holds 4.5:1 on it", () => {
  assert.ok(contrast(RED, LIGHT_PAGE) >= 3, "red on white")
  assert.ok(contrast(RED, DARK_PAGE) >= 3, "red on black")
  assert.ok(contrast(RED, hexRgb("#0d0d0f")) >= 3, "red on the canvas")
  assert.ok(contrast(hexRgb(NUMBER_INK), RED) >= 4.5, "number on red")
  assert.ok(contrast(WHITE, DARK_PAGE) >= 3, "outline on dark")
})

test("badge, number and stroke read at the same size on screen for a phone, a desktop and a composite", () => {
  const outputs = [
    ["composite", CANVAS.width],
    ...[
      [390, 844],
      [820, 512],
      [1440, 900],
      [1920, 1080],
    ].map(([width, height]) => [
      `single ${width}`,
      canvasWidth([{ single: true, size: { width, height } }]),
    ]),
  ]
  for (const [name, width] of outputs) {
    const sizes = markSizes(width, CANVAS.scale)
    const onScreen = readScale(width * CANVAS.scale) * CANVAS.scale
    for (const key of ["badge", "number", "shaft", "outline", "head"])
      assert.ok(
        Math.abs(sizes[key] * onScreen - ON_SCREEN[key]) < 0.05,
        `${name} ${key}: ${sizes[key] * onScreen} on screen`
      )
    assert.ok(
      width * CANVAS.scale * readScale(width * CANVAS.scale) <=
        GITHUB_COLUMN + 1e-6
    )
  }
  assert.ok(ON_SCREEN.number >= 12, "a number under 12px is unreadable")
  assert.ok(ON_SCREEN.badge >= 24, "a badge under 24px hides its number")
})

const close = (a, b) => Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05

for (const name of ["pair", "single"])
  test(`${name}: the committed image matches the solver, and its arrows and badges are the red constant`, () => {
    const { layouts, sizes } = planComposite(
      ctx,
      `${FIXTURES}${name}.spec.json`
    )
    const { marks } = JSON.parse(
      readFileSync(`${FIXTURES}${name}.marks.json`, "utf8")
    )
    const panels = layouts.flatMap((layout) =>
      layout.single
        ? [["image", layout.panel]]
        : [
            ["before", layout.before],
            ["after", layout.after],
          ]
    )
    for (const [side, panel] of panels) {
      const drawn = marks.filter((mark) => mark.side === side)
      assert.deepEqual(
        drawn.map((mark) => mark.n),
        panel.callouts.map((mark) => mark.n)
      )
      const origin = {
        x: drawn[0].tip.x / CANVAS.scale - panel.callouts[0].to.x,
        y: drawn[0].tip.y / CANVAS.scale - panel.callouts[0].to.y,
      }
      panel.callouts.forEach((mark, at) => {
        const shown = (point) => ({
          x: (origin.x + point.x) * CANVAS.scale,
          y: (origin.y + point.y) * CANVAS.scale,
        })
        assert.ok(close(shown(mark.to), drawn[at].tip), `${side} ${mark.n} tip`)
        assert.ok(
          close(shown(mark.center), drawn[at].badge),
          `${side} ${mark.n} badge`
        )
      })
    }
    const image = decodePng(readFileSync(`${FIXTURES}${name}.expected.png`))
    const radius = sizes.radius * CANVAS.scale
    const ring = sizes.ring * CANVAS.scale
    for (const mark of marks) {
      const where = `${mark.side} ${mark.n}`
      const dx = mark.tip.x - mark.tail.x
      const dy = mark.tip.y - mark.tail.y
      const length = Math.hypot(dx, dy)
      assert.deepEqual(
        image.at(
          mark.tip.x - (dx / length) * TIP_BACK,
          mark.tip.y - (dy / length) * TIP_BACK
        ),
        RED,
        `${where}: arrowhead behind the tip`
      )
      assert.deepEqual(
        image.at(mark.tail.x + dx / 2, mark.tail.y + dy / 2),
        RED,
        `${where}: shaft`
      )
      assert.deepEqual(
        image.at(mark.badge.x, mark.badge.y - radius * 0.8),
        RED,
        `${where}: badge fill`
      )
      assert.deepEqual(
        image.at(mark.badge.x - radius - ring / 4, mark.badge.y),
        WHITE,
        `${where}: badge ring`
      )
      const glyph = []
      for (let y = -radius / 3; y <= radius / 3; y += 1)
        for (let x = -radius / 3; x <= radius / 3; x += 1)
          glyph.push(image.at(mark.badge.x + x, mark.badge.y + y))
      assert.ok(
        glyph.some((rgb) => rgb.every((value) => value > 240)),
        `${where}: the white number is drawn`
      )
    }
  })
