import { readFileSync } from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { chromium, type Browser, type Page } from "playwright-core"
import { build, type Rollup } from "vite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { domainEntryAliases } from "../../../../../domain-entries"
import { detect } from "../../../../../../../scripts/lib/paper-flat-toolbar.mjs"

const webRoot = path.resolve(__dirname, "../../../../..")
const ORIGIN = "http://paper-editor.test"
const HARNESS = "\0paper-toolbar-harness"
const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const REASON = "Save this Paper first to download it"

let browser: Browser
let html = ""

async function bundle(): Promise<string> {
  const chrome = path.join(__dirname, "paper-chrome.tsx")
  const documents = path.join(__dirname, "..", "lab-documents.ts")
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
      react(),
      tailwindcss(),
      {
        name: "paper-toolbar-harness",
        resolveId: (id) => (id === HARNESS ? id : null),
        load: (id) =>
          id === HARNESS
            ? [
                `import "@workspace/ui/globals.css"`,
                `import { createElement, Fragment } from "react"`,
                `import { createRoot } from "react-dom/client"`,
                `import { Toaster } from "@workspace/ui/components/sonner"`,
                `import { PaperChrome } from ${JSON.stringify(chrome)}`,
                `import { labDocument } from ${JSON.stringify(documents)}`,
                `const doc = labDocument(new URLSearchParams(location.search).get("doc"))`,
                `createRoot(document.getElementById("root")).render(createElement(Fragment, null,`,
                `  createElement(PaperChrome, { doc, title: "Paper test page", download: { reason: ${JSON.stringify(REASON)} }, photoReason: "Needs a saved Paper", onEditor: (editor) => { window.paperLab = editor ?? undefined } }),`,
                `  createElement(Toaster)))`,
              ].join("\n")
            : null,
      },
    ],
    build: {
      write: false,
      minify: false,
      cssCodeSplit: false,
      assetsInlineLimit: 0,
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
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${code.replaceAll("</script", "<\\/script")}</script></body></html>`
}

async function open(viewport = DESK, isMobile = false, doc = "") {
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
    if (url.pathname !== "/") {
      await route.fulfill({ status: 404, body: "" })
      return
    }
    await route.fulfill({ body: html, contentType: "text/html" })
  })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(`${ORIGIN}/?doc=${doc}`)
  await page
    .getByRole("toolbar", { name: "Formatting" })
    .waitFor({ timeout: 15_000 })
    .catch(() => {
      throw new Error(`the toolbar did not mount: ${errors.join("; ")}`)
    })
  return page
}

const measure = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('[role="toolbar"]')!
    return {
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      controls: [...bar.querySelectorAll<HTMLElement>("button")].map(
        (button) => {
          const box = button.getBoundingClientRect()
          return {
            label: button.getAttribute("aria-label") ?? "",
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            visible:
              box.width > 0 &&
              box.height > 0 &&
              getComputedStyle(button).visibility !== "hidden",
          }
        }
      ),
    }
  })

const tool = (page: Page, name: string) =>
  page.getByRole("toolbar", { name: "Formatting" }).getByRole("button", {
    name,
    exact: true,
  })

async function openMenu(page: Page, name: string) {
  await tool(page, name).click()
  const menu = page.getByRole("menu", { name, exact: true })
  await menu.waitFor()
  await menu.locator('[role^="menuitem"]').first().waitFor()
  return menu
}

const firstBlock = (page: Page) =>
  page.evaluate(() => {
    const block = window.paperLab!.read().doc.content[0]!
    if (block.type !== "text_block") return null
    return {
      kind: block.attrs.kind,
      list: block.attrs.list,
      bold: (block.content ?? []).some(
        (run) =>
          run.type === "text" &&
          (run.marks ?? []).some((mark) => mark.type === "bold")
      ),
    }
  })

async function typeAndSelect(page: Page, text: string) {
  await page.keyboard.type(text)
  await page.keyboard.press("ControlOrMeta+a")
}

beforeAll(async () => {
  html = await bundle()
  const args = ["--font-render-hinting=slight"]
  browser = await chromium
    .launch({ args })
    .catch(() => chromium.launch({ args, channel: "chrome" }))
}, 120_000)

afterAll(async () => {
  await browser?.close()
})

describe("the flat Paper toolbar", () => {
  it("shows headings and lists on one row at 1440 without opening More", async () => {
    const page = await open(DESK)
    expect(detect(await measure(page))).toEqual([])
    await expect.poll(() => tool(page, "Text style").isVisible()).toBe(true)
    expect(await tool(page, "Bulleted list").isVisible()).toBe(true)
    expect(await tool(page, "Numbered list").isVisible()).toBe(true)
    await page.context().close()
  })

  it("fits a 390 phone in two rows with no sideways scroll", async () => {
    const page = await open(PHONE, true)
    const measured = await measure(page)
    expect(detect(measured)).toEqual([])
    expect(await tool(page, "Font").innerText()).toBe("Sans")
    const canvas = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector(".paper-editor")!)
          .backgroundColor
    )
    expect(canvas).toBe("rgba(0, 0, 0, 0)")
    await page.context().close()
  })

  it("applies style, bold and list and reflects the selection", async () => {
    const page = await open(DESK)
    await typeAndSelect(page, "Product designer")
    await tool(page, "Bold").click()
    expect(await tool(page, "Bold").getAttribute("aria-pressed")).toBe("true")
    await tool(page, "Text style").click()
    await page
      .getByRole("menuitemradio", { name: "Heading", exact: true })
      .click()
    await expect
      .poll(() => tool(page, "Text style").innerText())
      .toBe("Heading")
    await tool(page, "Bulleted list").click()
    expect(await tool(page, "Bulleted list").getAttribute("aria-pressed")).toBe(
      "true"
    )
    expect(await firstBlock(page)).toEqual({
      kind: "heading",
      list: "bullet",
      bold: true,
    })
    await tool(page, "Undo").click()
    expect((await firstBlock(page))?.list).toBeNull()
    await page.context().close()
  })

  it("offers four fonts with no Caladea and the More items", async () => {
    const page = await open(DESK)
    const fontMenu = await openMenu(page, "Font")
    const fonts = await fontMenu.getByRole("menuitemradio").allInnerTexts()
    expect(fonts).toEqual([
      "Liberation Sans",
      "Liberation Serif",
      "Liberation Mono",
      "Carlito",
    ])
    await page.keyboard.press("Escape")
    const moreMenu = await openMenu(page, "More")
    const more = await moreMenu.getByRole("menuitem").allInnerTexts()
    expect(more.map((item) => item.split("\n")[0])).toEqual([
      "Strikethrough",
      "Highlight",
      "Increase indent",
      "Decrease indent",
      "Line spacing 1.5",
      "Divider line",
      "Photo",
      "Table",
      "Clear formatting",
    ])
    await page.context().close()
  })

  it("turns Ctrl+P into the PDF download and Ctrl+/ into the shortcut list", async () => {
    const page = await open(DESK)
    await page.evaluate(() => {
      window.print = () => {
        document.body.dataset.printed = "yes"
      }
    })
    await page.keyboard.press("ControlOrMeta+p")
    await expect.poll(() => page.getByText(REASON).count()).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.body.dataset.printed)).toBe(
      undefined
    )
    await page.keyboard.press("ControlOrMeta+/")
    await page
      .getByRole("dialog", { name: "Keyboard shortcuts" })
      .waitFor({ timeout: 5_000 })
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "File" }).click()
    const word = page.getByRole("menuitem", { name: /Download Word/ })
    expect(await word.getAttribute("aria-disabled")).toBe("true")
    await page.context().close()
  })
})
