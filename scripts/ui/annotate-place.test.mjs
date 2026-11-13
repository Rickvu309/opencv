import assert from "node:assert/strict"
import test from "node:test"
import { markSizes } from "./annotate-marks.mjs"
import {
  badgeInside,
  circleHitsBox,
  contains,
  crossingPairs,
  distanceToBoxEdge,
} from "./annotate-place.mjs"
import {
  CANVAS,
  canvasWidth,
  layoutSection,
  layoutSingle,
  sectionColumn,
} from "./annotate.mjs"

const SIZES = [
  [390, 844],
  [820, 512],
  [1440, 900],
  [1920, 1080],
]
const COUNTS = [1, 5, 12, 25]
const TIP_TOLERANCE = 1

function spread(count, width, height) {
  const columns = Math.ceil(Math.sqrt((count * width) / height))
  const rows = Math.ceil(count / columns)
  const cell = { width: width / columns, height: height / rows }
  const side = Math.max(12, Math.min(cell.width, cell.height) * 0.3)
  return Array.from({ length: count }, (_, at) => ({
    x: (at % columns) * cell.width + (cell.width - side) / 2,
    y: Math.floor(at / columns) * cell.height + (cell.height - side) / 2,
    width: side,
    height: side,
  }))
}

const toolbar = (count, width) =>
  Array.from({ length: count }, (_, at) => ({
    x: 12 + at * Math.min(40, (width - 24) / count),
    y: 10,
    width: Math.min(28, (width - 24) / count - 6),
    height: 28,
  }))

const cornersAndEdges = (width, height) => {
  const s = 30
  return [
    [0, 0],
    [(width - s) / 2, 0],
    [width - s, 0],
    [width - s, (height - s) / 2],
    [width - s, height - s],
    [(width - s) / 2, height - s],
    [0, height - s],
    [0, (height - s) / 2],
  ].map(([x, y]) => ({ x, y, width: s, height: s }))
}

const callouts = (boxes) =>
  boxes.map((_, at) => ({ n: at + 1, note: `change ${at + 1}` }))

const sideWith = (width, height, boxes) => ({
  size: { width, height },
  image: "data:x",
  boxes: new Map(boxes.map((box, at) => [at + 1, box])),
})

function layoutPair(width, height, before, after = before) {
  const sizes = markSizes(CANVAS.width, CANVAS.scale)
  return {
    sizes,
    layout: layoutSection(
      { title: "t", callouts: callouts(before) },
      {
        before: sideWith(width, height, before),
        after: sideWith(width, height, after),
      },
      sectionColumn(),
      sizes
    ),
  }
}

function layoutOne(width, height, boxes) {
  const canvas = canvasWidth([{ single: true, size: { width, height } }])
  const sizes = markSizes(canvas, CANVAS.scale)
  return {
    sizes,
    layout: layoutSingle(
      { title: "t", callouts: callouts(boxes) },
      sideWith(width, height, boxes),
      sectionColumn(canvas),
      sizes,
      canvas
    ),
  }
}

function assertReadable(panel, sizes, what) {
  const numbers = panel.callouts.map((mark) => mark.n)
  assert.equal(new Set(numbers).size, numbers.length, `${what}: numbers repeat`)
  const byN = new Map(panel.targets.map((target) => [target.n, target]))
  for (const mark of panel.callouts) {
    const own = byN.get(mark.n).box
    const where = `${what} callout ${mark.n}`
    assert.ok(mark.clear, `${where} is not clear`)
    assert.ok(
      distanceToBoxEdge(mark.to, own) <= TIP_TOLERANCE,
      `${where}: tip ${JSON.stringify(mark.to)} is off the element edge`
    )
    assert.ok(
      badgeInside(mark.center, panel.size, sizes),
      `${where}: badge leaves the image`
    )
    for (const other of panel.targets)
      if (other.n === mark.n || !contains(other.box, own))
        assert.ok(
          !circleHitsBox(mark.center, sizes.radius, other.box),
          `${where}: badge covers element ${other.n}`
        )
    for (const other of panel.callouts)
      if (other.n !== mark.n)
        assert.ok(
          Math.hypot(
            mark.center.x - other.center.x,
            mark.center.y - other.center.y
          ) >=
            sizes.radius * 2,
          `${where}: badge sits on badge ${other.n}`
        )
  }
  assert.deepEqual(crossingPairs(panel.callouts), [], `${what}: arrows cross`)
}

