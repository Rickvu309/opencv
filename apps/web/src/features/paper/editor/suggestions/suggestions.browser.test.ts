import { readFileSync } from "node:fs"
import path from "node:path"
import { chromium, type Browser, type Page } from "playwright-core"
import { build, type Rollup } from "vite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { domainEntryAliases } from "../../../../../domain-entries"

const webRoot = path.resolve(__dirname, "../../../../..")
const ORIGIN = "http://paper-suggestions.test"
const HARNESS = "\0paper-editor-harness"
const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

let browser: Browser
let html = ""

async function bundle(): Promise<string> {
  const editor = path.join(__dirname, "../paper-editor.ts")
  const documents = path.join(__dirname, "../lab-documents.ts")
  const output = (await build({
    configFile: false,
    root: webRoot,
    logLevel: "error",
    resolve: {
      alias: {
        "@": path.join(webRoot, "src"),
        ...domainEntryAliases(webRoot),
      },
    },
    plugins: [
      {
        name: "paper-editor-harness",
        resolveId: (id) => (id === HARNESS ? id : null),
        load: (id) =>
          id === HARNESS
            ? [
                `import { mountPaperEditor } from ${JSON.stringify(editor)}`,
                `import { labDocument, labSuggestions } from ${JSON.stringify(documents)}`,
                `const name = new URLSearchParams(location.search).get("doc")`,
                `window.paperLab = mountPaperEditor(document.getElementById("host"), { doc: labDocument(name) })`,
                `window.paperLab.focus()`,
                `window.portCalls = []`,
                `const record = (kind) => (id) => { window.portCalls.push([kind, id]); return Promise.resolve() }`,
                `window.paperLab.suggest(labSuggestions(name), { approve: record("approve"), deny: record("deny") })`,
              ].join("\n")
            : null,
      },
    ],
    build: {
      write: false,
      minify: false,
      cssCodeSplit: false,
      rollupOptions: {
        input: HARNESS,
        output: { format: "iife", inlineDynamicImports: true },
      },
    },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[]
  const files = (Array.isArray(output) ? output : [output]).flatMap(
    (each) => each.output
  )
  const code = files
    .flatMap((file) => (file.type === "chunk" ? [file.code] : []))
    .join("\n")
  const css = files
    .flatMap((file) =>
      file.type === "asset" && file.fileName.endsWith(".css")
        ? [String(file.source)]
        : []
    )
    .join("\n")
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>:root{--muted:#f4f4f5;--border:#e4e4e7;--foreground:#09090b}body{margin:0}#scroller{height:100vh;overflow:auto}${css}</style></head><body><div id="scroller"><div id="host"></div></div><script>${code.replaceAll("</script", "<\\/script")}</script></body></html>`
}

async function launch(): Promise<Browser> {
  const args = ["--font-render-hinting=slight"]
  try {
    return await chromium.launch({ args })
  } catch {
    return await chromium.launch({ args, channel: "chrome" })
  }
}

async function open(doc: string, viewport = DESK, isMobile = false) {
  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch: isMobile,
  })
  const page = await context.newPage()
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith("/fonts/")) {
      const file = path.join(webRoot, "public", url.pathname)
      await route.fulfill({ body: readFileSync(file), contentType: "font/ttf" })
      return
    }
    await route.fulfill({ body: html, contentType: "text/html" })
  })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(`${ORIGIN}/?doc=${doc}`)
  await page
    .waitForFunction(() => Boolean(window.paperLab), null, { timeout: 15_000 })
    .catch(() => {
      throw new Error(`the editor did not mount: ${errors.join("; ")}`)
    })
  await page.evaluate(() => document.fonts.ready)
  return page
}

declare global {
  interface Window {
    portCalls?: [string, string][]
  }
}

const OLD_8 = "Planned a move from shelf lists to a shared catalog."
const NEW_8 = "Moved the shelf lists into a shared catalog."
const OLD_9 =
  "Compared each imported batch with the original accession records."
const NEW_9 = "Checked each imported batch against the accession records."

const bullets = (page: Page) =>
  page.evaluate(() =>
    window
      .paperLab!.read()
      .doc.content.filter((block) => ["c8", "c9"].includes(block.attrs.id))
      .map((block) =>
        block.type === "text_block"
          ? (block.content ?? [])
              .map((run) => (run.type === "text" ? run.text : ""))
              .join("")
          : ""
      )
  )

