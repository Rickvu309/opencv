import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { realPorts } from "./ui/ports.mjs"

const [stateFile, ...routes] = process.argv.slice(2)
assert.ok(
  stateFile && routes.length,
  "Pass a UI state file and real Paper URLs"
)
const state = JSON.parse(readFileSync(stateFile, "utf8"))
const browser = await realPorts().browser.launch()
try {
  for (const route of routes) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        storageState: state.storage,
        viewport: { width, height: 1000 },
      })
      try {
        const page = await context.newPage()
        await page.goto(route)
        await page.locator('[data-id="p-exact"] .bn-inline-content').waitFor()
        await page.evaluate(() => document.fonts.ready)
        for (const [id, expected, mixed] of [
          ["p-atleast", 12.65, false],
          ["p-exact", 12.65, false],
          ["p-small", 9.2, false],
          ["p-large", 27.6, false],
          ["p-mixed", 12.65, true],
          ["p-mixed-small", 9.2, true],
        ]) {
          const measurement = await page.evaluate((id) => {
            const content = document.querySelector(
              `[data-id="${id}"] .bn-inline-content`
            )
            const walker = document.createTreeWalker(
              content,
              NodeFilter.SHOW_TEXT
            )
            const bottoms = new Set()
            const rects = []
            let firstRunHeight = 0
            while (walker.nextNode()) {
              if (!walker.currentNode.textContent.trim()) continue
              const range = document.createRange()
              range.selectNodeContents(walker.currentNode)
              for (const rect of range.getClientRects()) {
                rects.push({ top: rect.top, bottom: rect.bottom })
                if (!firstRunHeight) firstRunHeight = rect.height
                bottoms.add(Math.round(rect.bottom * 100) / 100)
              }
            }
            const lines = [...bottoms].sort((a, b) => a - b)
            const scale =
              content.getBoundingClientRect().width / content.offsetWidth
            const firstTop = Math.min(...rects.map((rect) => rect.top))
            const firstBottom = Math.max(
              ...rects
                .filter((rect) => rect.top < rects[0].bottom)
                .map((rect) => rect.bottom)
            )
            const nextTop = Math.min(
              ...rects
                .filter((rect) => rect.top >= firstBottom)
                .map((rect) => rect.top)
            )
            return {
              lines: lines.length,
              firstRunHeight: (firstRunHeight / scale) * 0.75,
              firstLineAdvance: ((nextTop - firstTop) / scale) * 0.75,
              pitches: lines
                .slice(1)
                .map((bottom, i) => ((bottom - lines[i]) / scale) * 0.75),
            }
          }, id)
          assert.ok(measurement.lines >= 3, `${id} must wrap to three lines`)
          const consecutive = measurement.pitches.filter(
            (pitch) => pitch < Math.max(40, expected * 2)
          )
          assert.ok(
            consecutive.length >= 3,
            `${id} has consecutive lines on a page`
          )
          const pitches = mixed ? consecutive.slice(-3) : consecutive
          if (mixed)
            assert.ok(
              measurement.firstRunHeight > expected + 8 &&
                measurement.firstLineAdvance > expected + 8,
              `${id} must grow for the large run`
            )
          for (const pitch of pitches) {
            assert.ok(
              Math.abs(pitch - expected) < 0.12,
              `${route} at ${width}: ${id} rendered ${pitch.toFixed(3)}pt, expected ${expected}pt`
            )
          }
          process.stdout.write(
            `${JSON.stringify({ route, width, id, ...measurement })}\n`
          )
        }
        const emptyHeight = await page
          .locator('[data-id="p-empty"] .bn-inline-content')
          .evaluate((content) => content.offsetHeight)
        assert.ok(
          emptyHeight >= 14,
          "Empty paragraphs retain a visible caret line"
        )
      } finally {
        await context.close()
      }
    }
  }
} finally {
  await browser.close()
}
