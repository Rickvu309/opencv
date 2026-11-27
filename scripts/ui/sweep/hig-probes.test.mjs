import assert from "node:assert/strict"
import test from "node:test"

import { launchBrowser } from "./launch-browser.mjs"

import { scaleTextInPage, textClipsInPage } from "./hig-probes.mjs"

const LIMIT = 200

async function textAt200(body) {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({
      viewport: { width: 800, height: 600 },
    })
    await page.setContent(
      `<!doctype html><body style="margin:0">${body}</body>`
    )
    await page.evaluate(textClipsInPage, { phase: "base", limit: LIMIT })
    await page.evaluate(scaleTextInPage, 2)
    return await page.evaluate(textClipsInPage, {
      phase: "scaled",
      limit: LIMIT,
    })
  } finally {
    await browser.close()
  }
}

test("chrome text that keeps its size at 200% is reported as not growing", async () => {
  const found = await textAt200(
    '<nav><button style="font-size:14px">Font picker</button></nav>'
  )
  assert.deepEqual(
    found.map((item) => [item.name, item.how]),
    [['"Font picker"', "did not grow"]]
  )
})

test("painted Paper page lines keep their size at 200% without a finding", async () => {
  const found = await textAt200(
    '<div class="paper-editor-page" data-page="0" style="position:relative;width:600px;height:800px"><div class="paper-line" style="position:absolute;left:10px;top:10px"><span class="paper-run" style="font-size:12px">Painted line</span></div></div>'
  )
  assert.deepEqual(found, [])
})

test("a paper line outside the Paper page is still reported as not growing", async () => {
  const found = await textAt200(
    '<div class="paper-line"><span class="paper-run" style="font-size:12px">Stray line</span></div>'
  )
  assert.deepEqual(
    found.map((item) => item.how),
    ["did not grow"]
  )
})
