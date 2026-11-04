import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const option = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index < 0 ? undefined : process.argv[index + 1]
}
const repo = resolve(
  option("repo") ??
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
)
const webUrl = option("web") ?? process.env.WEB_URL
const apiUrl = option("api") ?? process.env.API_URL
const logPath = option("log") ?? process.env.API_LOG
const output = option("output")
if (!webUrl || !apiUrl || !logPath || !output)
  throw new Error(
    "Usage: node verify-coach-scroll.mjs --web URL --api URL --log API_LOG --output DIR [--repo DIR]"
  )
for (const url of [webUrl, apiUrl]) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
    throw new Error("Only isolated local stacks are supported")
}
const { launchBrowser } = await import(
  pathToFileURL(join(repo, ".claude/skills/verify-app-ui/scripts/lib/cdp.mjs"))
)
const { signInThrowaway } = await import(
  pathToFileURL(
    join(repo, ".claude/skills/verify-app-ui/scripts/lib/session.mjs")
  )
)
mkdirSync(output, { recursive: true })
const report = {
  sha: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
  }).trim(),
  webUrl,
  apiUrl,
  runtime: "real local fake Coach API; no route fixtures",
  scenarios: [],
}
const browser = await launchBrowser()
const panel = 'main [data-slot="coach-panel-body"][data-presentation="page"]'
const textarea = `${panel} textarea[aria-label="Message Coach"]`
const selector = (value) => JSON.stringify(value)
const frames = (page) =>
  page.evaluate(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
  )
