import assert from "node:assert/strict"
import test from "node:test"

import { detect, FLAT_TOOLBAR_CONTROLS } from "./lib/paper-flat-toolbar.mjs"

const row = (top, height, width, labels) =>
  labels.map((label, index) => ({
    label,
    left: 16 + index * (width + 4),
    right: 16 + index * (width + 4) + width,
    top,
    bottom: top + height,
    visible: true,
  }))

const desk = {
  viewport: 1440,
  scrollWidth: 1440,
  clientWidth: 1440,
  controls: row(58, 32, 40, FLAT_TOOLBAR_CONTROLS),
}

const phone = {
  viewport: 390,
  scrollWidth: 390,
  clientWidth: 390,
  controls: [
    ...row(58, 36, 44, FLAT_TOOLBAR_CONTROLS.slice(0, 5)),
    ...row(98, 36, 44, FLAT_TOOLBAR_CONTROLS.slice(5)),
  ],
}

test("the flat toolbar passes when every control shows on one row at 1440 and two rows at 390", () => {
  assert.deepEqual(detect(desk), [])
  assert.deepEqual(detect(phone), [])
})

test("headings and lists hidden behind More at 1440 fail", () => {
  const hidden = desk.controls.map((control) =>
    ["Text style", "Bulleted list", "Numbered list"].includes(control.label)
      ? { ...control, visible: false }
      : control
  )
  assert.deepEqual(detect({ ...desk, controls: hidden }), [
    "Text style is missing at 1440px",
    "Bulleted list is missing at 1440px",
    "Numbered list is missing at 1440px",
  ])
})

test("a phone toolbar that runs off the screen or scrolls sideways fails", () => {
  const wide = phone.controls.map((control) =>
    control.label === "Align" ? { ...control, left: 360, right: 404 } : control
  )
  assert.deepEqual(detect({ ...phone, controls: wide, scrollWidth: 404 }), [
    "Align clips at 390px",
    "the page scrolls sideways at 390px",
  ])
})

test("overlapping controls, a wrapped desktop row, a third phone row and short phone taps fail", () => {
  const [first, second, ...rest] = desk.controls
  assert.deepEqual(
    detect({
      ...desk,
      controls: [
        first,
        { ...second, left: first.left + 10, right: first.right + 10 },
        ...rest,
      ],
    }),
    ["Undo overlaps Redo at 1440px"]
  )
  assert.deepEqual(
    detect({
      ...desk,
      controls: desk.controls.map((control, index) =>
        index === 11
          ? { ...control, left: 16, right: 56, top: 98, bottom: 130 }
          : control
      ),
    }),
    ["the toolbar wraps to 2 rows at 1440px"]
  )
  assert.deepEqual(
    detect({
      ...phone,
      controls: phone.controls.map((control, index) =>
        index === 11
          ? { ...control, left: 16, right: 60, top: 138, bottom: 174 }
          : control
      ),
    }),
    ["the toolbar takes 3 rows at 390px"]
  )
  assert.deepEqual(
    detect({
      ...phone,
      controls: phone.controls.map((control, index) =>
        index === 0 ? { ...control, bottom: control.top + 32 } : control
      ),
    }),
    ["Undo is shorter than 36px at 390px"]
  )
})
