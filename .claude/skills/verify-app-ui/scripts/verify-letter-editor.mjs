#!/usr/bin/env node
// Local PGlite stack only. Creates a throwaway account, linked job and saved letters.
// PORT=4829 WEB_ORIGIN=http://localhost:5829 VERIFY_API_LOG=~/tmp/opencv-verify/p829/api.log
// node .claude/skills/verify-app-ui/scripts/verify-letter-editor.mjs <evidence directory>
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { must, signUp } from "./lib/apply-pen-seed.mjs"
import { launchBrowser } from "./lib/cdp.mjs"
import { repo } from "./lib/check-util.mjs"
import { comparePenLayout, TEXT_TOKENS } from "./lib/pen-layout-compare.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"

const port = Number(process.env.PORT)
const api = `http://localhost:${port}`
const web = process.env.WEB_ORIGIN ?? `http://localhost:${port + 1}`
const log = process.env.VERIFY_API_LOG
must(
  Number.isInteger(port) && port > 0 && log && process.argv[2],
  "provide PORT, VERIFY_API_LOG and evidence directory"
)
must(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(web).hostname),
  "local verification stack only"
)
const output = resolve(process.argv[2])
mkdirSync(output, { recursive: true })
const design = "apps/web/src/features/paper/design/letter-editor"
const layout = JSON.parse(
  readFileSync(join(repo, `${design}.layout.json`), "utf8")
)
const snapshot = JSON.parse(
  readFileSync(join(repo, `${design}.snapshot.json`), "utf8")
)
const sources = [
  ".claude/skills/verify-app-ui/scripts/verify-letter-editor.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/cdp.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/pen-layout-probe.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/pen-layout-compare.mjs",
  "apps/web/src/features/paper/paper-letter.tsx",
  "apps/web/src/features/paper/paper-letter-article.tsx",
  "apps/web/src/features/paper/paper-letter.reducer.ts",
  "apps/web/src/features/paper/paper-autosave.ts",
  "apps/web/src/features/paper/paper-letter-autosave.test.tsx",
  "apps/web/src/test/design-frame-coverage.test.ts",
  `${design}-paints.styles.json`,
  ...["snapshot.json", "styles.json", "layout.json", "pen.css"].map(
    (s) => `${design}.${s}`
  ),
]
const sha = (value) => createHash("sha256").update(value).digest("hex")
const hashes = () =>
  Object.fromEntries(
    sources.map((file) => [file, sha(readFileSync(join(repo, file)))])
  )
const report = {
  startedAt: new Date().toISOString(),
  head: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
  }).trim(),
  gitStatus: execFileSync("git", ["status", "--porcelain"], {
    cwd: repo,
    encoding: "utf8",
  }).trim(),
  sourceHashes: hashes(),
  checks: [],
  captures: [],
  status: "RUNNING",
  limits: [
    "Native Pencil export is unavailable; source geometry comparison is not a 95% pixel certification.",
    "The plain-text editor does not reproduce the frame's mixed body typography.",
    "keywordGap currently extracts Meta from Meta Ads; the fixture does not hardcode the source suggestion.",
    "DOM input/click dispatch proves UI handlers, not physical pointer or IME behavior.",
  ],
}
const check = (pass, message) => {
  report.checks.push({ pass: Boolean(pass), message })
  must(pass, message)
}
const browser = await launchBrowser()
const command = async (page, name, input) => {
  const result =
    await page.evaluate(`fetch(${JSON.stringify(`${api}/api/commands/` + name)}, {
    method:'POST',credentials:'include',headers:{'content-type':'application/json'},
    body:JSON.stringify({input:${JSON.stringify(input)},idempotencyKey:crypto.randomUUID()})
  }).then(async r=>({ok:r.ok,status:r.status,body:await r.json()}))`)
  check(result.ok, `${name}: HTTP ${result.status}`)
  return result.body.data?.result ?? result.body.data ?? result.body
}
const state = async (page, expression, message) => {
  const passed = await page.waitFor(expression, 20000)
  if (!passed) {
    report.failurePage = await page.evaluate(
      `({url:location.href,text:document.body.innerText})`
    )
    await page.screenshot(join(output, "failure.png"))
  }
  check(passed, message)
}
const click = async (page, text) =>
  check(
    await page.evaluate(`(() => {
  const button=[...document.querySelectorAll('[data-slot="letter-editor-page"] button')].find(n=>(n.getAttribute('aria-label')??n.textContent.trim())===${JSON.stringify(text)});
  button?.click();return !!button;
})()`),
    `click ${text}`
  )