async function click(page, target) {
  const point = await page.evaluate(`(() => {
    const element = document.querySelector(${selector(target)})
    if (!element) throw new Error('Missing control: ' + ${selector(target)})
    const box = element.getBoundingClientRect()
    const x = box.left + box.width / 2, y = box.top + box.height / 2
    const hit = document.elementFromPoint(x, y)
    if (!box.width || !box.height || !hit || !element.contains(hit)) throw new Error('Control is outside the viewport or covered: ' + ${selector(target)})
    return { x, y }
  })()`)
  await page.mouse("mouseMoved", point.x, point.y)
  await page.mouse("mousePressed", point.x, point.y)
  await page.mouse("mouseReleased", point.x, point.y)
}
async function geometry(page) {
  return page.evaluate(`(() => {
    const panel = document.querySelector(${selector(panel)})
    const root = panel.querySelector('[data-slot="message-scroller"]')
    const viewport = panel.querySelector('[data-slot="message-scroller-viewport"]')
    const spacer = panel.querySelector('[data-message-scroller-spacer]')
    const latest = [...panel.querySelectorAll('[data-slot="message-scroller-item"]')].at(-1)
    const button = panel.querySelector('[data-slot="message-scroller-button"]')
    const box = e => { const r=e.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,height:r.height} }
    return {panel:box(panel),wrapper:box(root.parentElement.parentElement),root:box(root),viewport:{...box(viewport),clientHeight:viewport.clientHeight,scrollHeight:viewport.scrollHeight,scrollTop:viewport.scrollTop},spacer:box(spacer),latest:box(latest),jump:box(button),documentWidth:document.documentElement.scrollWidth,windowWidth:innerWidth,windowHeight:innerHeight}
  })()`)
}
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["phone", 390, 844],
  ]) {
    const result = { name, width, height, failures: [] }
    report.scenarios.push(result)
    const page = await browser.openPage({
      width,
      height,
      mobile: name === "phone",
      reducedMotion: true,
    })
    try {
      result.email = await signInThrowaway({
        page,
        webUrl,
        apiUrl,
        logPath,
        prefix: `coach-scroll-${name}`,
      })
      await page.goto(`${webUrl}/coach`)
      if (
        !(await page.waitFor(`document.querySelector(${selector(textarea)})`))
      )
        throw new Error("Coach composer did not render")
      const first = `Coach scroll ${name}: first message`
      const second =
        "A long interview preparation paragraph with important detail. "
          .repeat(35)
          .trim()
      for (const [index, text] of [first, second].entries()) {
        await click(page, textarea)
        await page.insertText(text)
        await click(page, `${panel} button[aria-label="Send"]`)
        const ready = `document.querySelectorAll(${selector(`${panel} [data-slot="message-scroller-item"]`)}).length >= ${(index + 1) * 2} && !document.querySelector(${selector(`${panel} button[aria-label="Stop"]`)}) && document.querySelector(${selector(panel)})?.textContent.includes('Prep the starred one next.')`
        if (!(await page.waitFor(ready, 15000)))
          throw new Error(`Real fake Coach turn ${index + 1} did not complete`)
      }
      await frames(page)
      result.afterLong = await geometry(page)
      await page.screenshot(join(output, `${name}-long.png`), false)
      const g = result.afterLong
      if (
        g.viewport.clientHeight > g.panel.height + 2 ||
        g.root.height > g.wrapper.height + 2 ||
        g.viewport.clientHeight < 100
      )
        result.failures.push("Message viewport is not bounded by its panel")
      if (g.spacer.height > g.viewport.clientHeight + 2)
        result.failures.push("Anchor spacer exceeds the message viewport")
      if (g.documentWidth > g.windowWidth + 1)
        result.failures.push("Document overflows horizontally")
      await page.evaluate(
        `(() => { const v=document.querySelector(${selector(`${panel} [data-slot="message-scroller-viewport"]`)}); v.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true})); v.scrollTop=0; v.dispatchEvent(new Event('scroll')); })()`
      )
      if (
        !(await page.waitFor(
          `document.querySelector(${selector(`${panel} [data-slot="message-scroller-button"]`)})?.dataset.active === "true"`,
          3000
        ))
      )
        result.failures.push("Jump did not become available after scroll-up")
      await frames(page)
      result.beforeJump = await geometry(page)
      try {
        await click(page, `${panel} [data-slot="message-scroller-button"]`)
        const latestVisible = `(() => { const p=document.querySelector(${selector(panel)}),v=p.querySelector('[data-slot="message-scroller-viewport"]').getBoundingClientRect(),r=[...p.querySelectorAll('[data-slot="message-scroller-item"]')].at(-1).getBoundingClientRect();return r.bottom <= v.bottom + 2 && r.bottom > v.top; })()`
        if (!(await page.waitFor(latestVisible, 3000)))
          result.failures.push("Jump did not reveal the latest Coach reply")
      } catch (error) {
        result.failures.push(error.message)
      }
      result.afterJump = await geometry(page)
      await page.screenshot(join(output, `${name}-jump.png`), false)
      result.persisted = await page.evaluate(
        `(async () => { const list=await fetch(${selector(`${apiUrl}/api/chats`)},{credentials:'include'}).then(r=>r.json()); const chats=Array.isArray(list.data)?list.data:list.data?.items??[];const details=await Promise.all(chats.map(chat=>fetch(${selector(`${apiUrl}/api/chats/`)}+chat.id,{credentials:'include'}).then(r=>r.json())));return details.find(chat=>chat.data?.messages?.[0]?.text===${selector(first)})??{list,error:'Chat missing'}; })()`
      )
      const messages = result.persisted.data?.messages ?? []
      if (
        messages.length !== 4 ||
        messages[2]?.text !== second ||
        messages[3]?.role !== "coach" ||
        messages[3]?.status !== "final"
      )
        result.failures.push(
          "Persisted chat does not contain both completed real turns"
        )
    } catch (error) {
      result.failures.push(error.stack ?? error.message)
      await page
        .screenshot(join(output, `${name}-error.png`), false)
        .catch(() => {})
    } finally {
      await page.close()
      writeFileSync(
        join(output, "coach-scroll.json"),
        JSON.stringify(report, null, 2) + "\n"
      )
    }
    console.log(
      `${result.failures.length ? "FAIL" : "PASS"} ${name}: ${result.failures.join("; ") || "bounded viewport, physical Jump, persisted fake replies"}`
    )
  }
} finally {
  await browser.quit()
}
process.exitCode = report.scenarios.some((scenario) => scenario.failures.length)
  ? 1
  : 0
