#!/usr/bin/env node
// Uses a running local verification stack; creates one isolated account and six real jobs.
// PORT=4823 WEB_ORIGIN=http://localhost:5823 VERIFY_API_LOG=~/tmp/opencv-verify/p823/api.log \
//   node .claude/skills/verify-app-ui/scripts/verify-letter-start.mjs <evidence directory>
// Explicit equivalents: --base-url <web origin> --api-url <api origin> --api-log <path> --evidence <dir>.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { must, signUp } from "./lib/apply-pen-seed.mjs"
import { launchBrowser } from "./lib/cdp.mjs"
import { repo } from "./lib/check-util.mjs"
import { comparePenLayout, TEXT_TOKENS } from "./lib/pen-layout-compare.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"

const args = process.argv.slice(2)
const options = {}
let positional
for (let i = 0; i < args.length; i += 1) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2)
    must(
      ["base-url", "api-url", "api-log", "evidence", "state"].includes(key),
      `known option ${key}`
    )
    must(args[i + 1] && !args[i + 1].startsWith("--"), `value for ${key}`)
    options[key] = args[++i]
  } else {
    must(!positional, "one evidence directory")
    positional = args[i]
  }
}
must(
  !options.state || options.state === "unreadable",
  "known verification state"
)
const unreadable = options.state === "unreadable"
const screenName = unreadable ? "letter-unreadable" : "letter-start"
const port = Number(process.env.PORT)
const web =
  options["base-url"] ??
  process.env.WEB_ORIGIN ??
  (Number.isInteger(port) ? `http://localhost:${port + 1}` : null)
const api =
  options["api-url"] ??
  process.env.API_ORIGIN ??
  (Number.isInteger(port) ? `http://localhost:${port}` : null)
const log = options["api-log"] ?? process.env.VERIFY_API_LOG
const destination =
  options.evidence ?? positional ?? process.env.VERIFY_APP_UI_SHOTS
must(
  web && api && log && destination,
  "provide web/API origins, API log and evidence directory (see script header)"
)
must(existsSync(log), "existing local verification API log")
for (const origin of [web, api])
  must(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname),
    "fixture account and jobs are restricted to a local verification stack"
  )
const output = resolve(destination)
mkdirSync(output, { recursive: true })
const jobs = [
  ["Marketing Executive", "Lumière"],
  ["Business Analyst", "Regional bank"],
  ["Product Intern", "Local startup"],
  ["Content Writer", "Tiki"],
  ["Brand Assistant", "Brightside"],
  ["Social Media Intern", "Northwind"],
]
const sources = [
  ".claude/skills/verify-app-ui/scripts/verify-letter-start.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/cdp.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/apply-pen-seed.mjs",
  "apps/web/src/features/paper/paper-letter-start.tsx",
  "apps/web/src/features/paper/paper-letter-start-page.tsx",
  "apps/web/src/features/paper/paper-letter-start.reducer.ts",
  "apps/web/src/features/paper/paper-library.tsx",
  "apps/web/src/features/paper/paper-letter.test.tsx",
  "apps/web/src/features/paper/paper-letter-autosave.test.tsx",
  "apps/web/src/features/paper/paper-library.test.tsx",
  "apps/web/src/features/paper/paper-letter-start-parity.test.tsx",
  "apps/web/src/test/design-frame-coverage.test.ts",
  "apps/web/vitest.config.ts",
  "apps/web/src/features/paper/design/letter-start.pen.css",
  "apps/web/src/features/paper/design/letter-start.snapshot.json",
  "apps/web/src/features/paper/design/letter-start.styles.json",
  "apps/web/src/features/paper/design/letter-start.layout.json",
]
if (unreadable) {
  for (const extension of [
    "pen.css",
    "snapshot.json",
    "styles.json",
    "layout.json",
  ])
    sources.push(
      `apps/web/src/features/paper/design/letter-unreadable.${extension}`
    )
}
const hashes = () =>
  Object.fromEntries(
    sources.map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(join(repo, file)))
        .digest("hex"),
    ])
  )
const layout = JSON.parse(
  readFileSync(
    join(repo, `apps/web/src/features/paper/design/${screenName}.layout.json`),
    "utf8"
  )
)
const before = hashes()
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
  web,
  api,
  sourceHashes: before,
  fixture:
    "Real local OTP authentication using the existing signUp helper and six job.create contract commands. No route interception. Does not prove production mail delivery or AI drafting.",
  frame: layout.frameId,
  jobs,
  captures: [],
  checks: [],
  status: "RUNNING",
}
const check = (ok, message) => {
  report.checks.push({ pass: Boolean(ok), message })
  must(ok, message)
}
const browser = await launchBrowser()
let current
const requireState = async (page, expression, message) =>
  check(await page.waitFor(expression, 20000), message)
