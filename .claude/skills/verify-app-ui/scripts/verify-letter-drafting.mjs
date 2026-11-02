#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { must, signUp } from "./lib/apply-pen-seed.mjs"
import { launchBrowser } from "./lib/cdp.mjs"
import { repo } from "./lib/check-util.mjs"
import { comparePenLayout, TEXT_TOKENS } from "./lib/pen-layout-compare.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"

const port = Number(process.env.PORT)
const web = process.env.WEB_ORIGIN
const api = process.env.API_ORIGIN ?? `http://localhost:${port}`
const log = process.env.VERIFY_API_LOG
const output = process.argv[2] && resolve(process.argv[2])
must(
  web && log && output && existsSync(log),
  "provide local origins, API log and evidence directory"
)
for (const origin of [web, api]) {
  must(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname),
    "local verification stack only"
  )
}
mkdirSync(output, { recursive: true })
const driver = ".claude/skills/verify-app-ui/scripts/verify-letter-drafting.mjs"
const design = "apps/web/src/features/paper/design/letter-drafting"
const sources = [
  driver,
  ...["cdp", "apply-pen-seed", "pen-layout-compare", "pen-layout-probe"].map(
    (name) => `.claude/skills/verify-app-ui/scripts/lib/${name}.mjs`
  ),
  ...[
    "paper-letter-start.tsx",
    "paper-letter-start-page.tsx",
    "paper-letter-drafting-page.tsx",
    "paper-letter-drafting-parity.test.tsx",
  ].map((name) => `apps/web/src/features/paper/${name}`),
  `${design}.layout.json`,
  `${design}.styles.json`,
  `${design}.pen.css`,
]
const digest = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex")
const hashes = () =>
  Object.fromEntries(sources.map((file) => [file, digest(join(repo, file))]))
const before = hashes()
const layout = JSON.parse(
  readFileSync(join(repo, `${design}.layout.json`), "utf8")
)
const referenceFixture = process.env.REFERENCE_FIXTURE === "1"
const partial = referenceFixture
  ? [[4, 5], [6], [7, 8, 9], [10], [11], [12]]
      .map((group) => group.map((index) => layout.texts[index].text).join("\n"))
      .join("\n\n")
  : "Dear hiring team,\n\nI am applying for the marketing role at Lumière. My experience includes planning campaigns and measuring their results."
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
  sourceHashes: before,
  web,
  api,
  frame: "tsfNR",
  checks: [],
  captures: [],
  referenceFixture,
  fixture:
    "Real local OTP, paper/chat creation, stop and fallback save. Held Coach SSE text fixture; does not prove production AI or mail. REFERENCE_FIXTURE uses source prose, a real saved job and a real text attachment; default prose differs. All layout mismatches remain in the report.",
  status: "RUNNING",
}
const check = (pass, message) => {
  report.checks.push({ pass: Boolean(pass), message })
  must(pass, message)
}
const browser = await launchBrowser()
let current
let seededJobId
const wait = async (page, expression, message) =>
  check(await page.waitFor(expression, 20000), message)
