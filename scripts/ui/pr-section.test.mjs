import assert from "node:assert/strict"
import test from "node:test"
import {
  attachUrls,
  checkSummary,
  linksFromShot,
  picturesToUpload,
  renderPrSection,
} from "./pr-section.mjs"

const MANIFEST = {
  baseSha: "29c4ce33aaaa",
  captures: [
    {
      screen: "paper-panel-open",
      width: 1440,
      viewport: { width: 1440, height: 900 },
      before: { file: "p.before.png" },
      after: { file: "p.after.png" },
    },
    {
      screen: "coach-chat-finished",
      width: 1440,
      viewport: { width: 1440, height: 900 },
      before: { error: "step 2 failed" },
      after: { file: "c.after.png" },
    },
  ],
}

test("the uploads are the composite then every captured side, matched to shot's links in order", () => {
  const pictures = picturesToUpload(MANIFEST, "/x/annotated.png")
  assert.deepEqual(
    pictures.map((picture) => picture.file),
    ["/x/annotated.png", "p.before.png", "p.after.png", "c.after.png"]
  )
  const links = linksFromShot([
    "Uploaded 4 picture(s) to release screenshots (not committed).",
    "![annotated](https://h/a.png)",
    "![p before](https://h/pb.png)",
    "![p after](https://h/pa.png)",
    "![c after](https://h/ca.png)",
    "No comment posted (--no-comment).",
  ])
  const uploaded = attachUrls(pictures, links)
  assert.equal(uploaded[2].url, "https://h/pa.png")
  assert.throws(
    () => attachUrls(pictures, links.slice(1)),
    /uploaded 4 pictures but shot printed 3 links/
  )
})

test("the section opens with the composite, then the main / this PR table, then the check summary", () => {
  const uploaded = attachUrls(
    picturesToUpload(MANIFEST, "a.png"),
    ["a", "pb", "pa", "ca"].map((name) => ({ url: `https://h/${name}.png` }))
  )
  const text = renderPrSection({
    manifest: MANIFEST,
    uploaded,
    checks: [
      { screen: "paper-panel-open", compared: 20, failed: 0 },
      { screen: "coach-chat-finished", error: "no design rows" },
    ],
  })
  const lines = text.split("\n")
  assert.equal(lines[0], "## Before / after")
  assert.equal(lines[2], "![Annotated before and after](https://h/a.png)")
  assert.match(
    text,
    /Linux renders at 1440 by 900, same steps and fake Coach on both sides; main is 29c4ce33\./
  )
  assert.ok(lines.indexOf("| main | this PR |") > 2)
  assert.ok(
    lines.includes(
      "| ![paper-panel-open 1440 main](https://h/pb.png) | ![paper-panel-open 1440 this PR](https://h/pa.png) |"
    )
  )
  assert.ok(
    lines.includes(
      "| not captured: step 2 failed | ![coach-chat-finished 1440 this PR](https://h/ca.png) |"
    )
  )
  assert.ok(lines.includes("| paper-panel-open | 20 | 0 |"))
  assert.ok(lines.includes("| coach-chat-finished | no design rows | |"))
})

test("the check summary is the last JSON line for the screen, or the error line", () => {
  assert.deepEqual(
    checkSummary("s", {
      lines: [
        "s at 1440x900",
        "| a |",
        '{"screen":"s","compared":3,"failed":1}',
      ],
    }),
    { screen: "s", compared: 3, failed: 1 }
  )
  assert.deepEqual(
    checkSummary("s", { lines: ["ui check: no design rows for s"] }),
    {
      screen: "s",
      error: "ui check: no design rows for s",
    }
  )
})
