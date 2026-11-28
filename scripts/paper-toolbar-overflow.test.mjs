import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { detect, detectMeasurement } from "./lib/paper-toolbar-overflow.mjs"

const layout = {
  viewport: 320,
  left: 12,
  right: 308,
  gap: 4,
  remaining: 20,
  overflow: true,
  controls: [
    { label: "Undo document edit", left: 12, right: 56 },
    { label: "Redo document edit", left: 60, right: 104 },
    { label: "Bold", left: 113, right: 157 },
    { label: "Italic", left: 161, right: 205 },
    { label: "More formatting", left: 209, right: 253 },
  ],
  candidates: [
    { label: "Bold", width: 44, visible: true },
    { label: "Italic", width: 44, visible: true },
    { label: "Underline", width: 44, visible: false },
  ],
}

test("Paper's geometry guard accepts fitting controls and refuses clipping", () => {
  assert.deepEqual(detect(layout), [])
  assert.match(
    detect({ ...layout, right: 240 }).join("\n"),
    /More formatting clips/
  )
  for (const name of ["Undo", "Redo", "More"])
    assert.match(
      detect({
        ...layout,
        controls: layout.controls.filter(
          (item) => !item.label.startsWith(name)
        ),
      }).join("\n"),
      new RegExp(`${name} is missing`)
    )
})

test("Paper's geometry guard refuses an empty slot that fits the next control", () => {
  assert.deepEqual(detect({ ...layout, remaining: 48 }), [
    "Underline fits but is hidden at 320px",
  ])
})

test("Paper's desktop geometry guard preserves main's controls and separators", () => {
  const desktop = {
    ...layout,
    viewport: 1440,
    overflow: false,
    separators: 4,
    expected: {
      controls: layout.controls.map((control) => control.label),
      separators: 4,
    },
  }
  assert.deepEqual(detect(desktop), [])
  assert.match(
    detect({ ...desktop, controls: desktop.controls.slice(0, -1) }).join("\n"),
    /Desktop controls differ/
  )
  assert.match(
    detect({ ...desktop, separators: 1 }).join("\n"),
    /Desktop separators differ/
  )
})

test("unmeasured and remounted toolbars retain their controls", () => {
  const clean = `
    const unmeasuredLayout = { visible: ["Bold", "Italic", "Underline"], more: true, iconOnly: false }
    useReducer(reduce, unmeasuredLayout)
    if (!(width > 0)) {
      update(unmeasuredLayout)
      return
    }
    useLayoutEffect(measure, [host, editor])
  `
  assert.deepEqual(detectMeasurement(clean), [])
  const mistake = clean
    .replace('["Bold", "Italic", "Underline"]', "[]")
    .replace("update(unmeasuredLayout)", "return")
    .replace("[host, editor]", "[host]")
  assert.equal(detectMeasurement(mistake).length, 3)
  assert.equal(
    detectMeasurement(clean.replace("if (!(width > 0))", "if (false)")).length,
    1
  )
  assert.deepEqual(
    detectMeasurement(
      readFileSync(
        new URL(
          "../apps/web/src/features/paper/rich-editor/rich-text-toolbar-overflow.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})

test("Paper's geometry guard rejects overlapping controls and a Font below its readable floor", () => {
  const font = { label: "Font", width: 112, minimum: 112, visible: true }
  const clean = {
    ...layout,
    viewport: 1290,
    controls: [
      ...layout.controls,
      { label: "Font", left: 482, right: 594 },
      { label: "Text size", left: 598, right: 678 },
    ],
    candidates: [...layout.candidates, font],
    right: 1280,
  }
  assert.deepEqual(detect(clean), [])
  const mistake = {
    ...clean,
    controls: clean.controls.map((control) =>
      control.label === "Font"
        ? { ...control, left: 482, right: 500 }
        : control.label === "Text size"
          ? { ...control, left: 490, right: 570 }
          : control
    ),
    candidates: [...layout.candidates, { ...font, width: 18 }],
  }
  assert.deepEqual(detect(mistake), [
    "Font overlaps Text size at 1290px",
    "Font is below its floor at 1290px",
  ])
  assert.deepEqual(
    detect({
      ...clean,
      controls: [
        ...clean.controls,
        { label: "Strikethrough", left: 610, right: 650 },
        { label: "Highlight", left: 660, right: 700 },
      ],
    }),
    [
      "Text size overlaps Strikethrough at 1290px",
      "Text size overlaps Highlight at 1290px",
    ]
  )
})

test("Paper's geometry guard keeps paired indent controls on the same surface", () => {
  const decrease = {
    label: "Decrease indent",
    width: 32,
    visible: false,
    pair: "indent",
  }
  const increase = {
    label: "Increase indent",
    width: 32,
    visible: false,
    pair: "indent",
  }
  const clean = { ...layout, remaining: 40, candidates: [decrease, increase] }
  assert.deepEqual(detect(clean), [])
  assert.match(
    detect({
      ...clean,
      candidates: [decrease, { ...increase, visible: true }],
    }).join("\n"),
    /indent pair is split/
  )
})
