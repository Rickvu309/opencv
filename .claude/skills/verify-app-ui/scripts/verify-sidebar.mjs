#!/usr/bin/env node
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { must, signUp } from "./lib/apply-pen-seed.mjs"
import { launchBrowser } from "./lib/cdp.mjs"
import { repo } from "./lib/check-util.mjs"
import { colorDistance } from "./lib/pen-layout-compare.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"

const USAGE =
  "usage: PORT=<api port> VERIFY_API_LOG=<api.log> node verify-sidebar.mjs <evidence directory> [--pen-dir <dir>] (or --base-url, --api-url, --api-log, --evidence)"
const POSITION = 2
const FONT_SIZE = 0.25
const COLOR = 0.02
const NO_DATA = new Set(["Checkout UX study"])
const ACTIVE_BACKGROUND = "rgb(225, 225, 226)"

const args = process.argv.slice(2)
const options = {}
let positional
for (let i = 0; i < args.length; i += 1) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2)
    must(
      ["base-url", "api-url", "api-log", "evidence", "pen-dir"].includes(key),
      `known option ${key}`
    )
    must(args[i + 1] && !args[i + 1].startsWith("--"), `value for ${key}`)
    options[key] = args[++i]
  } else {
    must(!positional, "one evidence directory")
    positional = args[i]
  }
}
const port = Number(process.env.PORT)
const web =
  options["base-url"] ??
  process.env.WEB_ORIGIN ??
  (Number.isInteger(port) ? `http://localhost:${port + 1000}` : null)
const api =
  options["api-url"] ??
  process.env.API_ORIGIN ??
  (Number.isInteger(port) ? `http://localhost:${port}` : null)
const log = options["api-log"] ?? process.env.VERIFY_API_LOG
const destination = options.evidence ?? positional
must(web && api && log && destination, USAGE)
must(existsSync(log), "existing local verification API log")
for (const origin of [web, api])
  must(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname),
    "the fixture account is restricted to a local verification stack"
  )
const output = resolve(destination)
mkdirSync(output, { recursive: true })
const penDir = options["pen-dir"] ? resolve(options["pen-dir"]) : null

