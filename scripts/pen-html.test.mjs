import assert from "node:assert/strict"
import { test } from "node:test"

import { penNodeToHtml } from "./pen-html.mjs"

const ctx = { variables: {}, assetBase: "" }
const frame = {
  id: "root",
  type: "frame",
  layout: "none",
  width: 200,
  height: 100,
  children: [
    {
      id: "i1",
      type: "icon",
      icon: "search",
      x: 0,
      y: 0,
      width: 16,
      height: 16,
    },
    {
      id: "b1",
      type: "frame",
      name: 'Digit "1"',
      x: 20,
      y: 0,
      width: 40,
      height: 40,
      stroke: "#000000",
    },
    {
      id: "b2",
      type: "frame",
      name: "Plain",
      x: 70,
      y: 0,
      width: 40,
      height: 40,
    },
  ],
}

test("an icon node is tagged with its icon name", () => {
  assert.match(
    penNodeToHtml(frame, null, ctx),
    /data-id="i1" data-pen-icon="search"/
  )
})

test("a stroked frame is tagged as a drawn box and an unstroked one is not", () => {
  const html = penNodeToHtml(frame, null, ctx)
  assert.match(html, /data-id="b1" data-pen-box="Digit &quot;1&quot;"/)
  assert.doesNotMatch(html, /data-id="b2" data-pen-box/)
})
