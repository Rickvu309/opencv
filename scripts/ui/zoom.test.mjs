import assert from "node:assert/strict"
import test from "node:test"
import { compositeFiles, sectionSlug } from "./annotate-split.mjs"
import { legendRows } from "./annotate.mjs"
import { picturesToUpload, renderPrSection } from "./pr-section.mjs"
import { ZOOM, calloutZooms, needsZoom, zoomRects } from "./zoom.mjs"

const box = (x, y, width, height) => ({ x, y, width, height })
const bounds = { width: 1440, height: 900 }

test("a crop is drawn when every edge moves under 8px or the element is under 40px", () => {
  assert.equal(
    needsZoom(box(100, 100, 400, 300), box(103, 100, 400, 300)),
    true
  )
  assert.equal(
    needsZoom(box(100, 100, 400, 300), box(100, 100, 420, 300)),
    false
  )
  assert.equal(needsZoom(box(10, 10, 48, 24), box(400, 700, 58, 32)), true)
  assert.equal(needsZoom(box(10, 10, 48, 24), null), false)
  assert.equal(needsZoom(box(10, 10, 0, 0), box(10, 10, 0, 0)), false)
})

test("a small change shares one crop rectangle on both sides, padded and kept inside the image", () => {
  const rects = zoomRects(box(100, 100, 32, 32), box(103, 100, 32, 32), bounds)
  assert.deepEqual(
    rects.before,
    box(100 - ZOOM.pad, 100 - ZOOM.pad, 35 + 24, 32 + 24)
  )
  assert.equal(rects.before, rects.after)
  const corner = zoomRects(box(2, 2, 20, 20), box(4, 2, 20, 20), bounds)
  assert.equal(corner.before.x, 0)
  assert.equal(corner.before.y, 0)
})

test("a target that moved far gets same-size crops around each side's box", () => {
  const rects = zoomRects(box(10, 10, 48, 24), box(400, 700, 58, 32), bounds)
  assert.deepEqual(rects.before, box(0, 0, 82, 56))
  assert.deepEqual(rects.after, box(388, 688, 82, 56))
  const wide = zoomRects(box(100, 100, 600, 24), box(102, 100, 600, 24), bounds)
  assert.equal(wide.before.width, ZOOM.maxWidth)
})

test("zooms read image boxes in device pixels and the legend gives each zoomed number its own row", () => {
  const side = (boxes) => ({
    scale: 2,
    size: { width: 2880, height: 1800 },
    boxes: new Map(boxes),
  })
  const zooms = calloutZooms([{ n: 1 }, { n: 2 }], {
    before: side([
      [1, box(200, 200, 64, 64)],
      [2, box(0, 0, 1000, 1000)],
    ]),
    after: side([
      [1, box(206, 200, 64, 64)],
      [2, box(0, 0, 1400, 1000)],
    ]),
  })
  assert.deepEqual([...zooms.keys()], [1])
  assert.deepEqual(zooms.get(1).targets.after, box(103, 100, 32, 32))
  const rows = legendRows(
    [
      { n: 1, note: "a" },
      { n: 2, note: "b" },
      { n: 3, note: "c" },
      { n: 4, note: "d" },
    ],
    2,
    new Map([[2, { zoom: true }]])
  )
  assert.deepEqual(
    rows.map((row) => row.map((item) => item.n)),
    [[1], [2], [3, 4]]
  )
})

test("more than two sections split into one composite per section named from the title", () => {
  const sections = [
    { title: "Coach approval, expanded Chat (1440)" },
    { title: "Après Deny" },
    { title: "Après Deny" },
  ]
  assert.equal(
    sectionSlug("Coach approval, expanded Chat (1440)"),
    "coach-approval-expanded-chat-1440"
  )
  assert.deepEqual(compositeFiles(sections, "/s/split"), [
    { out: "/s/split/coach-approval-expanded-chat-1440.png", sections: [0] },
    { out: "/s/split/apres-deny.png", sections: [1] },
    { out: "/s/split/apres-deny-2.png", sections: [2] },
  ])
  assert.equal(
    compositeFiles(sections, "/s/ui.png")[1].out,
    "/s/ui-apres-deny.png"
  )
  assert.deepEqual(compositeFiles(sections, "/s/ui.png", { single: true }), [
    { out: "/s/ui.png", sections: [0, 1, 2] },
  ])
  assert.deepEqual(compositeFiles(sections.slice(0, 2), "/s/ui.png"), [
    { out: "/s/ui.png", sections: [0, 1] },
  ])
})

test("pr-section embeds every composite in the order given before the table", () => {
  const manifest = { baseSha: "abcdef0123", captures: [] }
  const pictures = picturesToUpload(manifest, [
    "/a/first-screen.png",
    "/a/second-screen.png",
  ])
  const uploaded = pictures.map((picture, at) => ({
    ...picture,
    url: `https://x/${at}`,
  }))
  const text = renderPrSection({ manifest, uploaded })
  const first = text.indexOf(
    "![Annotated before and after: first screen](https://x/0)"
  )
  const second = text.indexOf(
    "![Annotated before and after: second screen](https://x/1)"
  )
  assert.ok(first > 0 && second > first)
  assert.ok(text.indexOf("| main | this PR |") > second)
})