const layout = JSON.parse(
  readFileSync(
    join(
      repo,
      "apps/web/src/features/app-shell/design/app-sidebar.layout.json"
    ),
    "utf8"
  )
)
const report = { web, api, checks: [], gaps: [], captures: [], failures: [] }
const check = (ok, message) => {
  report.checks.push({ pass: Boolean(ok), message })
  if (!ok) report.failures.push(message)
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`)
}
const gap = (message) => {
  report.gaps.push(message)
  console.log(`GAP  ${message}`)
}

const SIDEBAR = 'aside[aria-label="Sidebar"]'
const DRAWER = '[role="dialog"] [data-slot="shell-nav"]'

const command = (page, name, input) =>
  page.evaluate(`fetch(${JSON.stringify(`${api}/api/commands/${name}`)}, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: ${JSON.stringify(input)}, idempotencyKey: crypto.randomUUID() }),
  }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) }))`)

async function seed(page) {
  const job = await command(page, "job.create", {
    title: "Lumière application",
    company: "Lumière",
    stage: "saved",
  })
  must(job.ok, `job.create returned ${job.status}`)
  const star = await command(page, "job.star", {
    jobId: job.body.data.id,
    starred: true,
  })
  must(star.ok, `job.star returned ${star.status}`)
  const doc = await command(page, "paper.create", {
    kind: "cv",
    name: "Junior Marketing CV",
  })
  must(doc.ok, `paper.create returned ${doc.status}`)
  const favorite = await command(page, "paper.setFavorite", {
    docId: doc.body.data.docId ?? doc.body.data.id,
    isFavorite: true,
  })
  must(favorite.ok, `paper.setFavorite returned ${favorite.status}`)
  must((await command(page, "inbox.skip", {})).ok, "inbox.skip")
  must((await command(page, "inbox.scan", {})).ok, "inbox.scan")
}

async function settle(page) {
  await page.evaluate("document.fonts.ready")
  await page.evaluate(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
  )
}

async function waitSidebar(page, root) {
  const ready = await page.waitFor(
    `(() => { const nav = document.querySelector(${JSON.stringify(root)}); return !!nav && !!nav.querySelector('[data-slot="sidebar-count"]') && !!nav.querySelector('[data-slot="sidebar-group-label"][aria-controls]') && !nav.querySelector('[data-slot="skeleton"]') && nav.textContent.includes('Junior Marketing CV') && nav.textContent.includes('Lumière application') })()`,
    20000
  )
  check(ready, `sidebar ready (${root})`)
  await settle(page)
}

function compare(tag, height, active, measured) {
  const shift = height - 900
  layout.texts.forEach((want, index) => {
    const got = measured[index]
    if (!got) {
      if (NO_DATA.has(want.text)) {
        gap(
          `${tag} "${want.text}" has no data: Paper stores only CVs and letters and Proofs is coming soon`
        )
        return
      }
      check(false, `${tag} "${want.text}" is on screen`)
      return
    }
    const wantY = want.y + (want.y > 600 ? shift : 0)
    const problems = []
    if (Math.abs(want.x - got.x) > POSITION)
      problems.push(`x pen ${want.x} app ${got.x.toFixed(2)}`)
    if (Math.abs(wantY - got.y) > POSITION)
      problems.push(`y pen ${wantY} app ${got.y.toFixed(2)}`)
    if (Math.abs(want.fontSize - got.fontSize) > FONT_SIZE)
      problems.push(`fontSize pen ${want.fontSize} app ${got.fontSize}`)
    if (want.fontWeight !== got.fontWeight)
      problems.push(`fontWeight pen ${want.fontWeight} app ${got.fontWeight}`)
    if (colorDistance(want.color, got.color) > COLOR)
      problems.push(`color pen ${want.color} app ${got.color}`)
    check(
      problems.length === 0,
      `${tag} "${want.text}"${problems.length ? ` ${problems.join("; ")}` : ""}`
    )
  })
  void active
}

const measureText = async (page, tag, height, active) => {
  const result = await page.evaluate(
    probeSource({
      mode: "app",
      pane: SIDEBAR,
      texts: layout.texts,
      tokens: [],
    })
  )
  must(!result.error, result.error ?? "probe")
  report.measured = report.measured ?? {}
  report.measured[tag] = result.measured
  compare(tag, height, active, result.measured)
}

const geometry = (page) =>
  page.evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(SIDEBAR)});
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right }; };
    const one = (selector) => root.querySelector(selector);
    const links = [...root.querySelectorAll('[data-slot="sidebar-link"]')].filter((a) => a.offsetParent);
    const labels = [...root.querySelectorAll('[data-slot="sidebar-group-label"]')].map((button) => {
      const range = document.createRange();
      range.selectNodeContents([...button.childNodes].find((n) => n.nodeType === 3));
      const text = range.getBoundingClientRect();
      const chevron = button.querySelector('svg');
      return { text: button.textContent.trim(), textRight: text.right, chevron: box(chevron), button: box(button) };
    });
    const profile = one('[data-slot="shell-profile"]');
    const gear = profile.querySelector('a svg');
    const avatar = profile.querySelector('[data-slot="avatar"]');
    const newChat = one('button[aria-label="New chat"]');
    const search = one('button[aria-label="Search"]');
    const mark = one('[data-slot="mark"]');
    return {
      root: box(root),
      mark: box(mark),
      search: box(search),
      newChat: { ...box(newChat), background: getComputedStyle(newChat).backgroundColor, radius: getComputedStyle(newChat).borderTopLeftRadius },
      links: links.map((a) => ({ name: a.getAttribute('aria-label') ?? a.textContent.trim(), ...box(a), icon: box(a.querySelector('svg')), current: a.getAttribute('aria-current'), background: getComputedStyle(a).backgroundColor })),
      labels,
      profile: box(profile),
      avatar: box(avatar),
      gear: box(gear),
      rootBackground: getComputedStyle(root).backgroundColor,
      fontFamily: getComputedStyle(root).fontFamily,
    };
  })()`)

