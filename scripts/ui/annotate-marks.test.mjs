import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { inflateSync } from "node:zlib"
import {
  CANVAS_COLORS,
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

const FIXTURES = fileURLToPath(new URL("./fixtures/annotate/", import.meta.url))
const ctx = {
  fs: {
    read: (file) => readFileSync(file, "utf8"),
    readBytes: (file) => readFileSync(file),
  },
}
const CHANNELS = Object.freeze({ 0: 1, 2: 3, 4: 2, 6: 4 })

function paeth(left, up, corner) {
  const guess = left + up - corner
  const toLeft = Math.abs(guess - left)
  const toUp = Math.abs(guess - up)
  const toCorner = Math.abs(guess - corner)
  if (toLeft <= toUp && toLeft <= toCorner) return left
  return toUp <= toCorner ? up : corner
}

function chunks(bytes) {
  const found = []
  let at = 8
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at)
    const type = bytes.toString("ascii", at + 4, at + 8)
    found.push({ type, data: bytes.subarray(at + 8, at + 8 + length) })
    at += 12 + length
  }
  return found
}

function decodePng(bytes) {
  const list = chunks(bytes)
  const header = list.find((chunk) => chunk.type === "IHDR").data
  const width = header.readUInt32BE(0)
  const height = header.readUInt32BE(4)
  const [depth, colorType, , , interlace] = header.subarray(8, 13)
  const channels = CHANNELS[colorType]
  if (depth !== 8 || !channels || interlace !== 0)
    throw new Error(
      `only 8-bit, non-interlaced gray, RGB or RGBA PNGs are read (depth ${depth}, type ${colorType})`
    )
  const raw = inflateSync(
    Buffer.concat(
      list.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data)
    )
  )
  const stride = width * channels
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const corner =
        y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0
      const predict = [0, left, up, (left + up) >> 1, paeth(left, up, corner)][
        filter
      ]
      pixels[y * stride + x] = (line[x] + predict) & 255
    }
  }
  return {
    width,
    height,
    at(x, y) {
      const offset = Math.round(y) * stride + Math.round(x) * channels
      const values = [...pixels.subarray(offset, offset + channels)]
      return channels < 3
        ? [values[0], values[0], values[0]]
        : values.slice(0, 3)
    },
  }
}

const RED = hexRgb(MARK_RED)
const WHITE = hexRgb(MARK_OUTLINE)
const LIGHT_PAGE = [255, 255, 255]
const DARK_PAGE = [0, 0, 0]
const TIP_BACK = 6

test("the red holds 3:1 against light and dark screenshots and the white number holds 4.5:1 on it", () => {
  assert.ok(contrast(RED, LIGHT_PAGE) >= 3, "red on white")
  assert.ok(contrast(RED, DARK_PAGE) >= 3, "red on black")
  assert.ok(
    contrast(RED, hexRgb(CANVAS_COLORS.canvas)) >= 3,
    "red on the canvas"
  )
  assert.ok(contrast(hexRgb(NUMBER_INK), RED) >= 4.5, "number on red")
  assert.ok(contrast(WHITE, DARK_PAGE) >= 3, "outline on dark")
})

test("legend text reads at 4.5:1 on the light canvas", () => {
  const canvas = hexRgb(CANVAS_COLORS.canvas)
  assert.ok(contrast(hexRgb(CANVAS_COLORS.ink), canvas) >= 4.5, "ink")
  assert.ok(contrast(hexRgb(CANVAS_COLORS.muted), canvas) >= 4.5, "muted")
  assert.ok(
    contrast(LIGHT_PAGE, canvas) > 1.2,
    "a white screenshot stands off the canvas"
  )
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

test("the committed composite matches the solver, and every arrow and badge in it is the red constant", () => {
  const { layouts, sizes } = planComposite(ctx, `${FIXTURES}annotate.spec.json`)
  const { sections } = JSON.parse(
    readFileSync(`${FIXTURES}annotate.marks.json`, "utf8")
  )
  const marks = sections.flatMap((section) => section.marks)
  const panels = layouts.flatMap((layout, at) =>
    (layout.single
      ? [["image", layout.panel]]
      : [
          ["before", layout.before],
          ["after", layout.after],
        ]
    ).map(([side, panel]) => [side, panel, sections[at].marks])
  )
  for (const [side, panel, sectionMarks] of panels) {
    const drawn = sectionMarks.filter((mark) => mark.side === side)
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
  const image = decodePng(readFileSync(`${FIXTURES}annotate.expected.png`))
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
