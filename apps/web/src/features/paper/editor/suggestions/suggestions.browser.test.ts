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
                `const saved = new URLSearchParams(location.search).get("saved") === "1"`,
                `const receipt = (id) => ({ undo: () => { window.portCalls.push(["undo", id]); return Promise.resolve() } })`,
                `const record = (kind) => (id) => { window.portCalls.push([kind, id]); return Promise.resolve(saved && kind === "approve" ? receipt(id) : undefined) }`,
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
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>:root{--muted:#f4f4f5;--border:#e4e4e7;--foreground:#09090b;--background:#ffffff;--destructive:oklch(0.572 0.183 23.679);--chart-2:oklch(0.65 0.13 154.934)}body{margin:0}#scroller{height:100vh;overflow:auto}${css}</style></head><body><div id="scroller"><div id="host"></div></div><script>${code.replaceAll("</script", "<\\/script")}</script></body></html>`
}

async function launch(): Promise<Browser> {
  const args = ["--font-render-hinting=slight"]
  try {
    return await chromium.launch({ args })
  } catch {
    return await chromium.launch({ args, channel: "chrome" })
  }
}

async function open(
  doc: string,
  viewport = DESK,
  isMobile = false,
  saved = false
) {
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
  await page.goto(`${ORIGIN}/?doc=${doc}${saved ? "&saved=1" : ""}`)
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
      color: style.color,
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
    const added = await lineStyle(page, "c8~lab-proposal-1~new0")
    expect(added).toMatchObject({
      text: expect.stringContaining(NEW_8),
      decoration: "underline",
    })
    const plain = await lineStyle(page, "c10")
    const struck = await lineStyle(page, "c8")
    expect(new Set([plain!.color, struck!.color, added!.color]).size).toBe(3)
    expect(await bullets(page)).toEqual([OLD_8, OLD_9])
    const old = await page.locator('.paper-line[data-block="c8"]').boundingBox()
    const newLine = await page
      .locator('.paper-line[data-block="c8~lab-proposal-1~new0"]')
      .boundingBox()
    const buttons = await chip(page, "lab-proposal-1", "accept").boundingBox()
    expect(newLine!.y).toBeGreaterThan(old!.y)
    expect(buttons!.y).toBeGreaterThanOrEqual(newLine!.y + newLine!.height - 1)
    const next = await page
      .locator('.paper-line[data-block="c9"]')
      .boundingBox()
    const below = next!.y - (buttons!.y + buttons!.height)
    expect(below).toBeGreaterThanOrEqual(6)
    expect(below).toBeLessThanOrEqual(12)
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

  it("leaves a saved accept to the Paper and its Undo takes the saved receipts back newest first", async () => {
    const page = await open("en-10", DESK, false, true)
    await page.locator(".paper-suggest-all").click()
    await page.waitForFunction(() => window.portCalls!.length === 2)
    expect(await bullets(page)).toEqual([OLD_8, OLD_9])
    expect(await page.locator(".paper-suggest-chips").count()).toBe(0)
    const toast = page.locator(".paper-suggest-toast")
    expect(await toast.textContent()).toContain("Accepted 2 changes")
    await toast.getByRole("button", { name: "Undo" }).click()
    await page.waitForFunction(() => window.portCalls!.length === 4)
    expect(await page.evaluate(() => window.portCalls)).toEqual([
      ["approve", "lab-proposal-1"],
      ["approve", "lab-proposal-2"],
      ["undo", "lab-proposal-2"],
      ["undo", "lab-proposal-1"],
    ])
    expect(await bullets(page)).toEqual([OLD_8, OLD_9])
    await page.context().close()
  }, 60_000)

  it("hides the Undo toast once Ctrl+Z takes the Accept back", async () => {
    const page = await open("en-10")
    await chip(page, "lab-proposal-1", "accept").click()
    await page.waitForFunction(() => window.portCalls!.length === 1)
    const toast = page.locator(".paper-suggest-toast")
    expect(await toast.isVisible()).toBe(true)
    await page.keyboard.press("Control+z")
    expect(await bullets(page)).toEqual([OLD_8, OLD_9])
    expect(await toast.isVisible()).toBe(false)
    await page.context().close()
  }, 60_000)

  it("hides the Undo toast of a saved accept after Cmd+Z or the toolbar Undo", async () => {
    for (const undo of ["Meta+z", "toolbar"]) {
      const page = await open("en-10", DESK, false, true)
      await chip(page, "lab-proposal-1", "accept").click()
      await page.waitForFunction(() => window.portCalls!.length === 1)
      const toast = page.locator(".paper-suggest-toast")
      expect(await toast.isVisible()).toBe(true)
      await page.keyboard.type("x")
      if (undo === "toolbar")
        await page.evaluate(() => window.paperLab!.act({ do: "undo" }))
      else await page.keyboard.press(undo)
      expect(await toast.isVisible()).toBe(false)
      expect(await page.evaluate(() => window.portCalls)).toEqual([
        ["approve", "lab-proposal-1"],
      ])
      await page.context().close()
    }
  }, 60_000)

  it("makes Accept all, Accept and Reject 44px tall on a phone", async () => {
    const page = await open("en-10", PHONE, true)
    const accept = await chip(page, "lab-proposal-1", "accept").boundingBox()
    const reject = await chip(page, "lab-proposal-1", "reject").boundingBox()
    const all = await page.locator(".paper-suggest-all").boundingBox()
    expect(accept!.height).toBeGreaterThanOrEqual(44)
    expect(reject!.height).toBeGreaterThanOrEqual(44)
    expect(all!.height).toBeGreaterThanOrEqual(44)
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth
    )
    expect(width).toBeLessThanOrEqual(PHONE.width)
    await page.context().close()
  }, 60_000)

  it("grows the Coach label and the buttons with 200 percent text", async () => {
    const page = await open("en-10", PHONE, true)
    const sizes = () =>
      page.evaluate(() => ({
        label: parseFloat(
          getComputedStyle(document.querySelector(".paper-suggest-strip b")!)
            .fontSize
        ),
        accept: parseFloat(
          getComputedStyle(document.querySelector(".paper-suggest-accept")!)
            .fontSize
        ),
        all: parseFloat(
          getComputedStyle(document.querySelector(".paper-suggest-all")!)
            .fontSize
        ),
      }))
    const normal = await sizes()
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%"
    })
    const large = await sizes()
    expect(large.label).toBeGreaterThanOrEqual(normal.label * 2)
    expect(large.accept).toBeGreaterThanOrEqual(normal.accept * 2)
    expect(large.all).toBeGreaterThanOrEqual(normal.all * 2)
    const accept = await chip(page, "lab-proposal-1", "accept").boundingBox()
    expect(accept!.height).toBeGreaterThanOrEqual(44)
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth
    )
    expect(width).toBeLessThanOrEqual(PHONE.width)
    await page.context().close()
  }, 60_000)
})
