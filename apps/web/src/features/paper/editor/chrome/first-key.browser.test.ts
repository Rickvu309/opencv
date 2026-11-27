import type { Page } from "playwright-core"
import { expect, it } from "vitest"

import { paperChromePages } from "../../../../test/paper-chrome-harness"
import { detectFirstKey } from "../../../../../../../scripts/lib/paper-keystroke-work.mjs"

const open = paperChromePages()

const idle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestIdleCallback(() => requestIdleCallback(() => resolve()))
      )
  )

it("keeps chrome renders and schema compiles out of the first key", async () => {
  const page = await open({ width: 1440, height: 900 }, false, "en-10")
  try {
    await page.evaluate(() => document.fonts.ready)
    const line = page
      .locator('.paper-editor-page[data-page="1"] .paper-line')
      .nth(5)
    await line.scrollIntoViewIfNeeded()
    await line.click({ force: true })
    await idle(page)
    const before = await page.evaluate(() => window.paperLab!.read().doc)
    expect(await page.evaluate(() => window.paperLab!.history())).toEqual({
      undo: false,
      redo: false,
    })
    await page.evaluate(() => {
      const native = globalThis.Function
      let compiles = 0
      globalThis.Function = new Proxy(native, {
        construct(target, args) {
          compiles += 1
          return Reflect.construct(target, args)
        },
      })
      const probe = window as unknown as {
        paperTestKeyTask: Promise<{
          keyTaskCommits: number
          keyTaskCompiles: number
        }>
      }
      probe.paperTestKeyTask = new Promise((resolve) => {
        document.addEventListener(
          "keydown",
          () => {
            const commits = window.paperTestCommits
            const compiled = compiles
            const channel = new MessageChannel()
            channel.port1.onmessage = () =>
              resolve({
                keyTaskCommits: window.paperTestCommits - commits,
                keyTaskCompiles: compiles - compiled,
              })
            channel.port2.postMessage(null)
          },
          { capture: true, once: true }
        )
      })
    })
    await page.keyboard.press("KeyX")
    const sample = await page.evaluate(
      () =>
        (
          window as unknown as {
            paperTestKeyTask: Promise<{
              keyTaskCommits: number
              keyTaskCompiles: number
            }>
          }
        ).paperTestKeyTask
    )
    expect(detectFirstKey(sample)).toEqual([])
    await expect
      .poll(() => page.evaluate(() => window.paperLab!.history().undo))
      .toBe(true)
    const after = await page.evaluate(() => window.paperLab!.read().doc)
    expect(JSON.stringify(after).length).toBe(JSON.stringify(before).length + 1)
  } finally {
    await page.context().close()
  }
})
