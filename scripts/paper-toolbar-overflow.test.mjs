import assert from "node:assert/strict"
import test from "node:test"
import { detect } from "./lib/paper-toolbar-overflow.mjs"

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
