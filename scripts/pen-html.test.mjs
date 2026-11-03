import assert from "node:assert/strict"
import { test } from "node:test"

import { penFrameToDocument, penNodeToHtml } from "./pen-html.mjs"

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

test("an absolute child leaves its parent's flex flow and sits at its own x and y", () => {
  const parent = {
    id: "p",
    type: "frame",
    layout: "vertical",
    width: 100,
    height: 80,
    children: [
      {
        id: "flow",
        type: "rectangle",
        x: 1,
        y: 2,
        width: 10,
        height: 10,
      },
      {
        id: "free",
        type: "rectangle",
        layoutPosition: "absolute",
        x: 12,
        y: 8,
        width: 10,
        height: 10,
      },
    ],
  }
  const html = penNodeToHtml(parent, null, ctx)
  assert.match(
    html,
    /data-id="free"[^>]*style="[^"]*position:absolute;left:12px;top:8px;/
  )
  assert.match(html, /data-id="flow"[^>]*style="[^"]*position:relative;/)
})

test("sizes, gaps, paddings and radii that name a number variable become that number", () => {
  const html = penFrameToDocument(
    { variables: { "ds-fs-small": 12 } },
    {
      id: "f",
      type: "frame",
      layout: "vertical",
      width: 40,
      height: 40,
      gap: "$ds-fs-small",
      padding: "$ds-fs-small",
      cornerRadius: "$ds-fs-small",
      children: [],
    },
    { assetBase: "", fontFace: "" }
  )
  assert.match(html, /gap:12px/)
  assert.match(html, /padding:12px 12px 12px 12px/)
  assert.match(html, /border-radius:12px/)
  assert.doesNotMatch(html, /\$ds-fs-small/)
})
