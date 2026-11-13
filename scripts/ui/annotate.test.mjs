import assert from "node:assert/strict"
import test from "node:test"
import { markSizes } from "./annotate-marks.mjs"
import { badgeInside, distanceToBoxEdge } from "./annotate-place.mjs"
import {
  CANVAS,
  PLACEMENT_ORDER,
  compositeHtml,
  displaySize,
  layoutSection,
  legendRows,
  placeCallouts,
  pngSize,
  resolveTarget,
  sectionArrangement,
  sectionColumn,
  sideTarget,
  validateSpec,
} from "./annotate.mjs"

const SIZES = markSizes(CANVAS.width, CANVAS.scale)
const MARK = SIZES

const section = (callouts, extra = {}) => ({
  title: "Coach panel",
  screen: "paper-panel-open",
  width: 1440,
  callouts,
  ...extra,
})

test("a valid spec has no problems; selectors need a manifest, a screen and a width", () => {
  assert.deepEqual(
    validateSpec({
      manifest: "manifest.json",
      sections: [
        section([
          {
            n: 1,
            note: "Radius 18px to 14px",
            target: { selector: '[data-slot="a"]' },
          },
          { n: 2, note: "Moved", target: { x: 10, y: 20 } },
        ]),
      ],
    }),
    []
  )
  assert.deepEqual(
    validateSpec({
      sections: [
        {
          title: "x",
          before: "a.png",
          after: "b.png",
          callouts: [{ n: 1, note: "n", target: { selector: "s" } }],
        },
      ],
    }),
    [
      "section 1 callout 1 uses a selector, so the section needs a screen and width from the manifest",
    ]
  )
})

test("spec validation names every broken field and caps callouts at twenty-five", () => {
  assert.deepEqual(validateSpec({}), [
    "the spec needs a non-empty sections list",
  ])
  const problems = validateSpec({
    manifest: "m.json",
    sections: [
      {
        callouts: [
          { n: 1, note: "a", target: { x: 1, y: 1 } },
          { n: 1, note: "", target: {} },
          { n: 0, note: "c", target: { x: 1, y: 1 } },
          { n: 4, note: "d", target: { x: 1, y: 1 } },
          { n: 5, note: "e", target: { x: 1, y: 1 } },
          { n: 6, note: "f", target: { x: 1, y: 1 } },
        ],
      },
    ],
  })
  assert.deepEqual(problems, [
    "section 1 needs a title",
    "section 1 needs a before image, or a screen and width from the manifest",
    "section 1 needs a after image, or a screen and width from the manifest",
    "section 1 callout 2 repeats number 1",
    "section 1 callout 2 needs a note",
    "section 1 callout 2 target needs a selector or numeric x and y",
    "section 1 callout 3 needs a whole number n from 1",
  ])
  const many = Array.from({ length: 26 }, (_, at) => ({
    n: at + 1,
    note: "n",
    target: { x: at, y: at },
  }))
  assert.deepEqual(
    validateSpec({
      sections: [
        { title: "t", before: "a.png", after: "b.png", callouts: many },
      ],
    }),
    ["section 1 has 26 callouts; keep at most 25 and list the rest under also"]
  )
})

test("a selector resolves to its measured box on each side, scaled to image pixels; x and y are a point", () => {
  const side = {
    elements: [
      {
        key: "k",
        selector: '[data-slot="p"]',
        x: 10,
        y: 20,
        width: 30,
        height: 40,
      },
    ],
  }
  assert.deepEqual(resolveTarget({ selector: '[data-slot="p"]' }, side, 2), {
    x: 20,
    y: 40,
    width: 60,
    height: 80,
  })
  assert.deepEqual(resolveTarget({ selector: "k" }, side), {
    x: 10,
    y: 20,
    width: 30,
    height: 40,
  })
  assert.equal(resolveTarget({ selector: "missing" }, side), null)
  assert.deepEqual(resolveTarget({ x: 5, y: 6 }, side), {
    x: 5,
    y: 6,
    width: 0,
    height: 0,
  })
})

