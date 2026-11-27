import { KEYSTROKE_PROBE, percentile } from "./keystrokes.mjs"

export const LAB_ROUTE = "/paper-lab"
export const LAB_PERF_DOC = "en-10"
const LAB_PERF_PAGE = 1
const LAB_PERF_LINE = 5
const BARE_PATH = "/__walk-bare-textarea"
const KEY_MS = 20_000

export function labBlocksInPage(editorSelector) {
  const editor = document.querySelector(editorSelector)
  if (!editor) return []
  const byBlock = new Map()
  for (const line of editor.querySelectorAll(".paper-line")) {
    const id = line.getAttribute("data-block")
    const kind = line.getAttribute("data-kind")
    const list = line.getAttribute("data-list")
    const runs = [...line.querySelectorAll(".paper-run:not([data-marker])")]
    const entry = byBlock.get(id) ?? {
      type: list
        ? list === "numbered"
          ? "numberedListItem"
          : "bulletListItem"
        : kind === "heading" || kind === "title"
          ? "heading"
          : kind === "subheading" || kind === "subtitle"
            ? "heading"
            : "paragraph",
      level:
        kind === "heading" || kind === "title"
          ? 1
          : kind === "subheading" || kind === "subtitle"
            ? 2
            : null,
      depth: Number(line.getAttribute("data-level")) || 0,
      parts: [],
      weights: [],
      links: [],
    }
    entry.parts.push(runs.map((run) => run.textContent).join(""))
    for (const run of runs) {
      if (run.textContent.trim())
        entry.weights.push(Number(getComputedStyle(run).fontWeight))
      const href = run.getAttribute("data-href")
      if (href && !entry.links.includes(href)) entry.links.push(href)
    }
    byBlock.set(id, entry)
  }
  return [...byBlock.values()].map((entry) => ({
    type: entry.type,
    level: entry.level,
    depth: entry.depth,
    text: entry.parts.join("").trim(),
    bold:
      entry.weights.length > 0 &&
      entry.weights.every((weight) => weight >= 600),
    links: entry.links,
  }))
}

export function labCaretInPage(editorSelector) {
  const editor = document.querySelector(editorSelector)
  const caret = editor?.querySelector(".paper-caret")
  return Boolean(
    editor &&
    document.activeElement?.classList.contains("paper-input") &&
    editor.contains(document.activeElement) &&
    caret &&
    !caret.hidden
  )
}

export const LAB_SURFACE = {
  name: "lab",
  page: ".paper-editor",
  line: ".paper-editor .paper-line",
  ready: ".paper-editor .paper-editor-page",
  blocksInPage: labBlocksInPage,
  caretInPage: labCaretInPage,
  pointer: { force: true },
}

const fine = (value) => (value === null ? null : Math.round(value * 10) / 10)

export function fineStats(samples) {
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    keys: sorted.length,
    p50: fine(percentile(sorted, 0.5)),
    p95: fine(percentile(sorted, 0.95)),
    max: fine(sorted.at(-1) ?? null),
  }
}

async function pressKeys(page, count) {
  await page.evaluate(() => {
    window.__walkKeys = []
  })
  for (let key = 0; key < count; key += 1) {
    await page.keyboard.press(key % 8 === 7 ? "Space" : "KeyX")
    await page.waitForFunction(
      (wanted) => window.__walkKeys.length >= wanted,
      key + 1,
      { timeout: KEY_MS }
    )
  }
  return page.evaluate(() => window.__walkKeys)
}

export async function labKeystrokeTiming({ context, state, keys }) {
  const page = await context.newPage()
  await page.addInitScript(KEYSTROKE_PROBE)
  await page.goto(`${state.webOrigin}${LAB_ROUTE}?doc=${LAB_PERF_DOC}`, {
    waitUntil: "domcontentloaded",
  })
  await page.locator(LAB_SURFACE.ready).first().waitFor({ timeout: KEY_MS })
  await page.evaluate(() => document.fonts.ready)
  const target = page
    .locator(`.paper-editor-page[data-page="${LAB_PERF_PAGE}"] .paper-line`)
    .nth(LAB_PERF_LINE)
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(300)
  const pages = await page.locator(".paper-editor-page").count()
  const editor = await pressKeys(page, keys)
  await page.route(`${state.webOrigin}${BARE_PATH}`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><meta charset="utf-8"><textarea autofocus style="width:600px;height:400px"></textarea>',
    })
  )
  await page.goto(`${state.webOrigin}${BARE_PATH}`)
  await page.locator("textarea").click()
  const bare = await pressKeys(page, keys)
  await page.close()
  const editorStats = fineStats(editor)
  const bareStats = fineStats(bare)
  return {
    route: LAB_ROUTE,
    doc: LAB_PERF_DOC,
    pages,
    keydownToNextFrame: editorStats,
    bareTextarea: bareStats,
    p95OverBare: fine(editorStats.p95 - bareStats.p95),
    maxOverBare: fine(editorStats.max - bareStats.max),
  }
}