test("before and after over the grid of image sizes and callout counts: tips on the edge, badges inside and clear, no crossings, numbers matched", () => {
  for (const [width, height] of SIZES)
    for (const count of COUNTS) {
      const boxes = spread(count, width, height)
      const moved = boxes.map((box) => ({ ...box, y: box.y + 4 }))
      const { layout, sizes } = layoutPair(width, height, boxes, moved)
      const what = `${width}x${height} with ${count}`
      assertReadable(layout.before, sizes, `${what} before`)
      assertReadable(layout.after, sizes, `${what} after`)
      assert.deepEqual(
        layout.before.callouts.map((mark) => mark.n).sort((a, b) => a - b),
        layout.after.callouts.map((mark) => mark.n).sort((a, b) => a - b)
      )
    }
})

test("a single image over the grid of sizes and counts holds the same rules", () => {
  for (const [width, height] of SIZES)
    for (const count of COUNTS) {
      const { layout, sizes } = layoutOne(
        width,
        height,
        spread(count, width, height)
      )
      assertReadable(layout.panel, sizes, `single ${width}x${height} ${count}`)
    }
})

test("many small targets in a toolbar get badges that do not cross or cover each other", () => {
  for (const [width, height] of SIZES)
    for (const count of [5, 12]) {
      const boxes = toolbar(count, width)
      const pair = layoutPair(width, height, boxes)
      assertReadable(pair.layout.after, pair.sizes, `toolbar ${width} ${count}`)
      const one = layoutOne(width, height, boxes)
      assertReadable(one.layout.panel, one.sizes, `toolbar single ${width}`)
    }
})

test("a target at each corner and edge keeps its badge inside the image", () => {
  for (const [width, height] of SIZES) {
    const boxes = cornersAndEdges(width, height)
    const pair = layoutPair(width, height, boxes)
    assertReadable(pair.layout.before, pair.sizes, `edges ${width}`)
    const one = layoutOne(width, height, boxes)
    assertReadable(one.layout.panel, one.sizes, `edges single ${width}`)
  }
})

test("an element on one side only is tagged new or removed and marked at its place on the other side", () => {
  const sizes = markSizes(CANVAS.width, CANVAS.scale)
  const box = { x: 400, y: 300, width: 80, height: 30 }
  const sides = {
    before: sideWith(1440, 900, []),
    after: sideWith(1440, 900, []),
  }
  sides.after.boxes.set(1, box)
  sides.after.boxes.set(2, null)
  sides.before.boxes.set(2, box)
  sides.before.boxes.set(1, null)
  const layout = layoutSection(
    {
      title: "t",
      callouts: [
        { n: 1, note: "Search icon", target: { after: { x: 1, y: 1 } } },
        { n: 2, note: "Old link", target: { before: { x: 1, y: 1 } } },
      ],
    },
    sides,
    sectionColumn(),
    sizes
  )
  assert.deepEqual(layout.before.missing, [])
  assert.deepEqual(layout.after.missing, [])
  assert.deepEqual(
    layout.legend.flat().map((item) => [item.n, item.tag]),
    [
      [1, "new"],
      [2, "removed"],
    ]
  )
  const ghostOf = (panel, n) =>
    panel.targets.find((target) => target.n === n)?.ghost === true
  assert.ok(ghostOf(layout.before, 1) && !ghostOf(layout.after, 1))
  assert.ok(ghostOf(layout.after, 2) && !ghostOf(layout.before, 2))
  assert.deepEqual(
    layout.before.callouts.map((mark) => mark.n),
    layout.after.callouts.map((mark) => mark.n)
  )
})

test("two arrows that would cross swap badges when the swap is clear", () => {
  const boxes = [
    { x: 100, y: 200, width: 20, height: 20 },
    { x: 160, y: 200, width: 20, height: 20 },
    { x: 130, y: 260, width: 20, height: 20 },
    { x: 130, y: 140, width: 20, height: 20 },
  ]
  const { layout, sizes } = layoutOne(820, 512, boxes)
  assertReadable(layout.panel, sizes, "diamond")
})
