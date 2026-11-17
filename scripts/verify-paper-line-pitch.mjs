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
        for (const id of ["p-atleast", "p-exact"]) {
          const measurement = await page.evaluate((id) => {
            const content = document.querySelector(
              `[data-id="${id}"] .bn-inline-content`
            )
            const walker = document.createTreeWalker(
              content,
              NodeFilter.SHOW_TEXT
            )
            const bottoms = new Set()
            while (walker.nextNode()) {
              if (!walker.currentNode.textContent.trim()) continue
              const range = document.createRange()
              range.selectNodeContents(walker.currentNode)
              for (const rect of range.getClientRects()) {
                bottoms.add(Math.round(rect.bottom * 100) / 100)
              }
            }
            const lines = [...bottoms].sort((a, b) => a - b)
            const scale =
              content.getBoundingClientRect().width / content.offsetWidth
            return {
              lines: lines.length,
              pitches: lines
                .slice(1)
                .map((bottom, i) => ((bottom - lines[i]) / scale) * 0.75),
            }
          }, id)
          assert.ok(measurement.lines >= 3, `${id} must wrap to three lines`)
          for (const pitch of measurement.pitches) {
            assert.ok(
              Math.abs(pitch - 12.65) < 0.12,
              `${route} at ${width}: ${id} rendered ${pitch.toFixed(3)}pt, expected 12.65pt`
            )
          }
          process.stdout.write(
            `${JSON.stringify({ route, width, id, ...measurement })}\n`
          )
        }
      } finally {
        await context.close()
      }
    }
  }
} finally {
  await browser.close()
}
