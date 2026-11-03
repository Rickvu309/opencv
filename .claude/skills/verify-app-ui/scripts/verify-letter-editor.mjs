#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { must } from "./lib/apply-pen-seed.mjs"
import { signInThrowaway } from "./lib/session.mjs"
import { launchBrowser } from "./lib/cdp.mjs"
import { repo } from "./lib/check-util.mjs"
import {
  comparePenLayout,
  formatMismatch,
  TEXT_TOKENS,
} from "./lib/pen-layout-compare.mjs"
import {
  bodyGapMismatches,
  PEN_LAYOUT_EXCEPTIONS,
} from "./lib/letter-layout-exceptions.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"
import {
  countOf,
  exerciseToolbar,
  checkKeywordOnce,
  serverDocument,
} from "./lib/letter-toolbar-steps.mjs"

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
  "apps/web/src/features/paper/paper-editor-engine.tsx",
  "apps/web/src/features/paper/paper-editor-menus.tsx",
  "apps/web/src/features/paper/paper-editor-link-bar.tsx",
  "apps/web/src/features/paper/paper-editor-popup.ts",
  "apps/web/src/features/paper/paper-editor-resume.ts",
  ".claude/skills/verify-app-ui/scripts/lib/letter-layout-exceptions.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/letter-toolbar-steps.mjs",
  "apps/web/src/features/paper/design/letter-block-editor.pen.css",
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
    "The sheet is one block editor; the pen comparison measures each block's text, not a pixel render.",
    "DOM input/click dispatch proves UI handlers, not physical pointer or IME behavior.",
    "The star, bell and sliders glyph of the frame's header are not built (no feature behind them); see the issue's deviation list.",
  ],
}
const TYPED_WIDTHS = [1440, 390]
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
const pageDownAfterDeskClick = async (page, width) => {
  const spot = await page.evaluate(`(() => {
    const desk=document.querySelector('[data-slot="letter-editor-desk"]');
    desk.scrollTop=0;
    const r=desk.getBoundingClientRect();
    return {x:r.left+3,y:r.top+r.height/2,scrollable:desk.scrollHeight>desk.clientHeight+1};
  })()`)
  await page.mouse("mousePressed", spot.x, spot.y)
  await page.mouse("mouseReleased", spot.x, spot.y)
  const focus = await page.evaluate(`(() => {
    const d=document.activeElement;
    return {desk:d?.getAttribute('data-slot')==='letter-editor-desk',ring:getComputedStyle(d).outlineStyle};
  })()`)
  check(
    focus.desk && focus.ring === "none",
    `${width}: a click on the desk focuses the desk, with no ring for the mouse`
  )
  if (!spot.scrollable) return
  await page.key("PageDown")
  const moved = await page.waitFor(
    `document.querySelector('[data-slot="letter-editor-desk"]').scrollTop>0`,
    3000
  )
  check(moved, `${width}: PageDown scrolls the desk after a click on it`)
  await page.evaluate(
    `document.querySelector('[data-slot="letter-editor-desk"]').scrollTop=0`
  )
}
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
  const screen = await page.evaluate(`(() => {
    const root=document.querySelector('[data-slot="letter-editor-page"]');
    const desk=root.querySelector('[data-slot="letter-editor-desk"]');
    const card=root.querySelector('[data-slot="letter-editor-suggestion"]');
    const sheet=root.querySelector('[data-slot="letter-editor-sheet"]');
    const fields=[...root.querySelectorAll('[data-slot="letter-block-editor"] .bn-block-content')];
    const rect=n=>n?.getBoundingClientRect();
    desk.scrollTop=desk.scrollHeight;
    const last=rect(fields[fields.length-1]);
    const deskBox=rect(desk);
    const scrolled={scrollable:desk.scrollHeight>desk.clientHeight+1,lastInside:last.bottom<=deskBox.bottom+1&&last.top>=deskBox.top-1,
      deskInViewport:deskBox.bottom<=innerHeight+1,main:document.getElementById('app-main').scrollTop};
    desk.scrollTop=0;
    const beside=card&&getComputedStyle(card).position==='absolute';
    const connector=root.querySelector('[data-slot="letter-editor-connector"]');
    const anchor=root.querySelector('[data-slot="letter-editor-anchor"]');
    const s=rect(sheet),c=rect(card),k=rect(connector),a=rect(anchor);
    return {scrolled,beside:!!beside,
      cardGap:beside?c.left-s.right:null,
      connectorGap:beside&&k?k.left-s.right:null,connectorWidth:k?.width??null,
      anchorMid:beside&&a?a.left+a.width/2-s.right:null,
      anchorTop:beside&&a?document.elementFromPoint(a.left+a.width*0.3,a.top+a.height/2)===anchor:null,
      targets:['letter-editor-more','letter-editor-link'].map(slot=>{const r=rect(root.querySelector('[data-slot="'+slot+'"]'));return{slot,width:r.width,height:r.height}}),
      paragraphHeights:fields.filter(n=>n.dataset.contentType==='paragraph').map(n=>Math.round(rect(n).height*10)/10),
      header:{more:!!root.querySelector('[aria-label="More"]'),link:!!root.querySelector('[aria-label="Copy share link"]'),
        pdfButton:!![...root.querySelectorAll('header button')].find(n=>n.textContent.trim()==='Download PDF'),mail:!!root.querySelector('header .lucide-mail')},
      touch:matchMedia('(max-width: 767px), (pointer: coarse)').matches};
  })()`)
  check(
    screen.scrolled.scrollable === false || screen.scrolled.lastInside,
    `${width} ${label}: the desk scrolls to the last field`
  )
  check(
    screen.scrolled.deskInViewport && screen.scrolled.main === 0,
    `${width} ${label}: the desk fits the window and the page itself does not scroll`
  )
  check(
    screen.header.more &&
      screen.header.link &&
      screen.header.mail &&
      !screen.header.pdfButton,
    `${width} ${label}: header has the mail mark, More and link, and no PDF button`
  )
  if (screen.beside) {
    check(
      Math.abs(screen.cardGap - 24) <= 1.5 &&
        Math.abs(screen.connectorGap - 2) <= 1.5 &&
        Math.abs(screen.connectorWidth - 22) <= 0.5 &&
        Math.abs(screen.anchorMid) <= 1.5,
      `${width} ${label}: card sits 24px right of the sheet with its connector and dot`
    )
  }
  if (screen.beside) {
    check(
      screen.anchorTop === true,
      `${width} ${label}: the anchor dot is above the sheet`
    )
  }
  for (const target of screen.targets) {
    const min = screen.touch ? 44 : 0
    check(
      target.width >= min - 0.5 && target.height >= min - 0.5,
      `${width} ${label}: ${target.slot} is ${target.width}x${target.height}` +
        (screen.touch ? ", at least 44px on touch" : "")
    )
    if (!screen.touch)
      check(
        target.width <= 32 && target.height <= 32,
        `${width} ${label}: ${target.slot} keeps its pen size on desktop`
      )
  }
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
      ...comparePenLayout({
        layout,
        ...measured,
        exceptions: PEN_LAYOUT_EXCEPTIONS,
      }),
      measured: measured.measured,
    }
    const gaps = bodyGapMismatches(layout.texts, measured.measured)
    check(
      gaps.length === 0,
      `${width}: body blocks keep the frame's spacing between them` +
        gaps.map((g) => `\n  "${g.text}" pen ${g.pen} app ${g.app}`).join("")
    )
    check(
      comparison.mismatches.length === 0,
      `${width}: pen layout, ${comparison.mismatches.length} mismatches` +
        comparison.mismatches
          .slice(0, 60)
          .map((m) => `\n  ${formatMismatch(layout, m)}`)
          .join("")
    )
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
const ctx = { check, state, api }
try {
  const setup = await browser.openPage({
    intercept: false,
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  await setup.goto(web)
  await signInThrowaway({
    page: setup,
    apiUrl: api,
    logPath: log,
    name: "Linh Nguyen",
    prefix: "apply-pen",
  })
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
  await setup.close()
  const texts = snapshot.sections.find((s) => s.name === "Main wrap").texts
  const penCopyParts = {
    sender: texts[4],
    contact: texts[5],
    date: texts[6],
    recipient: texts.slice(7, 10).join("\n"),
    salutation: texts[10],
    closing: texts[15],
    signature: texts[16],
  }
  const markdown = texts.slice(11, 15).join("\n\n")
  check(
    penCopyParts.sender === "Linh Nguyen" &&
      penCopyParts.signature === "Linh Nguyen",
    "source letter fixture loaded"
  )
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1394, 900],
    [1200, 900],
    [1024, 900],
    [1024, 500],
    [768, 900],
    [600, 900],
    [390, 844],
    [360, 740],
    [320, 640],
  ]) {
    const page = await browser.openPage({
      intercept: false,
      width,
      height,
      mobile: width < 600,
      reducedMotion: true,
    })
    await page.goto(web)
    const doc = await command(page, "paper.create", {
      kind: "letter",
      name: "Cover letter, Lumière",
      document: { markdown, ...penCopyParts },
      jobId: job.id,
    })
    await page.goto(`${web}/paper/${doc.id}`)
    await state(
      page,
      `!!document.querySelector('[aria-label="Letter suggestion"]')`,
      `${width}: linked job suggestion shown`
    )
    await state(
      page,
      `document.querySelectorAll('[data-slot="letter-block-editor"] .bn-block-content').length > 0`,
      `${width}: the block editor is mounted`
    )
    await capture(page, width, "suggestion")
    await pageDownAfterDeskClick(page, width)
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
    await state(
      page,
      `document.querySelectorAll('[data-slot="letter-block-editor"] .bn-block-content').length > 0`,
      `${width}: the block editor is mounted after reload`
    )
    await click(page, "Add to letter")
    await state(
      page,
      `!document.querySelector('[aria-label="Letter suggestion"]') && ([...document.querySelectorAll('[data-slot="letter-block-editor"] .bn-block-content')].map(n=>n.innerText.trim()).join('\\n\\n')).includes('Meta Ads')`,
      `${width}: keyword lands in the letter`
    )
    await state(
      page,
      `!document.querySelector('[role="alert"]')`,
      `${width}: no conflict banner`
    )
    await state(
      page,
      `window.__letterSaved || (fetch(${JSON.stringify(`${api}/api/paper/` + doc.id)},{credentials:'include'}).then(r=>r.json()).then(r=>{window.__letterSaved=JSON.stringify(r).includes('Meta Ads')}), false)`,
      `${width}: saved API contains the keyword`
    )
    await checkKeywordOnce(page, ctx, doc.id, width, "Meta Ads")
    await capture(page, width, "keyword-added")
    await page.goto(`${web}/paper/${doc.id}`)
    await state(
      page,
      `([...document.querySelectorAll('[data-slot="letter-block-editor"] .bn-block-content')].map(n=>n.innerText.trim()).join('\\n\\n')).includes('Meta Ads')`,
      `${width}: reload retains keyword`
    )
    await capture(page, width, "reloaded")
    if (TYPED_WIDTHS.includes(width)) {
      const sentence = ` Typed at ${width}.`
      await page.evaluate(`(() => {
        const blocks=[...document.querySelectorAll('[data-slot="letter-block-editor"] .bn-block-content .bn-inline-content')];
        const last=blocks[blocks.length-1];
        last.focus();
        const range=document.createRange();
        range.selectNodeContents(last);
        range.collapse(false);
        const selection=getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      })()`)
      await page.insertText(sentence)
      const needle = sentence.trim()
      await state(
        page,
        `window.__typedSaved || (fetch(${JSON.stringify(`${api}/api/paper/` + doc.id)},{credentials:'include'}).then(r=>r.json()).then(r=>{window.__typedSaved=JSON.stringify(r).split(${JSON.stringify(needle)}).length-1===1}), false)`,
        `${width}: the save API holds the typed sentence exactly once`
      )
      await new Promise((resolve) => setTimeout(resolve, 1500))
      check(
        countOf(
          JSON.stringify(await serverDocument(page, api, doc.id)),
          needle
        ) === 1,
        `${width}: the typed sentence is still on the server exactly once after a pause`
      )
      await page.goto(`${web}/paper/${doc.id}`)
      await state(
        page,
        `([...document.querySelectorAll('[data-slot="letter-block-editor"] .bn-block-content')].map(n=>n.innerText.trim()).join('\\n\\n')).split(${JSON.stringify(needle)}).length-1===1`,
        `${width}: reload shows the typed sentence exactly once`
      )
      await exerciseToolbar(page, ctx, doc.id, width)
    }
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