test("png size reads the header, and images are never shown larger than their pixels", () => {
  const header = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header)
  header.writeUInt32BE(1440, 16)
  header.writeUInt32BE(900, 20)
  assert.deepEqual(pngSize(header), { width: 1440, height: 900 })
  assert.throws(() => pngSize(Buffer.alloc(24)), /not a PNG/)
  const column = sectionColumn()
  const wide = displaySize({ width: 1440, height: 900 }, column)
  assert.equal(wide.width, column)
  assert.ok(wide.width * CANVAS.scale <= 1440)
  const phone = displaySize({ width: 390, height: 844 }, column)
  assert.equal(phone.width * CANVAS.scale, 390)
  assert.equal(sectionArrangement(wide, column), "stacked")
  assert.equal(sectionArrangement(phone, column), "side-by-side")
})

test("placement prefers the first clear direction in the fixed order and the tip lands on the element's edge", () => {
  assert.deepEqual(PLACEMENT_ORDER, [
    "up-left",
    "up-right",
    "left",
    "right",
    "down-left",
    "down-right",
    "up",
    "down",
  ])
  const bounds = { width: 900, height: 560 }
  const box = { x: 400, y: 200, width: 100, height: 50 }
  const [[mark]] = placeCallouts([{ marks: [{ n: 1, box }], bounds }], SIZES)
  assert.equal(mark.direction, "up-left")
  assert.equal(mark.clear, true)
  assert.deepEqual(mark.to, { x: 425, y: 200 })
  assert.ok(distanceToBoxEdge(mark.to, box) < 0.01)
  const corner = { x: 0, y: 0, width: 60, height: 30 }
  const [[cornered]] = placeCallouts(
    [{ marks: [{ n: 1, box: corner }], bounds }],
    SIZES
  )
  assert.equal(cornered.clear, true)
  assert.ok(badgeInside(cornered.center, bounds, SIZES))
  assert.ok(distanceToBoxEdge(cornered.to, corner) < 0.01)
})

test("a callout never covers its own target or a sibling target, but may sit inside a target that contains it", () => {
  const panel = { x: 600, y: 100, width: 260, height: 400 }
  const list = { x: 605, y: 150, width: 250, height: 290 }
  const composer = { x: 610, y: 445, width: 240, height: 50 }
  const [marks] = placeCallouts(
    [
      {
        marks: [
          { n: 1, box: panel },
          { n: 2, box: list },
          { n: 3, box: composer },
        ],
        bounds: { width: 900, height: 560 },
      },
    ],
    SIZES
  )
  assert.ok(
    marks.every((mark) => mark.clear),
    JSON.stringify(marks)
  )
  const inside = (point, box) =>
    point.x > box.x &&
    point.x < box.x + box.width &&
    point.y > box.y &&
    point.y < box.y + box.height
  assert.equal(inside(marks[2].center, composer), false)
  assert.equal(inside(marks[2].center, list), false)
  assert.ok(
    Math.hypot(
      marks[2].from.x - marks[2].center.x,
      marks[2].from.y - marks[2].center.y
    ) -
      MARK.radius <
      0.01
  )
})

test("two callouts on neighbouring targets do not stack their circles", () => {
  const [[a, b]] = placeCallouts(
    [
      {
        marks: [
          { n: 1, box: { x: 300, y: 300, width: 20, height: 20 } },
          { n: 2, box: { x: 330, y: 300, width: 20, height: 20 } },
        ],
        bounds: { width: 900, height: 560 },
      },
    ],
    SIZES
  )
  assert.ok(
    Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) >=
      MARK.radius * 2
  )
})

test("one number takes the same direction in both images when that direction is clear in both", () => {
  const bounds = { width: 900, height: 560 }
  const [[before], [after]] = placeCallouts(
    [
      {
        marks: [{ n: 1, box: { x: 400, y: 200, width: 100, height: 50 } }],
        bounds,
      },
      {
        marks: [{ n: 1, box: { x: 400, y: 10, width: 100, height: 50 } }],
        bounds,
      },
    ],
    SIZES
  )
  assert.equal(before.direction, after.direction)
  assert.equal(after.clear, true)
})