const click = async (page, selector) => {
  check(
    await page.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false; node.click(); return true;
  })()`),
    `click ${selector}`
  )
}
const input = async (page, value) => {
  await page.evaluate(`(() => {
    const node = document.querySelector('[data-slot="letter-start-search"] input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, ${JSON.stringify(value)});
    node.dispatchEvent(new Event('input', {bubbles:true}));
    node.dispatchEvent(new Event('change', {bubbles:true}));
  })()`)
}
const capture = async (page, width, state) => {
  await page.evaluate("document.fonts.ready")
  await page.evaluate(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
  )
  const metrics = await page.evaluate(`(() => {
    const root = document.querySelector('[data-slot="letter-start-page"]');
    const heading = root.querySelector('h1');
    const loaded = [...document.fonts].filter(f => /Inter Variable/.test(f.family) && f.status === 'loaded');
    return {
      fontFamily: getComputedStyle(heading).fontFamily,
      interLoadedFaces: loaded.map(f => ({family:f.family, status:f.status, weight:f.weight})),
      fontCheck: document.fonts.check('20px "Inter Variable"'),
      headingTop: heading.getBoundingClientRect().top,
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      surfaceWidth: root.scrollWidth, surfaceClientWidth: root.clientWidth,
      rows: [...root.querySelectorAll('[data-slot="letter-start-job"]')].map(n => ({label:n.getAttribute('aria-label'), selected:n.getAttribute('aria-pressed')})),
    };
  })()`)
  let comparison = null
  if (
    width === 1440 &&
    state === (unreadable ? "unreadable" : "source-selected")
  ) {
    const measured = await page.evaluate(
      probeSource({
        mode: "app",
        pane: '[data-slot="letter-start-page"]',
        texts: layout.texts,
        tokens: TEXT_TOKENS,
      })
    )
    if (measured.error) throw new Error(measured.error)
    comparison = {
      ...comparePenLayout({ layout, ...measured }),
      measured: measured.measured,
    }
  }
  const file = `${width}-${state}.png`
  await page.screenshot(join(output, file), false)
  report.captures.push({
    file,
    sha256: createHash("sha256")
      .update(readFileSync(join(output, file)))
      .digest("hex"),
    width,
    state,
    url: await page.evaluate("location.href"),
    ...metrics,
    comparison,
  })
  check(
    metrics.fontCheck &&
      metrics.interLoadedFaces.length > 0 &&
      /Inter Variable/.test(metrics.fontFamily),
    `${width} ${state}: Inter Variable actually loaded and applied`
  )
  check(
    metrics.documentWidth <= metrics.viewport &&
      metrics.surfaceWidth <= metrics.surfaceClientWidth + 1,
    `${width} ${state}: no horizontal overflow`
  )
}
try {
  const setup = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  current = setup
  await setup.goto(web)
  await signUp(setup, api, log)
  for (const [title, company] of jobs) {
    const result =
      await setup.evaluate(`fetch(${JSON.stringify(`${api}/api/commands/job.create`)}, {
      method:'POST', credentials:'include', headers:{'content-type':'application/json'},
      body: JSON.stringify({input:${JSON.stringify({ title, company, stage: "saved" })}, idempotencyKey:crypto.randomUUID()})
    }).then(async r => ({ok:r.ok,status:r.status,body:await r.json()}))`)
    check(result.ok, `job.create ${title}: HTTP ${result.status}`)
  }
  await setup.close()
  for (const [width, height] of [
    [1440, 900],
    [320, 640],
    [360, 740],
    [390, 844],
  ]) {
    const page = await browser.openPage({
      width,
      height,
      mobile: width < 600,
      reducedMotion: true,
    })
    current = page
    await page.goto(`${web}/paper`)
    await requireState(
      page,
      `[...document.querySelectorAll('button')].some(n => n.textContent.trim().startsWith('Cover letter'))`,
      `${width}: Paper library rendered`
    )
    const openLetter = async () => {
      check(
        await page.evaluate(
          `(() => { const n = [...document.querySelectorAll('button')].find(n => n.textContent.trim().startsWith('Cover letter')); n?.click(); return !!n; })()`
        ),
        "open Cover letter from Paper"
      )
      await requireState(
        page,
        `document.querySelectorAll('[data-slot="letter-start-job"]').length === 6`,
        "six source jobs rendered"
      )
    }
    await openLetter()
    check(
      await page.evaluate(
        `document.querySelector('[data-slot="letter-start-page"] h1')?.textContent === 'Start a cover letter'`
      ),
      "source frame heading"
    )
    for (const label of ["Attach a file", "Start blank", "Draft letter"])
      check(
        await page.evaluate(
          `[...document.querySelectorAll('[data-slot="letter-start-page"] button')].some(n => (n.getAttribute('aria-label') ?? n.textContent.trim()) === ${JSON.stringify(label)})`
        ),
        `${label} control present`
      )
    check(
      await page.evaluate(
        `!!document.querySelector('[aria-label="Attach a file"] svg')`
      ),
      "attachment icon rendered"
    )
    check(
      await page.evaluate(`(() => {
      const labels = [...document.querySelectorAll('[data-slot="letter-start-job"]')].map(n => n.getAttribute('aria-label'));
      return ${JSON.stringify(jobs.map(([title, company]) => `${title}, ${company}`))}.every(label => labels.includes(label));
    })()`),
      "all six source job titles and companies rendered"
    )
    check(
      await page.evaluate(
        `[...document.querySelectorAll('[data-slot="letter-start-page"] button')].find(n => n.getAttribute('aria-label') === 'Draft letter').disabled`
      ),
      "Draft letter initially disabled"
    )
    check(
      await page.evaluate(
        `document.activeElement === document.querySelector('[data-slot="letter-start-search"] input')`
      ),
      "search receives focus on open"
    )
    check(
      await page.evaluate(`(() => {
        const frame = document.querySelector('[data-slot="letter-start-search"]');
        const field = frame.querySelector('input');
        const frameStyle = getComputedStyle(frame);
        const fieldStyle = getComputedStyle(field);
        return field.matches(':focus-visible') &&
          frameStyle.boxShadow.includes('3px') &&
          !fieldStyle.boxShadow.includes('3px') &&
          fieldStyle.borderTopWidth === '0px';
      })()`),
      "focused search has one outer frame ring and no inner input ring"
    )
    const headingTop = await page.evaluate(
      `document.querySelector('[data-slot="letter-start-page"] h1').getBoundingClientRect().top`
    )
    await capture(page, width, "initial")
    if (unreadable) {
      await click(page, '[aria-label="Marketing Executive, Lumière"]')
      await input(page, "linkedin.com/jobs/view/3829174610")
      await requireState(
        page,
        `!!document.querySelector('[data-slot="letter-unreadable-link"]')`,
        "unreadable link state rendered"
      )
      check(
        await page.evaluate(
          `document.querySelector('[data-slot="letter-start-draft"]').disabled && !document.querySelector('[data-slot="letter-start-job"]')`
        ),
        "unreadable link clears selection, hides jobs and disables Draft"
      )
      const papersBefore = await page.evaluate(
        `fetch(${JSON.stringify(`${api}/api/paper`)}, {credentials:'include'}).then(async r => {if (!r.ok) throw new Error('Paper read failed'); return JSON.stringify(await r.json())})`
      )
      await page.evaluate(
        `document.querySelector('[data-slot="letter-start-search"] input').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}))`
      )
      check(
        await page.evaluate(
          `!!document.querySelector('[data-slot="letter-unreadable-link"]') && !document.querySelector('[data-slot="letter-start-draft"]').textContent.includes('Drafting')`
        ),
        "Enter cannot draft the unreadable URL"
      )
      check(
        (await page.evaluate(
          `fetch(${JSON.stringify(`${api}/api/paper`)}, {credentials:'include'}).then(async r => {if (!r.ok) throw new Error('Paper read failed'); return JSON.stringify(await r.json())})`
        )) === papersBefore,
        "blocked Enter creates no Paper document"
      )
      check(
        await page.evaluate(`(() => {
          const icon = document.querySelector('[data-slot="letter-unreadable-icon"]');
          return !!icon && icon.getBoundingClientRect().width === 18 && getComputedStyle(icon).color === 'rgb(150, 151, 153)';
        })()`),
        "unreadable link icon has source size and color"
      )
      await capture(page, width, "unreadable")
      await page.evaluate(`(() => {
        const input = document.querySelector('input[type="file"][aria-label="Attach letter context"]');
        const transfer = new DataTransfer();
        transfer.items.add(new File(['Hiring a marketing lead to plan campaigns and research customers.'], 'job-context.txt', {type:'text/plain'}));
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', {bubbles:true}));
      })()`)
      await requireState(
        page,
        `document.body.textContent.includes('Context: job-context.txt') && !document.querySelector('[data-slot="letter-start-draft"]').disabled && !document.querySelector('[data-slot="letter-unreadable-link"]')`,
        "real attachment extraction recovers drafting and clears the error"
      )
      await capture(page, width, "attachment-recovery")
      await page.evaluate(
        `[...document.querySelectorAll('button')].find(n => n.textContent.trim() === 'Remove attachment').click()`
      )
      await requireState(
        page,
        `document.querySelector('[data-slot="letter-start-draft"]').disabled && !document.body.textContent.includes('Context: job-context.txt')`,
        "removing attachment restores unreadable-link guard"
      )
      await input(
        page,
        "Lead customer research. Apply at linkedin.com/jobs/view/3829174610"
      )
      await requireState(
        page,
        `!document.querySelector('[data-slot="letter-unreadable-link"]') && !document.querySelector('[data-slot="letter-start-draft"]').disabled`,
        "pasted job text mentioning a URL recovers drafting"
      )
      await capture(page, width, "text-recovery")
      await input(page, "")
      await requireState(
        page,
        `document.querySelectorAll('[data-slot="letter-start-job"]').length === 6 && document.querySelector('[data-slot="letter-start-draft"]').disabled`,
        "clearing query restores jobs without stale selection"
      )
      await page.close()
      continue
    }
    await input(page, "Regional bank")
    await requireState(
      page,
      `document.querySelectorAll('[data-slot="letter-start-job"]').length === 1 && document.querySelector('[data-slot="letter-start-job"]').getAttribute('aria-label') === 'Business Analyst, Regional bank'`,
      "company search filters jobs"
    )
    check(
      await page.evaluate(
        `Math.abs(document.querySelector('[data-slot="letter-start-page"] h1').getBoundingClientRect().top - ${headingTop}) < 1`
      ),
      "search keeps heading position stable"
    )
    await capture(page, width, "search")
    await click(page, '[data-slot="letter-start-job"]')
    await requireState(
      page,
      `document.querySelector('[data-slot="letter-start-job"]').getAttribute('aria-pressed') === 'true'`,
      "job selection marked"
    )
    await input(page, "")
    await requireState(
      page,
      `document.querySelectorAll('[data-slot="letter-start-job"]').length === 6 && document.querySelectorAll('[data-slot="letter-start-job"][aria-pressed="true"]').length === 1`,
      "clearing search retains selection"
    )
    check(
      await page.evaluate(
        `![...document.querySelectorAll('[data-slot="letter-start-page"] button')].find(n => n.getAttribute('aria-label') === 'Draft letter').disabled`
      ),
      "selection enables Draft letter"
    )
    await capture(page, width, "selected")
    await click(page, '[aria-label="Marketing Executive, Lumière"]')
    await capture(page, width, "source-selected")
    await input(page, "A different engineering role")
    check(
      await page.evaluate(
        `document.querySelectorAll('[data-slot="letter-start-job"][aria-pressed="true"]').length === 0`
      ),
      "new query clears the hidden selected job"
    )
    await input(page, "")
    await click(page, '[data-slot="letter-start-header"] button')
    await requireState(
      page,
      `!document.querySelector('[data-slot="letter-start-page"]') && [...document.querySelectorAll('button')].some(n => n.textContent.trim().startsWith('Cover letter'))`,
      "Paper breadcrumb returns to library"
    )
    check(
      await page.evaluate(
        `document.activeElement === document.querySelector('[data-primary-action]')`
      ),
      "return focuses New"
    )
    await openLetter()
    await requireState(
      page,
      `document.querySelectorAll('[data-slot="letter-start-job"][aria-pressed="true"]').length === 0 && document.querySelector('[data-slot="letter-start-search"] input').value === ''`,
      "reopening starts with empty search and selection"
    )
    await capture(page, width, "reopened")
    await page.close()
  }
  check(
    JSON.stringify(before) === JSON.stringify(hashes()),
    "verification sources unchanged during capture"
  )
  report.layout = report.captures.find((c) => c.comparison)?.comparison ?? null
  report.behaviorStatus = "PASS"
  report.status =
    report.layout?.mismatches.length === 0 ? "PASS" : "LAYOUT_FAIL"
  if (report.status !== "PASS") process.exitCode = 1
} catch (error) {
  report.status = "FAIL"
  report.error = error.stack ?? String(error)
  if (current) {
    await current.screenshot(join(output, "failure.png"), false).catch(() => {})
    report.browserLogs = current.logs
  }
  process.exitCode = 1
} finally {
  report.finishedAt = new Date().toISOString()
  writeFileSync(
    join(output, `${screenName}.json`),
    JSON.stringify(report, null, 2) + "\n"
  )
  await browser.quit()
}
console.log(
  `${report.status}: ${report.captures.length} captures; ${join(output, `${screenName}.json`)}`
)
