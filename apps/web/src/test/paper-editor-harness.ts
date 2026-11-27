import { readFileSync } from "node:fs"
import path from "node:path"
import { chromium, type Browser, type Page } from "playwright-core"
import { build, type Rollup } from "vite"
import { afterAll, beforeAll } from "vitest"

import { domainEntryAliases } from "../../domain-entries"

const webRoot = path.resolve(__dirname, "../..")
const EDITOR = path.join(webRoot, "src/features/paper/editor")
const ORIGIN = "http://paper-editor.test"
const HARNESS = "\0paper-editor-harness"
export const DESK = { width: 1440, height: 900 }
export const PHONE = { width: 390, height: 844 }

type Facts = { kind: string; list: string | null; level: number; text: string }

async function bundle(): Promise<string> {
  const editor = path.join(EDITOR, "paper-editor.ts")
  const documents = path.join(EDITOR, "lab-documents.ts")
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
                `import { labDocument } from ${JSON.stringify(documents)}`,
                `const name = new URLSearchParams(location.search).get("doc")`,
                `window.paperLab = mountPaperEditor(document.getElementById("host"), { doc: labDocument(name) })`,
                `window.paperLab.focus()`,
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

async function openWith(
  browser: Browser,
  html: string,
  doc: string,
  viewport = DESK,
  isMobile = false
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
  await page.goto(`${ORIGIN}/?doc=${doc}`)
  await page
    .waitForFunction(() => Boolean(window.paperLab), null, { timeout: 15_000 })
    .catch(() => {
      throw new Error(`the editor did not mount: ${errors.join("; ")}`)
    })
  await page.evaluate(() => document.fonts.ready)
  return page
}

export const blocks = (page: Page) =>
  page.evaluate(() =>
    window.paperLab!.read().doc.content.map((block) => ({
      kind: block.type === "text_block" ? block.attrs.kind : block.type,
      list: block.type === "text_block" ? block.attrs.list : null,
      level: block.type === "text_block" ? block.attrs.level : 0,
      text:
        block.type === "text_block"
          ? (block.content ?? [])
              .map((run) => (run.type === "text" ? run.text : "\n"))
              .join("")
          : "",
    }))
  ) as Promise<Facts[]>

export const texts = async (page: Page) =>
  (await blocks(page)).map((b) => b.text)

export const paintedPages = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".paper-editor-page")].map(
      (sheet) =>
        [...sheet.querySelectorAll<HTMLElement>(".paper-line")].map((line) =>
          [...line.querySelectorAll(".paper-run:not([data-marker])")]
            .map((run) => run.textContent)
            .join("")
        )
    )
  )

export async function typeLines(page: Page, lines: string[]) {
  for (const [n, line] of lines.entries()) {
    if (n > 0) await page.keyboard.press("Enter")
    await page.keyboard.type(line)
  }
}

export async function compose(page: Page, steps: string[]) {
  const cdp = await page.context().newCDPSession(page)
  for (const step of steps)
    await cdp.send("Input.imeSetComposition", {
      text: step,
      selectionStart: step.length,
      selectionEnd: step.length,
    })
  const underlined = await page.locator(".paper-composition").count()
  await cdp.send("Input.insertText", { text: steps.at(-1)! })
  await cdp.detach()
  return underlined
}

export function paperEditorPages() {
  let browser: Browser | undefined
  let html = ""
  beforeAll(async () => {
    html = await bundle()
    browser = await launch()
  }, 120_000)
  afterAll(async () => {
    await browser?.close()
  })
  return (doc: string, viewport = DESK, isMobile = false) =>
    openWith(browser!, html, doc, viewport, isMobile)
}
