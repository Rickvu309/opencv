import assert from "node:assert/strict"
import { mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"

import { launchBrowser } from "../.claude/skills/verify-landing/scripts/lib/cdp.mjs"
import { BLOG_POSTS } from "../apps/web/src/features/landing/blog/blog-copy.ts"
import { BLOG_COVER_STORIES } from "../apps/web/src/features/landing/blog/blog-cover-stories.ts"

const [
  origin,
  evidence = resolve(homedir(), "tmp", "opencv-marketing-design"),
] = process.argv.slice(2)
if (!origin)
  throw new Error(
    "usage: node scripts/verify-marketing-design.mjs <local web origin> [evidence directory]"
  )
assert(
  ["localhost", "127.0.0.1"].includes(new URL(origin).hostname),
  "Verify a local worktree server"
)
mkdirSync(evidence, { recursive: true })
const browser = await launchBrowser()
const results = []

async function visit(route, width) {
  const page = await browser.openPage({
    width,
    height: 1000,
    mobile: width < 500,
    url: new URL(route, origin).href,
  })
  try {
    await page.evaluate(`new Promise((resolve, reject) => {
      const ready = () => {
        if (!document.querySelector('h1')) return
        clearTimeout(timer)
        observer.disconnect()
        document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      }
      const observer = new MutationObserver(ready)
      const timer = setTimeout(() => { observer.disconnect(); reject(Error('Page did not render')) }, 15000)
      observer.observe(document, { subtree: true, childList: true })
      ready()
    })`)
    assert.equal(
      await page.evaluate("document.documentElement.scrollWidth > innerWidth"),
      false,
      `${route} overflows at ${width}`
    )
    if (route === "/pricing") {
      const metrics = await page.evaluate(`(() => {
        const plans = [...document.querySelectorAll('[aria-label="Plans"] article')]
        const table = document.querySelector('table')
        return {
          titleSize: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
          planWidth: Math.max(...plans.map(p => p.getBoundingClientRect().right)) - Math.min(...plans.map(p => p.getBoundingClientRect().left)),
          buttons: plans.map(p => { const a = p.querySelector('a'); return { height: a.getBoundingClientRect().height, width: a.getBoundingClientRect().width, href: a.getAttribute('href') } }),
          headingSizes: [...document.querySelectorAll('#included-title, #compare-title, #faq-title')].map(h => parseFloat(getComputedStyle(h).fontSize)),
          table: table?.textContent,
          tableWidth: table?.getBoundingClientRect().width,
          compareWidth: table?.parentElement.clientWidth,
          valueWidth: table?.querySelector("thead th:nth-child(2)").getBoundingClientRect().width,
          checks: table?.querySelectorAll('svg').length,
          proBackground: plans[1] ? getComputedStyle(plans[1]).backgroundImage : null
        }
      })()`)
      assert.equal(metrics.buttons.length, 2, "Two pricing plans")
      assert(
        metrics.tableWidth <= metrics.compareWidth + 1,
        "All comparison columns fit on screen"
      )
      for (const button of metrics.buttons) {
        assert.equal(button.height, 44, "Plan buttons match the 44px design")
        assert(button.href.endsWith("/sign-in"), "Plan CTA reaches sign in")
      }
      assert(
        metrics.checks > 0,
        "Compare uses check icons for included features"
      )
      assert(
        !metrics.table.includes("Not included"),
        "Compare uses the design's dash for unavailable features"
      )
      assert.notEqual(
        metrics.proBackground,
        "none",
        "Pro has its source mesh surface"
      )
      if (width === 1440) {
        assert.equal(
          metrics.planWidth,
          880,
          "Pricing uses its own 880px column"
        )
        assert.equal(metrics.titleSize, 56, "Pricing title has its own scale")
        assert(
          Math.abs(metrics.valueWidth - 180) < 1,
          "Desktop comparison values keep their 180px columns"
        )
        assert(
          metrics.headingSizes.length === 3 &&
            metrics.headingSizes.every((size) => size === 24),
          "Pricing section titles are 24px"
        )
      }
      results.push({ route, width, metrics })
    } else {
      const post = BLOG_POSTS.find((post) => route === `/blog/${post.slug}`)
      assert(post)
      if (post.cover !== "b2b-sales") {
        const story = BLOG_COVER_STORIES[post.cover]
        const required = Object.entries(story)
          .filter(([key]) => !["kind", "description"].includes(key))
          .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
        const drawing = await page.evaluate(`(() => {
          const svg = document.querySelector('.blog-cover-story')
          if (!svg) return null
          const bounds = svg.getBoundingClientRect()
          return { label: svg.getAttribute('aria-label'), texts: [...svg.querySelectorAll('text')].map(text => {
            const rect = text.getBoundingClientRect()
            return { text: text.textContent, visible: rect.width > 0 && rect.height > 0 && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1 }
          }) }
        })()`)
        assert(drawing, `${post.slug} has an editorial diagram`)
        assert.equal(drawing.label, story.description)
        for (const label of required)
          assert(
            drawing.texts.some((text) => text.text === label && text.visible),
            `${post.slug}: visible ${label} at ${width}`
          )
      } else {
        assert(
          await page.evaluate(
            "!!document.querySelector('.blog-cover-art svg')"
          ),
          "Source-generated B2B art remains present"
        )
      }
      await page.evaluate(
        "scrollTo(0, Math.max(0, document.querySelector('.blog-cover').getBoundingClientRect().top + scrollY - 150))"
      )
      results.push({ route, width, cover: post.cover, overflow: false })
    }
    await page.screenshot(
      resolve(
        evidence,
        `${route.split("/").filter(Boolean).join("-")}-${width}.png`
      ),
      route === "/pricing"
    )
    console.log(`PASS ${route} ${width}`)
    await page.close()
  } catch (error) {
    throw new Error(`${route} at ${width}: ${error.message}`, { cause: error })
  }
}

try {
  const cases = [1440, 390].flatMap((width) =>
    ["/pricing", ...BLOG_POSTS.map((post) => `/blog/${post.slug}`)].map(
      (route) => ({ route, width })
    )
  )
  for (let index = 0; index < cases.length; index += 3) {
    const outcomes = await Promise.allSettled(
      cases
        .slice(index, index + 3)
        .map(({ route, width }) => visit(route, width))
    )
    for (const outcome of outcomes)
      if (outcome.status === "rejected") throw outcome.reason
  }
  writeFileSync(
    resolve(evidence, "results.json"),
    `${JSON.stringify(results, null, 2)}\n`
  )
  console.log(`PASS ${results.length} rendered pages; evidence: ${evidence}`)
} finally {
  await browser.quit()
}