const near = (a, b, tolerance = POSITION) => Math.abs(a - b) <= tolerance

function checkGeometry(tag, height, shape, active) {
  check(shape.root.w === 244, `${tag} sidebar is 244px wide (${shape.root.w})`)
  check(
    near(shape.mark.w, 20) && near(shape.mark.h, 20),
    `${tag} logo mark is 20x20`
  )
  check(
    near(shape.mark.x, 16) && near(shape.mark.y, 18),
    `${tag} logo mark sits at 16,18 (${shape.mark.x},${shape.mark.y})`
  )
  check(
    near(shape.search.w, 28) &&
      near(shape.search.h, 28) &&
      near(shape.newChat.w, 28) &&
      near(shape.newChat.h, 28),
    `${tag} search and new chat buttons are 28x28`
  )
  check(
    near(shape.search.r, 202) && near(shape.newChat.r, 232),
    `${tag} search and new chat sit at the top right (${shape.search.r}, ${shape.newChat.r})`
  )
  check(
    shape.newChat.background === "rgb(255, 255, 255)" &&
      parseFloat(shape.newChat.radius) >= 14,
    `${tag} new chat is a white circle`
  )
  for (const link of shape.links) {
    check(
      near(link.h, 28) && near(link.w, 224) && near(link.x, 10),
      `${tag} row "${link.name}" is 224x28 at x 10 (${link.w}x${link.h} at ${link.x})`
    )
    check(
      near(link.icon.w, 16) && near(link.icon.h, 16) && near(link.icon.x, 18),
      `${tag} row "${link.name}" icon is 16x16 at x 18`
    )
  }
  const current = shape.links.filter((link) => link.current === "page")
  check(
    current.length === 1 && current[0].name === active,
    `${tag} exactly "${active}" is the current page (${current.map((l) => l.name)})`
  )
  check(
    current[0]?.background === ACTIVE_BACKGROUND,
    `${tag} the active row is filled ${ACTIVE_BACKGROUND} (${current[0]?.background})`
  )
  check(
    shape.links
      .filter((link) => link.current !== "page")
      .every((link) => link.background === "rgba(0, 0, 0, 0)"),
    `${tag} no other row is filled`
  )
  for (const label of shape.labels) {
    check(
      near(label.chevron.w, 9) && near(label.chevron.h, 9),
      `${tag} "${label.text}" chevron is 9x9`
    )
    check(
      near(label.chevron.x - label.textRight, 4),
      `${tag} "${label.text}" chevron follows the label by 4px (${(label.chevron.x - label.textRight).toFixed(2)})`
    )
    check(
      near(label.button.h, 28),
      `${tag} "${label.text}" group row is 28 tall`
    )
  }
  check(
    shape.labels.map((label) => label.text).join("|") === "Your work|Favorites",
    `${tag} group labels are Your work, Favorites`
  )
  check(
    near(shape.profile.h, 32) &&
      near(shape.profile.y + shape.profile.h, height - 12),
    `${tag} footer is 32 tall and ends 12px above the bottom`
  )
  check(
    near(shape.avatar.w, 18) && near(shape.avatar.h, 18),
    `${tag} avatar is 18x18`
  )
  check(
    near(shape.gear.w, 16) && near(shape.gear.r, 226),
    `${tag} settings gear is 16 wide and ends at 226 (${shape.gear.r})`
  )
}

async function sheet(page, name, penFile, appFile, height) {
  if (!penFile || !existsSync(penFile)) return null
  const html = join(output, `${name}-sheet.html`)
  const crop = (src) =>
    `<div style="width:244px;height:${height}px;overflow:hidden;position:relative;border:1px solid #888"><img src="${pathToFileURL(src).href}" style="position:absolute;left:0;top:0"></div>`
  writeFileSync(
    html,
    `<!doctype html><body style="margin:0;background:#fff;font:12px Inter,sans-serif"><div style="display:flex;gap:24px;padding:12px"><div>pen<br>${crop(penFile)}</div><div>app<br>${crop(appFile)}</div></div></body>`
  )
  return html
}