const click = async (page, selector) => {
  const point = await page.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node || node.disabled) return null;
    const box = node.getBoundingClientRect();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    return node.contains(document.elementFromPoint(x, y)) ? {x, y} : null;
  })()`)
  check(point, `native hit target ${selector}`)
  await page.mouse("mousePressed", point.x, point.y)
  await page.mouse("mouseReleased", point.x, point.y)
}
const installStream = async (page, mode = "partial") =>
  page.evaluate(`(() => {
  const original = window.fetch.bind(window);
  window.__draftProbe = {requests: [], partial: ${JSON.stringify(partial)}};
  window.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    window.__draftProbe.requests.push({url, body: init?.body ?? null});
    if (/\\/api\\/chats\\/[^/]+\\/turns$/.test(new URL(url, location.href).pathname)) {
      if (${JSON.stringify(mode)} === 'error') return Response.json({ok:false,error:{code:'SERVER_ERROR',message:'Verification stream failed.'}}, {status:500});
      const stream = new ReadableStream({start(controller) {
        controller.enqueue(new TextEncoder().encode('event: text-delta\\ndata: ' + JSON.stringify({text:window.__draftProbe.partial}) + '\\n\\n'));
        init.signal.addEventListener('abort', () => controller.error(new DOMException('Stopped', 'AbortError')), {once:true});
      }});
      return new Response(stream, {headers:{'content-type':'text/event-stream'}});
    }
    return original(input, init);
  };
})()`)
const start = async (page, mode = "partial") => {
  await page.goto(`${web}/paper`)
  await installStream(page, mode)
  await wait(
    page,
    `!!document.querySelector('[data-primary-action]')`,
    "Paper library loaded"
  )
  await click(page, "[data-primary-action]")
  await wait(
    page,
    `!!document.querySelector('[role="dialog"]')`,
    "New document choices opened"
  )
  const selector = await page.evaluate(`(() => {
    const button = [...document.querySelectorAll('[role="dialog"] button')].find(n => n.textContent.trim() === 'Cover letter');
    if (!button) return null;
    button.setAttribute('data-drafting-probe-start', ''); return '[data-drafting-probe-start]';
  })()`)
  check(selector, "Cover letter choice exists in New document dialog")
  await click(page, selector)
  await wait(
    page,
    `!!document.querySelector('[data-slot="letter-start-search"] input')`,
    "letter form opened"
  )
  if (referenceFixture) {
    await wait(
      page,
      `!!document.querySelector('[aria-label="Junior Marketing, Lumière"]')`,
      "source job available"
    )
    await click(page, '[aria-label="Junior Marketing, Lumière"]')
    await page.evaluate(`(() => {
      const input = document.querySelector('input[aria-label="Attach letter context"]');
      const transfer = new DataTransfer();
      transfer.items.add(new File(['Linh Nguyen: campus beauty club interviews and marketing campaigns.'], 'Junior Marketing CV', {type:'text/plain'}));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
    })()`)
    await wait(
      page,
      `document.body.textContent.includes('Junior Marketing CV') && !document.querySelector('[aria-label="Draft letter"]').disabled`,
      "real source-named attachment extracted"
    )
  } else
    await page.evaluate(`(() => {
    const field = document.querySelector('[data-slot="letter-start-search"] input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'Draft a marketing cover letter for Lumière.');
    field.dispatchEvent(new Event('input', {bubbles:true}));
  })()`)
  await wait(
    page,
    `!document.querySelector('[aria-label="Draft letter"]').disabled`,
    "typed context enables draft"
  )
  await click(page, '[aria-label="Draft letter"]')
}
const capture = async (page, width, state) => {
  await page.evaluate("document.fonts.ready")
  const metrics = await page.evaluate(`(() => {
    const root = document.querySelector('[data-slot="letter-drafting-page"]');
    const stop = root.querySelector('[data-slot="letter-drafting-stop"]');
    const bar = root.querySelector('[data-slot="letter-drafting-bar"]');
    const text = root.querySelector('[data-slot="letter-drafting-text"]');
    return {viewport:innerWidth, documentWidth:document.documentElement.scrollWidth,
      rootWidth:root.clientWidth, rootScrollWidth:root.scrollWidth,
      barWidth:bar.clientWidth, barScrollWidth:bar.scrollWidth,
      stopFocused:document.activeElement === stop, stopHeight:stop.getBoundingClientRect().height,
      family:getComputedStyle(text).fontFamily,
      interLoaded:[...document.fonts].some(f => /Inter Variable/.test(f.family) && f.status === 'loaded'),
      tokenLiveRegion:!!text.closest('[aria-live], [role="status"]')};
  })()`)
  const file = `${width}-${state}.png`
  await page.screenshot(join(output, file), false)
  report.captures.push({
    file,
    sha256: digest(join(output, file)),
    width,
    state,
    ...metrics,
  })
  check(
    metrics.documentWidth <= metrics.viewport &&
      metrics.rootScrollWidth <= metrics.rootWidth + 1 &&
      metrics.barScrollWidth <= metrics.barWidth + 1,
    `${width}: no page, drafting surface or bar overflow`
  )
  check(
    metrics.interLoaded && /Inter Variable/.test(metrics.family),
    `${width}: Inter loaded and applied`
  )
  check(
    metrics.stopFocused && !metrics.tokenLiveRegion,
    `${width}: Stop focused and streaming text outside live regions`
  )
  check(
    width >= 768 || metrics.stopHeight >= 44,
    `${width}: phone Stop target at least 44px`
  )
  if (width === 1440) {
    const measured = await page.evaluate(
      probeSource({
        mode: "app",
        pane: '[data-slot="letter-drafting-page"]',
        texts: layout.texts,
        tokens: TEXT_TOKENS,
      })
    )
    must(!measured.error, measured.error)
    report.layout = {
      ...comparePenLayout({ layout, ...measured }),
      measured: measured.measured,
    }
  }
}
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [360, 740],
    [320, 640],
  ]) {
    const page = await browser.openPage({
      width,
      height,
      mobile: width < 768,
      reducedMotion: true,
    })
    current = page
    await page.goto(web)
    if (width === 1440) {
      await signUp(page, api, log)
      if (referenceFixture) {
        const seeded =
          await page.evaluate(`fetch(${JSON.stringify(api + "/api/commands/job.create")}, {
          method:'POST', credentials:'include', headers:{'content-type':'application/json'},
          body:JSON.stringify({input:{title:'Junior Marketing', company:'Lumière'}, idempotencyKey:crypto.randomUUID()})
        }).then(async r => ({ok:r.ok, body:await r.json()}))`)
        check(
          seeded.ok,
          "create real source job in throwaway verification account"
        )
        const result =
          seeded.body?.data?.result ?? seeded.body?.data ?? seeded.body
        seededJobId = result.id
        must(
          typeof seededJobId === "string",
          "created job has an id for cleanup"
        )
      }
    }
    await start(page)
    await wait(
      page,
      `document.querySelector('[data-slot="letter-drafting-text"]')?.textContent.includes(${JSON.stringify(partial)})`,
      `${width}: active stream visible`
    )
    await capture(page, width, "streaming")
    await click(page, '[data-slot="letter-drafting-stop"]')
    await wait(
      page,
      `window.__draftProbe.requests.some(r => r.url.includes('/api/commands/paper.replace')) && !document.querySelector('[data-slot="letter-drafting-page"]')`,
      `${width}: Stop saves partial letter and leaves drafting`
    )
    const requests = await page.evaluate("window.__draftProbe.requests")
    check(
      requests.some((r) => /\/stop$/.test(r.url)),
      `${width}: server stop requested`
    )
    const save = requests.find((r) =>
      r.url.includes("/api/commands/paper.replace")
    )
    const input = JSON.parse(save.body).input
    check(
      input.document.markdown === partial,
      `${width}: saved text exactly equals visible partial text`
    )
    const persisted = await page.evaluate(
      `fetch(${JSON.stringify(api)} + '/api/paper/' + ${JSON.stringify(input.docId)}, {credentials:'include'}).then(r => r.json())`
    )
    check(
      persisted.ok && persisted.data.document.markdown === partial,
      `${width}: API readback preserves partial text`
    )
    const deleted = await page.evaluate(
      `fetch(${JSON.stringify(api + "/api/commands/paper.delete")}, {
        method: 'POST', credentials: 'include', headers: {'content-type': 'application/json'},
        body: JSON.stringify({input: {docId: ${JSON.stringify(input.docId)}}, idempotencyKey: crypto.randomUUID()})
      }).then(r => r.ok)`
    )
    check(deleted, `${width}: remove the verified throwaway letter`)
    await page.close()
  }
  current = await browser.openPage({
    width: 320,
    height: 640,
    mobile: true,
    reducedMotion: true,
  })
  await current.goto(web)
  await start(current)
  await wait(
    current,
    `document.querySelector('[data-slot="letter-drafting-text"]')?.textContent.includes(${JSON.stringify(partial)})`,
    "Back fixture has visible partial text"
  )
  await click(current, '[data-slot="letter-drafting-header"] button')
  await wait(
    current,
    `!document.querySelector('[data-slot="letter-start-page"]') && window.__draftProbe.requests.some(r => /\\/stop$/.test(r.url))`,
    "Back cancels the server turn and returns to Paper"
  )
  await current.evaluate(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
  )
  check(
    await current.evaluate(
      `!window.__draftProbe.requests.some(r => r.url.includes('/api/commands/paper.replace')) && document.activeElement === document.querySelector('[data-primary-action]')`
    ),
    "Back does not fallback-save or reopen the letter; New regains focus"
  )
  await current.screenshot(join(output, "320-back.png"), false)
  report.captures.push({
    file: "320-back.png",
    sha256: digest(join(output, "320-back.png")),
  })
  await start(current, "error")
  await wait(
    current,
    `document.querySelector('[role="alert"]')?.textContent.includes('Verification stream failed.') && !document.querySelector('[data-slot="letter-drafting-page"]')`,
    "stream error returns to the form"
  )
  check(
    await current.evaluate(
      `document.activeElement === document.querySelector('[data-slot="letter-start-search"] input')`
    ),
    "error recovery focuses the search field"
  )
  await current.screenshot(join(output, "320-error.png"), false)
  report.captures.push({
    file: "320-error.png",
    sha256: digest(join(output, "320-error.png")),
  })
  if (seededJobId) {
    const deleted =
      await current.evaluate(`fetch(${JSON.stringify(api + "/api/commands/job.delete")}, {
      method:'POST', credentials:'include', headers:{'content-type':'application/json'},
      body:JSON.stringify({input:{jobId:${JSON.stringify(seededJobId)}}, idempotencyKey:crypto.randomUUID()})
    }).then(r => r.ok)`)
    check(deleted, "remove the source fixture job after verification")
  }
  await current.close()
  report.behaviorStatus = "PASS"
  report.status =
    report.layout?.mismatches.length === 0 ? "PASS" : "LAYOUT_FAIL"
  if (report.status !== "PASS") process.exitCode = 1
} catch (error) {
  report.status = "FAIL"
  report.error = error.stack ?? String(error)
  if (current)
    await current.screenshot(join(output, "failure.png"), false).catch(() => {})
  process.exitCode = 1
} finally {
  report.finishedAt = new Date().toISOString()
  report.sourcesUnchanged = JSON.stringify(before) === JSON.stringify(hashes())
  if (!report.sourcesUnchanged) {
    report.status = "FAIL"
    process.exitCode = 1
  }
  writeFileSync(
    join(output, "letter-drafting.json"),
    `${JSON.stringify(report, null, 2)}\n`
  )
  await browser.quit()
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      report: join(output, "letter-drafting.json"),
    })
  )
}