test("the legend lists numbers in order, two per row", () => {
  assert.deepEqual(
    legendRows([
      { n: 3, note: "c" },
      { n: 1, note: "a" },
      { n: 2, note: "b" },
    ]),
    [
      [
        { n: 1, note: "a" },
        { n: 2, note: "b" },
      ],
      [{ n: 3, note: "c" }],
    ]
  )
})

test("a section lays out both images at one size, reports targets missing on a side, and escapes notes", () => {
  const sides = {
    before: {
      size: { width: 1440, height: 900 },
      image: "data:b",
      boxes: new Map([[1, { x: 1020, y: 252, width: 400, height: 600 }]]),
    },
    after: {
      size: { width: 1440, height: 900 },
      image: "data:a",
      boxes: new Map([[1, null]]),
    },
  }
  const layout = layoutSection(
    section([{ n: 1, note: "<b>Panel</b>", target: { selector: "p" } }]),
    sides,
    sectionColumn()
  )
  assert.equal(layout.arrangement, "stacked")
  assert.deepEqual(layout.after.missing, [1])
  assert.equal(layout.before.callouts.length, 1)
  const html = compositeHtml([layout], {
    before: "Before (main)",
    after: "After (this PR)",
  })
  assert.match(html, /&lt;b&gt;Panel&lt;\/b&gt;/)
  assert.match(html, /Before \(main\)[\s\S]*After \(this PR\)/)
})

test("a per-side target points at a moved element in each image and skips a side it does not name", () => {
  const moved = {
    before: { selector: "deny-before" },
    after: { x: 5, y: 6 },
  }
  assert.deepEqual(sideTarget(moved, "before"), { selector: "deny-before" })
  assert.deepEqual(sideTarget(moved, "after"), { x: 5, y: 6 })
  assert.equal(sideTarget({ after: { x: 1, y: 2 } }, "before"), null)
  assert.deepEqual(sideTarget({ x: 1, y: 2 }, "before"), { x: 1, y: 2 })
  assert.equal(
    resolveTarget(sideTarget({ after: { x: 1, y: 2 } }, "before")),
    null
  )
  const section = (target) => ({
    sections: [
      {
        title: "t",
        before: "a.png",
        after: "b.png",
        callouts: [{ n: 1, note: "n", target }],
      },
    ],
  })
  assert.deepEqual(validateSpec(section({ after: { x: 1, y: 2 } })), [])
  assert.deepEqual(validateSpec(section({ before: null, after: null })), [
    "section 1 callout 1 a per-side target needs a before or an after",
  ])
  assert.deepEqual(validateSpec(section({ after: { selector: "s" } })), [
    "section 1 callout 1 uses a selector, so the section needs a screen and width from the manifest",
  ])
})

test("five crowded callouts on both sides never put one circle on another", () => {
  const side = (rows) => ({
    bounds: { width: 1440, height: 900 },
    marks: rows.map(([n, x, y, width, height]) => ({
      n,
      box: { x, y, width, height },
    })),
  })
  const placed = placeCallouts(
    [
      side([
        [1, 1188, 144, 44, 25],
        [2, 1198, 129, 22, 9],
        [3, 1191, 137, 115, 42],
        [4, 1140, 139, 64, 17],
        [5, 1184, 105, 93, 16],
      ]),
      side([
        [1, 1188, 119, 44, 25],
        [2, 1186, 78, 22, 9],
        [3, 1177, 165, 115, 42],
        [4, 1116, 154, 64, 17],
        [5, 1186, 53, 93, 16],
      ]),
    ],
    SIZES
  )
  for (const marks of placed)
    for (const [at, a] of marks.entries())
      for (const b of marks.slice(at + 1))
        assert.ok(
          Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) >=
            MARK.radius * 2,
          `callouts ${a.n} and ${b.n} overlap`
        )
})