const browser = await launchBrowser()
try {
  const setup = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  await setup.goto(web)
  await signUp(setup, api, log)
  await seed(setup)
  await setup.close()

  const desktop = [
    [1440, 900, "/coach", "Coach", "coach"],
    [1440, 900, "/paper", "Paper", "paper"],
    [1440, 900, "/apply", "Apply", "apply"],
    [1440, 900, "/inbox", "Inbox", "inbox"],
    [1024, 768, "/paper", "Paper", null],
  ]
  for (const [width, height, path, active, penName] of desktop) {
    const tag = `${width} ${path}`
    const page = await browser.openPage({
      width,
      height,
      mobile: false,
      reducedMotion: true,
    })
    await page.goto(`${web}${path}`)
    await waitSidebar(page, SIDEBAR)
    await measureText(page, tag, height, active)
    const shape = await geometry(page)
    checkGeometry(tag, height, shape, active)
    check(
      /Inter/.test(shape.fontFamily) &&
        (await page.evaluate(
          "document.fonts.check('13px \"Inter Variable\"')"
        )),
      `${tag} Inter is loaded and applied`
    )
    const file = `sidebar-${width}-${path.slice(1)}.png`
    await page.screenshot(join(output, file), false)
    report.captures.push(file)
    const sheetFile = await sheet(
      page,
      `${width}-${path.slice(1)}`,
      penName && penDir ? join(penDir, `${penName}.png`) : null,
      join(output, file),
      height
    )
    if (sheetFile) {
      const viewer = await browser.openPage({
        width: 560,
        height: height + 60,
        mobile: false,
        reducedMotion: true,
      })
      await viewer.goto(pathToFileURL(sheetFile).href)
      await viewer.sleep(500)
      const out = `sidebar-sheet-${path.slice(1)}.png`
      await viewer.screenshot(join(output, out), false)
      report.captures.push(out)
      await viewer.close()
    }
    if (width === 1440 && path === "/paper") {
      const rows = await page.evaluate(
        `[...document.querySelectorAll('${SIDEBAR} [data-slot="sidebar-link"]')].map((a) => a.getAttribute('aria-label') ?? a.textContent.trim())`
      )
      check(
        rows.join("|") ===
          "Inbox|Coach|Jobs|Paper|Apply|Pitch|Junior Marketing CV|Lumière application Lumière",
        `${tag} rows in pen order, CV before application (${rows.join("|")})`
      )
      await page.evaluate(`document.querySelector('${SIDEBAR} a').focus()`)
      await page.key("Tab")
      const focused = await page.evaluate(
        `document.activeElement.getAttribute('aria-label') ?? document.activeElement.textContent.trim()`
      )
      check(
        focused === "Coach",
        `${tag} Tab moves to the next row (${focused})`
      )
      const ring = await page.evaluate(
        `getComputedStyle(document.activeElement).boxShadow`
      )
      check(
        ring && ring !== "none",
        `${tag} the focused row shows a focus ring`
      )
      const toggle = async () => {
        await page.evaluate(
          `[...document.querySelectorAll('${SIDEBAR} [data-slot="sidebar-group-label"]')].find((b) => b.textContent.trim() === 'Your work').click()`
        )
        await page.sleep(300)
        return page.evaluate(
          `[...document.querySelectorAll('${SIDEBAR} [data-slot="sidebar-group-label"]')].find((b) => b.textContent.trim() === 'Your work').getAttribute('aria-expanded')`
        )
      }
      check(
        (await toggle()) === "false",
        `${tag} Your work collapses on activation`
      )
      const hidden = await page.evaluate(
        `![...document.querySelectorAll('${SIDEBAR} [data-slot="sidebar-link"]')].some((a) => a.offsetParent && a.textContent.trim() === 'Apply')`
      )
      check(hidden, `${tag} the collapsed group hides Paper, Apply, Pitch`)
      const collapsed = `sidebar-1440-paper-collapsed.png`
      await page.screenshot(join(output, collapsed), false, {
        x: 0,
        y: 0,
        width: 244,
        height,
      })
      report.captures.push(collapsed)
      await page.goto(`${web}${path}`)
      await waitSidebar(page, SIDEBAR)
      const stayed = await page.evaluate(
        `[...document.querySelectorAll('${SIDEBAR} [data-slot="sidebar-group-label"]')].find((b) => b.textContent.trim() === 'Your work').getAttribute('aria-expanded')`
      )
      check(
        stayed === "false",
        `${tag} the collapsed group stays closed after reload`
      )
      check((await toggle()) === "true", `${tag} Your work expands again`)
    }
    await page.close()
  }

  const phone = await browser.openPage({
    width: 390,
    height: 844,
    mobile: true,
    reducedMotion: true,
  })
  await phone.goto(`${web}/paper`)
  await phone.waitFor(
    `!!document.querySelector('button[aria-label="Menu"]')`,
    20000
  )
  check(
    await phone.evaluate(`!document.querySelector(${JSON.stringify(SIDEBAR)})`),
    "390 the desktop rail is not shown on a phone"
  )
  await phone.evaluate(
    `document.querySelector('button[aria-label="Menu"]').click()`
  )
  await waitSidebar(phone, DRAWER)
  const drawer = await phone.evaluate(`(() => {
    const nav = document.querySelector(${JSON.stringify(DRAWER)});
    const r = nav.getBoundingClientRect();
    const names = [...nav.querySelectorAll('[data-slot="sidebar-link"], button[aria-label]')].map((e) => e.getAttribute('aria-label') ?? e.textContent.trim());
    return { w: r.width, h: r.height, right: r.right, scroll: document.documentElement.scrollWidth, names, name: nav.querySelector('[data-slot="shell-profile"]').textContent.trim() };
  })()`)
  check(
    drawer.right <= 390 && drawer.scroll <= 390,
    `390 the drawer fits the phone (${drawer.right}, page ${drawer.scroll})`
  )
  for (const name of [
    "Search",
    "New chat",
    "Inbox",
    "Coach",
    "Jobs",
    "Paper",
    "Apply",
    "Pitch",
    "Junior Marketing CV",
  ])
    check(drawer.names.includes(name), `390 the drawer lists ${name}`)
  check(
    drawer.name.includes("Linh Nguyen"),
    `390 the drawer footer names the person (${drawer.name})`
  )
  const overlap = await phone.evaluate(`(() => {
    const a = document.querySelector('${DRAWER} button[aria-label="New chat"]').getBoundingClientRect();
    const b = document.querySelector('button[aria-label="Close menu"]').getBoundingClientRect();
    return { clear: b.left >= a.right || b.right <= a.left || b.top >= a.bottom || b.bottom <= a.top, close: b.left };
  })()`)
  check(
    overlap.clear && overlap.close < 390,
    `390 Close menu does not cover New chat and stays on screen (left ${overlap.close})`
  )
  await phone.screenshot(join(output, "sidebar-390-drawer.png"), false)
  report.captures.push("sidebar-390-drawer.png")
  await phone.key("Escape")
  await phone.sleep(400)
  check(
    await phone.evaluate(`!document.querySelector('[role="dialog"]')`),
    "390 Escape closes the drawer"
  )
  await phone.close()
} finally {
  await browser.quit()
}

report.status = report.failures.length === 0 ? "PASS" : "FAIL"
writeFileSync(
  join(output, "sidebar-report.json"),
  JSON.stringify(report, null, 2)
)
console.log(
  `verify-sidebar ${report.status}: ${report.checks.length - report.failures.length}/${report.checks.length} checks, ${report.gaps.length} data gaps, ${report.captures.length} captures in ${output}`
)
process.exit(report.failures.length === 0 ? 0 : 1)