const capture = async (page, width, label) => {
  await page.evaluate("document.fonts.ready")
  await page.evaluate(
    "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))"
  )
  const metrics = await page.evaluate(`(() => {
    const root=document.querySelector('[data-slot="letter-editor-page"]');
    const suggestion=root.querySelector('[data-slot="letter-editor-suggestion"]');
    const box=n=>n?{x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}:null;
    return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
      rootWidth:root.scrollWidth,rootClientWidth:root.clientWidth,fontFamily:getComputedStyle(root).fontFamily,
      interLoaded:[...document.fonts].some(f=>/Inter Variable/.test(f.family)&&f.status==='loaded'),
      nav:box(root.querySelector('nav')),edited:box(root.querySelector('[data-slot="letter-editor-edited"]')),suggestion:box(suggestion),sheet:box(root.querySelector('[data-slot="letter-editor-sheet"]')),
      buttons:suggestion?[...suggestion.querySelectorAll('button')].map(n=>({label:n.getAttribute('aria-label')??n.textContent.trim(),...box(n)})):[]};
  })()`)
  check(
    metrics.interLoaded && /Inter Variable/.test(metrics.fontFamily),
    `${width} ${label}: Inter loaded and applied`
  )
  check(
    metrics.documentWidth <= metrics.viewport &&
      metrics.rootWidth <= metrics.rootClientWidth + 1,
    `${width} ${label}: no horizontal overflow`
  )
  if (width < 600) {
    check(
      metrics.edited.y >= metrics.nav.y + metrics.nav.height,
      `${width}: header metadata does not overlap breadcrumbs`
    )
  }
  if (width < 600 && metrics.suggestion) {
    check(
      metrics.suggestion.y < metrics.sheet.y,
      `${width}: suggestion precedes the sheet`
    )
    check(
      metrics.buttons
        .filter((b) => b.label !== "Dismiss suggestion")
        .every((b) => b.height >= 44),
      `${width}: Add and Skip have 44px targets`
    )
  }
  if (metrics.suggestion) {
    const a = metrics.suggestion
    const b = metrics.sheet
    check(
      a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y,
      `${width}: suggestion does not cover the letter`
    )
  }
  let comparison = null
  if (width === 1440 && label === "suggestion") {
    const measured = await page.evaluate(
      probeSource({
        mode: "app",
        pane: '[data-slot="letter-editor-page"]',
        texts: layout.texts,
        tokens: TEXT_TOKENS,
      })
    )
    comparison = {
      ...comparePenLayout({ layout, ...measured }),
      measured: measured.measured,
    }
  }
  const file = `${width}-${label}.png`
  await page.screenshot(join(output, file), false)
  report.captures.push({
    file,
    sha256: sha(readFileSync(join(output, file))),
    metrics,
    comparison,
    sourceHashes: report.sourceHashes,
  })
}
try {
  const setup = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  await setup.goto(web)
  await signUp(setup, api, log)
  const job = await command(setup, "job.create", {
    title: "Junior Marketing",
    company: "Lumière Cosmetics",
    stage: "saved",
  })
  await command(setup, "job.update", {
    jobId: job.id,
    patch: {
      posting: {
        about: "",
        duties: "",
        requirements: "The role needs Meta Ads",
        details: "",
      },
    },
  })
  const texts = snapshot.sections.find((s) => s.name === "Main wrap").texts
  const markdown = texts.slice(4, 17).join("\n\n")
  check(markdown.includes("Linh Nguyen"), "source letter fixture loaded")
  await setup.close()
  for (const [width, height] of [
    [1440, 900],
    [1394, 900],
    [1200, 900],
    [1024, 900],
    [768, 900],
    [600, 900],
    [390, 844],
    [360, 740],
    [320, 640],
  ]) {
    const page = await browser.openPage({
      width,
      height,
      mobile: width < 600,
      reducedMotion: true,
    })
    await page.goto(web)
    const doc = await command(page, "paper.create", {
      kind: "letter",
      name: "Cover letter, Lumière",
      document: { markdown },
      jobId: job.id,
    })
    await page.goto(`${web}/paper/${doc.id}`)
    await state(
      page,
      `!!document.querySelector('[aria-label="Letter suggestion"]')`,
      `${width}: linked job suggestion shown`
    )
    await capture(page, width, "suggestion")
    await click(page, "Skip")
    await state(
      page,
      `!document.querySelector('[aria-label="Letter suggestion"]')`,
      `${width}: Skip hides suggestion`
    )
    await page.goto(`${web}/paper/${doc.id}`)
    await state(
      page,
      `!!document.querySelector('[aria-label="Letter suggestion"]')`,
      `${width}: Skip did not modify document`
    )
    const typed = markdown + "\nMy newest sentence."
    await page.evaluate(
      `(() => {const n=document.querySelector('[aria-label="Letter text"]');n.textContent=${JSON.stringify(typed)};n.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'My newest sentence.'}));})()`
    )
    await click(page, "Add to letter")
    await state(
      page,
      `!document.querySelector('[aria-label="Letter suggestion"]') && document.querySelector('[aria-label="Letter text"]').textContent.endsWith('\\nMeta')`,
      `${width}: keyword appends to newest text`
    )
    await state(
      page,
      `!document.querySelector('[role="alert"]')`,
      `${width}: no conflict banner`
    )
    // Wait on the real read API, not a toast or a fixed delay.
    await state(
      page,
      `window.__letterSaved || (fetch(${JSON.stringify(`${api}/api/paper/` + doc.id)},{credentials:'include'}).then(r=>r.json()).then(r=>{window.__letterSaved=JSON.stringify(r).includes('My newest sentence.')&&JSON.stringify(r).includes('Meta')}), false)`,
      `${width}: saved API contains edit and keyword`
    )
    await capture(page, width, "keyword-added")
    await page.goto(`${web}/paper/${doc.id}`)
    await state(
      page,
      `document.querySelector('[aria-label="Letter text"]')?.textContent.endsWith('\\nMeta')`,
      `${width}: reload retains keyword`
    )
    check(
      await page.evaluate(
        `document.querySelector('[aria-label="Letter text"]').textContent.includes('My newest sentence.')`
      ),
      `${width}: reload retains newest edit`
    )
    await capture(page, width, "reloaded")
    await page.close()
  }
  check(
    JSON.stringify(report.sourceHashes) === JSON.stringify(hashes()),
    "source unchanged during capture"
  )
  report.status = "PASS"
} catch (error) {
  report.status = "FAIL"
  report.error = error.stack ?? String(error)
  process.exitCode = 1
} finally {
  report.finishedAt = new Date().toISOString()
  writeFileSync(
    join(output, "letter-editor.json"),
    JSON.stringify(report, null, 2) + "\n"
  )
  await browser.quit()
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      failed: report.checks.filter((c) => !c.pass),
      error: report.error,
      evidence: join(output, "letter-editor.json"),
    })
  )
}
