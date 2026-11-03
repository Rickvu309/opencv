import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { launchBrowser } from "../.claude/skills/verify-app-ui/scripts/lib/cdp.mjs"
import { signInThrowaway } from "../.claude/skills/verify-app-ui/scripts/lib/session.mjs"

const FOCUS_FIRST_IDEA_BUTTON = `document.querySelector('[data-slot="coach-ideas"] button').focus()`

const [webUrl, apiUrl, logPath, output] = process.argv.slice(2)
assert(
  output,
  "usage: node scripts/verify-coach-home-pane.mjs <web> <api> <api log> <output>"
)
for (const origin of [webUrl, apiUrl])
  assert(
    ["localhost", "127.0.0.1"].includes(new URL(origin).hostname),
    "Local verification only"
  )
const root = new URL("../", import.meta.url)
const sourceFiles = [
  "apps/web/src/features/coach/coach-home.tsx",
  "apps/web/src/features/coach/coach-workspace.tsx",
  "apps/web/src/features/coach/design/home.pen.css",
  "apps/web/src/features/coach/design/new-chat.styles.json",
  "apps/web/src/features/coach/design/ideas.styles.json",
  "scripts/verify-coach-home-pane.mjs",
]
const hashes = () =>
  Object.fromEntries(
    sourceFiles.map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(new URL(file, root)))
        .digest("hex"),
    ])
  )
const before = hashes()
mkdirSync(output, { recursive: true })
const records = []
const browser = await launchBrowser()
try {
  for (const width of [1440, 390, 360, 320]) {
    const page = await browser.openPage({
      width,
      height: width === 1440 ? 900 : 844,
      mobile: width < 500,
      reducedMotion: true,
    })
    try {
      if (width === 1440)
        await signInThrowaway({
          page,
          webUrl,
          apiUrl,
          logPath,
          name: "Pen Layout",
          prefix: "pen-layout",
        })
      await page.goto(`${webUrl}/coach`)
      assert(
        await page.waitFor(
          `document.querySelector('[data-slot="coach-home"]') && document.fonts.status === 'loaded'`
        ),
        "Coach home ready"
      )
      for (const moreIdeas of [false, true]) {
        if (moreIdeas) {
          const button = await page.evaluate(
            `(() => { const r = document.querySelector('[data-slot="coach-ideas"] button').getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 } })()`
          )
          await page.mouse("mousePressed", button.x, button.y)
          await page.mouse("mouseReleased", button.x, button.y)
          assert(
            await page.waitFor(
              `document.querySelector('[data-slot="coach-ideas"] [aria-pressed="true"]')`
            ),
            "More ideas switches set"
          )
        }
        const metrics = await page.evaluate(`(() => {
          const home = document.querySelector('[data-slot="coach-home"]');
          const heading = home.querySelector('h2');
          const style = getComputedStyle(heading);
          const range = document.createRange(); range.selectNodeContents(heading);
          const rect = e => { const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height } };
          return { width:innerWidth, overflow:document.documentElement.scrollWidth > innerWidth,
            heading:{...rect(heading), textBounds:rect(range), text:heading.textContent, size:parseFloat(style.fontSize), weight:style.fontWeight, tracking:parseFloat(style.letterSpacing), font:style.fontFamily},
            composer:rect(home.querySelector('[data-slot="coach-composer"]')),
            ideas:rect(home.querySelector('[data-slot="coach-ideas"]')),
            buttons:[...home.querySelectorAll('[data-slot="coach-ideas"] button')].map(e=>({...rect(e), text:e.textContent, size:parseFloat(getComputedStyle(e).fontSize)})) }
        })()`)
        const source = JSON.parse(
          readFileSync(
            new URL(
              `apps/web/src/features/coach/design/${moreIdeas ? "ideas" : "new-chat"}.styles.json`,
              root
            )
          )
        )
        const labels = source.sections.flatMap((s) =>
          s.texts.map((t) => t.content)
        )
        assert.equal(metrics.overflow, false, "No page overflow")
        assert.equal(metrics.heading.text, labels[1])
        assert.equal(metrics.heading.size, 26)
        assert.equal(metrics.heading.weight, "600")
        assert.equal(metrics.heading.tracking, -0.8)
        assert.match(metrics.heading.font, /Inter/)
        assert.deepEqual(
          metrics.buttons.map((b) => b.text),
          ["More ideas", ...labels.slice(5)]
        )
        for (const b of metrics.buttons) {
          assert.equal(b.size, 14)
          assert(
            b.height >= (width < 500 ? 44 : 40),
            "Suggestion target height"
          )
        }
        assert.equal(
          metrics.ideas.y - metrics.composer.y - metrics.composer.height,
          14
        )
        if (width === 1440) {
          assert.equal(metrics.composer.width, 680)
          const layout = JSON.parse(
            readFileSync(
              new URL(
                `apps/web/src/features/coach/design/${moreIdeas ? "ideas" : "new-chat"}.layout.json`,
                root
              )
            )
          )
          const heading = layout.texts.find(
            (t) => t.text === metrics.heading.text
          )
          assert(
            Math.abs(metrics.heading.textBounds.x - (244 + heading.x)) <= 1,
            "Source heading x"
          )
          assert(
            Math.abs(metrics.heading.textBounds.y - (8 + heading.y)) <= 1,
            "Source heading y"
          )
        }
        await page.screenshot(
          resolve(output, `${moreIdeas ? "ideas" : "new-chat"}-${width}.png`),
          false
        )
        await page.evaluate(FOCUS_FIRST_IDEA_BUTTON)
        for (let index = 1; index < metrics.buttons.length; index++)
          await page.key("Tab")
        const keyboard = await page.evaluate(
          `(() => { const e=document.activeElement, r=e.getBoundingClientRect(), p=e.parentElement.getBoundingClientRect(); return {text:e.textContent, visible:r.left>=p.left-1 && r.right<=p.right+1, scrollLeft:e.parentElement.scrollLeft, fade:getComputedStyle(document.querySelector('[data-slot="coach-ideas-fade"]')).visibility} })()`
        )
        assert.equal(keyboard.text, metrics.buttons.at(-1).text)
        assert.equal(
          keyboard.fade,
          "hidden",
          "Fade does not cover the focused final suggestion"
        )
        assert(
          keyboard.visible,
          "Last suggestion scrolls into view on keyboard focus"
        )
        await page.screenshot(
          resolve(
            output,
            `keyboard-${moreIdeas ? "ideas" : "new-chat"}-${width}.png`
          ),
          false
        )
        records.push({ moreIdeas, metrics, keyboard })
        await page.evaluate(FOCUS_FIRST_IDEA_BUTTON)
      }
    } finally {
      await page.close()
    }
  }
  assert.deepEqual(hashes(), before, "Source unchanged during capture")
  writeFileSync(
    resolve(output, "result.json"),
    JSON.stringify(
      {
        scope: "New-chat heading and ideas; no whole-frame parity score",
        sourceHashes: before,
        records,
      },
      null,
      2
    )
  )
  console.log(
    `PASS: ${records.length} pane states, desktop and 320/360/390; screenshots and source hashes in ${output}`
  )
} finally {
  await browser.quit()
}
