import assert from "node:assert/strict"
import test from "node:test"

import { launchBrowser } from "./launch-browser.mjs"

import { fitProblems } from "../../../packages/ui/src/lib/fit-rules.ts"
import { measureInPage } from "./page-probes.mjs"
import { clearUnderOpenMenu } from "./runner.mjs"

const VIEWPORT = { width: 800, height: 600 }

async function fitOf(body) {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: VIEWPORT })
    await page.setContent(
      `<!doctype html><body style="margin:0">${body}</body>`
    )
    const { boxes, modalOpen } = await page.evaluate(measureInPage, 200)
    return {
      boxes,
      problems: fitProblems(VIEWPORT, boxes.map(clearUnderOpenMenu), modalOpen),
    }
  } finally {
    await browser.close()
  }
}

const bold = (boxes) =>
  boxes.find((box) => box.kind === "control" && box.name.endsWith('"Bold"'))

const TOOLBAR =
  '<div role="toolbar" style="position:absolute;left:20px;top:20px"><button style="width:80px;height:40px">Bold</button></div>'

test("a toolbar button covered by something that is not an open menu is reported", async () => {
  const { boxes, problems } = await fitOf(
    `${TOOLBAR}<div style="position:absolute;left:0;top:0;width:300px;height:300px;background:#fff"></div>`
  )
  assert.equal(bold(boxes).underMenu, false)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /"Bold" cannot be clicked/)
})

test("a toolbar button under a positioner layer beside an open menu is not reported as covered", async () => {
  const { boxes, problems } = await fitOf(
    `${TOOLBAR}<div role="presentation" style="position:absolute;left:0;top:0;width:300px;height:300px"></div><div role="menu" style="position:absolute;left:400px;top:300px;width:200px;height:200px;background:#fff"><button role="menuitem">Open</button></div>`
  )
  assert.equal(bold(boxes).underMenu, true)
  assert.deepEqual(problems, [])
})

test("a toolbar button under a positioner layer with no open menu is reported", async () => {
  const { problems } = await fitOf(
    `${TOOLBAR}<div role="presentation" style="position:absolute;left:0;top:0;width:300px;height:300px"></div>`
  )
  assert.equal(problems.length, 1)
  assert.match(problems[0], /"Bold" cannot be clicked/)
})

test("a toolbar button under the empty part of an open menu's wrapper is not reported as covered", async () => {
  const { boxes, problems } = await fitOf(
    `${TOOLBAR}<div role="presentation" style="position:absolute;left:0;top:0;width:300px;height:300px"><div role="menu" style="position:absolute;left:200px;top:200px;width:80px;height:80px;background:#fff"><button role="menuitem">Open</button></div></div>`
  )
  assert.equal(bold(boxes).underMenu, true)
  assert.deepEqual(problems, [])
})

test("a toolbar button under an open menu is not reported as covered", async () => {
  const { boxes, problems } = await fitOf(
    `${TOOLBAR}<div role="menu" style="position:absolute;left:10px;top:10px;width:200px;height:200px;background:#fff"><button role="menuitem">Open</button></div>`
  )
  assert.equal(bold(boxes).underMenu, true)
  assert.deepEqual(problems, [])
})