const lineStyle = (page: Page, block: string) =>
  page.evaluate((id) => {
    const line = document.querySelector(`.paper-line[data-block="${id}"]`)
    const run = line?.querySelector<HTMLElement>(
      ".paper-run:not([data-marker])"
    )
    if (!run) return null
    const style = getComputedStyle(run)
    return {
      text: line!.textContent,
      decoration: style.textDecorationLine,
    }
  }, block)

const chip = (page: Page, proposal: string, kind: "accept" | "reject") =>
  page.locator(
    `.paper-suggest-chips[data-proposal="${proposal}"] .paper-suggest-${kind}`
  )

beforeAll(async () => {
  html = await bundle()
  browser = await launch()
}, 120_000)

afterAll(async () => {
  await browser?.close()
})

describe("Coach suggestions on the page", () => {
  it("shows the old line struck and the new line marked under it", async () => {
    const page = await open("en-10")
    const strip = page.locator(".paper-suggest-strip")
    expect(await strip.isVisible()).toBe(true)
    expect(await strip.textContent()).toContain("Coach 2 suggestions")
    expect(await lineStyle(page, "c8")).toMatchObject({
      decoration: "line-through",
    })
    expect(await lineStyle(page, "c8~lab-proposal-1~new0")).toEqual({
      text: expect.stringContaining(NEW_8),
      decoration: "underline",
    })
    expect(await bullets(page)).toEqual([OLD_8, OLD_9])
    const old = await page.locator('.paper-line[data-block="c8"]').boundingBox()
    const added = await page
      .locator('.paper-line[data-block="c8~lab-proposal-1~new0"]')
      .boundingBox()
    const buttons = await chip(page, "lab-proposal-1", "accept").boundingBox()
    expect(added!.y).toBeGreaterThan(old!.y)
    expect(buttons!.y).toBeGreaterThanOrEqual(added!.y + added!.height - 1)
    const next = await page
      .locator('.paper-line[data-block="c9"]')
      .boundingBox()
    expect(buttons!.y + buttons!.height).toBeLessThanOrEqual(next!.y + 1)
    await page.context().close()
  }, 60_000)

  it("accepts one change and rejects the other", async () => {
    const page = await open("en-10")
    await chip(page, "lab-proposal-1", "accept").click()
    await page.waitForFunction(() => window.portCalls!.length === 1)
    expect(await bullets(page)).toEqual([NEW_8, OLD_9])
    await chip(page, "lab-proposal-2", "reject").click()
    await page.waitForFunction(() => window.portCalls!.length === 2)
    expect(await bullets(page)).toEqual([NEW_8, OLD_9])
    expect(await page.evaluate(() => window.portCalls)).toEqual([
      ["approve", "lab-proposal-1"],
      ["deny", "lab-proposal-2"],
    ])
    expect(await page.locator(".paper-suggest-strip").isVisible()).toBe(false)
    expect(await page.locator(".paper-suggest-chips").count()).toBe(0)
    await page.context().close()
  }, 60_000)

  it("accepts all in one click and one Undo takes both back", async () => {
    const page = await open("en-10")
    await page.locator(".paper-suggest-all").click()
    await page.waitForFunction(() => window.portCalls!.length === 2)
    expect(await bullets(page)).toEqual([NEW_8, NEW_9])
    expect(await page.locator(".paper-suggest-toast").textContent()).toContain(
      "Accepted 2 changes"
    )
    await page.keyboard.press("Control+z")
    expect(await bullets(page)).toEqual([OLD_8, OLD_9])
    await page.keyboard.press("Control+z")
    expect(await bullets(page)).toEqual([OLD_8, OLD_9])
    await page.context().close()
  }, 60_000)

  it("keeps the buttons readable on a phone", async () => {
    const page = await open("en-10", PHONE, true)
    const buttons = await chip(page, "lab-proposal-1", "accept").boundingBox()
    expect(buttons!.height).toBeGreaterThanOrEqual(27)
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth
    )
    expect(width).toBeLessThanOrEqual(PHONE.width)
    await page.context().close()
  }, 60_000)
})
