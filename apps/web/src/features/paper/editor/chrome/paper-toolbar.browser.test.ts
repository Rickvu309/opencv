import { readFileSync } from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { LayoutWork } from "@workspace/paper-engine"
import { chromium, type Browser, type Page } from "playwright-core"
import { build, type Rollup } from "vite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { domainEntryAliases } from "../../../../../domain-entries"
import { detect } from "../../../../../../../scripts/lib/paper-flat-toolbar.mjs"
import { detect as detectKeystrokeWork } from "../../../../../../../scripts/lib/paper-keystroke-work.mjs"

const webRoot = path.resolve(__dirname, "../../../../..")
const ORIGIN = "http://paper-editor.test"
const HARNESS = "\0paper-toolbar-harness"
const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const SMALL_PHONE = { width: 320, height: 640 }
const MENUS = ["File", "Text style", "Font", "Align", "More"]
const REASON = "Save this Paper first to download it"

declare global {
  interface Window {
    paperTestCommits: number
    paperTestLayoutWork: () => LayoutWork
  }
}

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
                `import { layoutWork } from "@workspace/paper-engine"`,
                `import { Toaster } from "@workspace/ui/components/sonner"`,
                `import { PaperChrome } from ${JSON.stringify(chrome)}`,
                `import { labDocument } from ${JSON.stringify(documents)}`,
                `window.paperTestLayoutWork = () => layoutWork(window.paperLab.layout())`,
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
  await page.addInitScript(() => {
    let commits = 0
    Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
      value: {
        supportsFiber: true,
        inject: () => 1,
        onCommitFiberRoot: () => {
          commits += 1
        },
      },
    })
    Object.defineProperty(window, "paperTestCommits", { get: () => commits })
  })
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
    const cut = (label: string, element: Element | null) =>
      element
        ? [
            {
              label,
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            },
          ]
        : []
    return {
      viewport: window.innerWidth,
      folded: [...bar.querySelectorAll("[data-folded]")].map(
        (button) => button.getAttribute("aria-label") ?? ""
      ),
      labels: [
        ...cut("Text style", bar.querySelector("[data-style-label]")),
        ...cut("Font", bar.querySelector('[aria-label="Font"]')),
        ...cut(
          "Paper header",
          document.querySelector('[data-slot="paper-chrome-header"]')
        ),
        ...cut("Paper chrome", document.querySelector(".paper-chrome")),
      ],
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

const firstText = (page: Page) =>
  page.evaluate(() => {
    const block = window.paperLab!.read().doc.content[0]!
    if (block.type !== "text_block") return ""
    return (block.content ?? [])
      .map((run) => (run.type === "text" ? run.text : ""))
      .join("")
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

const largeText = (page: Page) =>
  page.evaluate(
    () =>
      new Promise((done) => {
        document.documentElement.style.fontSize = "32px"
        requestAnimationFrame(() => requestAnimationFrame(done))
      })
  )

const focusedLabel = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement
    if (!active || active === document.body) return ""
    if (active.classList.contains("paper-input")) return "Paper page"
    return active.getAttribute("aria-label") ?? active.tagName.toLowerCase()
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

  it("folds lower tools into More on a 320 phone and keeps every tool reachable", async () => {
    const page = await open(SMALL_PHONE, true)
    const measured = await measure(page)
    expect(detect(measured)).toEqual([])
    expect(measured.folded.length).toBeGreaterThan(0)
    const more = await openMenu(page, "More")
    const items = await more.getByRole("menuitem").allInnerTexts()
    for (const label of measured.folded)
      expect(items.some((item) => item.startsWith(label))).toBe(true)
    await expect
      .poll(() =>
        more
          .locator(".paper-menu-row")
          .evaluateAll((items) =>
            Math.min(...items.map((item) => (item as HTMLElement).offsetHeight))
          )
      )
      .toBeGreaterThanOrEqual(44)
    expect(measured.folded).toContain("Link")
    await page.getByRole("menuitem", { name: "Link", exact: true }).click()
    const address = page.getByRole("textbox", { name: "Link address" })
    await address.waitFor()
    await expect.poll(() => focusedLabel(page)).toBe("Link address")
    const box = (await address.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(SMALL_PHONE.width)
    await page.context().close()
  })

  it("lets labels, the header and the toolbar grow with 200% text at 390 and 1440", async () => {
    for (const [viewport, mobile] of [
      [PHONE, true],
      [DESK, false],
    ] as const) {
      const page = await open(viewport, mobile)
      await largeText(page)
      await expect.poll(async () => detect(await measure(page))).toEqual([])
      await page.context().close()
    }
  })

  it("puts typing back on the page at the caret after Escape from a menu opened by pointer", async () => {
    const page = await open(DESK)
    await page.keyboard.type("Before")
    for (let step = 0; step < 3; step += 1)
      await page.keyboard.press("ArrowLeft")
    const escape = []
    const letters = "vwxyz"
    for (const [index, name] of MENUS.entries()) {
      await page.getByRole("button", { name, exact: true }).click()
      await page.getByRole("menu", { name, exact: true }).waitFor()
      await page.keyboard.press("Escape")
      await page.getByRole("menu", { name, exact: true }).waitFor({
        state: "hidden",
      })
      escape.push({
        menu: name,
        opened: "pointer",
        focused: await focusedLabel(page),
      })
      await page.keyboard.type(letters[index]!)
    }
    expect(detect({ ...(await measure(page)), escape })).toEqual([])
    expect(await firstText(page)).toBe(`Bef${letters}ore`)
    await page.context().close()
  })

  it("returns focus to the menu button on Escape from a menu opened from the keyboard and to the page after a choice", async () => {
    const page = await open(DESK)
    const escape = []
    for (const name of MENUS) {
      await page.getByRole("button", { name, exact: true }).focus()
      await page.keyboard.press("Enter")
      await page.getByRole("menu", { name, exact: true }).waitFor()
      await page.keyboard.press("Escape")
      await page.getByRole("menu", { name, exact: true }).waitFor({
        state: "hidden",
      })
      escape.push({
        menu: name,
        opened: "keyboard",
        focused: await focusedLabel(page),
      })
    }
    expect(detect({ ...(await measure(page)), escape })).toEqual([])
    await tool(page, "Text style").click()
    await page
      .getByRole("menuitemradio", { name: "Heading", exact: true })
      .click()
    await expect.poll(() => focusedLabel(page)).toBe("Paper page")
    await page.context().close()
  })

  it("prints only the pages, one A4 sheet per page", async () => {
    const page = await open(DESK, false, "en-10")
    await page.emulateMedia({ media: "print" })
    const printed = await page.evaluate(() => {
      const seen = (element: Element) => {
        const box = element.getBoundingClientRect()
        return box.width > 0 && box.height > 0
      }
      const pages = [...document.querySelectorAll(".paper-editor-page")]
      return {
        chrome: [
          ...document.querySelectorAll(
            'header, [role="toolbar"], .paper-suggest-strip, .paper-overlay, .paper-recovery'
          ),
        ]
          .filter(seen)
          .map((element) => element.tagName.toLowerCase()),
        pages: pages.filter(seen).length,
        widths: [
          ...new Set(
            pages.map((element) => element.getBoundingClientRect().width)
          ),
        ],
      }
    })
    expect(printed.chrome).toEqual([])
    expect(printed.pages).toBe(3)
    expect(printed.widths).toHaveLength(1)
    expect(printed.widths[0]).toBeCloseTo(794, 0)
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString("latin1")
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(3)
    await page.context().close()
  })
})

it("keeps each steady keystroke on the edited page", async () => {
  const page = await open(DESK, false, "en-10")
  try {
    await page.evaluate(() => document.fonts.ready)
    const line = page
      .locator('.paper-editor-page[data-page="1"] .paper-line')
      .nth(5)
    await line.scrollIntoViewIfNeeded()
    await line.click({ force: true })
    await page.keyboard.press("KeyX")
    await expect.poll(() => tool(page, "Undo").isEnabled()).toBe(true)
    expect(await page.evaluate(() => window.paperTestCommits)).toBeGreaterThan(
      1
    )
    const probe = await page.evaluateHandle(() => {
      const pending: MutationRecord[] = []
      const observer = new MutationObserver((records) =>
        pending.push(...records)
      )
      observer.observe(document.querySelector(".paper-editor")!, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      })
      let commits = window.paperTestCommits
      return async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
        const pages = new Set<number>()
        const lines = new Set<Element>()
        let caretWrites = 0
        let suggestionWrites = 0
        for (const { target } of pending
          .splice(0)
          .concat(observer.takeRecords())) {
          const element =
            target instanceof Element ? target : target.parentElement
          const page = element?.closest<HTMLElement>(".paper-editor-page")
          const line = element?.closest(".paper-line")
          if (page) pages.add(Number(page.dataset.page))
          if (line) lines.add(line)
          if (element?.matches(".paper-caret")) caretWrites += 1
          if (element?.closest(".paper-suggest-strip")) suggestionWrites += 1
        }
        const nextCommits = window.paperTestCommits
        const sample = {
          ...window.paperTestLayoutWork(),
          pages: [...pages],
          lines: lines.size,
          caretWrites,
          suggestionWrites,
          reactCommits: nextCommits - commits,
        }
        commits = nextCommits
        return sample
      }
    })
    const samples = []
    for (const char of ["KeyX", "KeyY", "KeyZ", "Space", "KeyX"]) {
      await page.keyboard.press(char)
      samples.push(await probe.evaluate((sample) => sample()))
    }
    expect(samples.map(detectKeystrokeWork)).toEqual(samples.map(() => []))
  } finally {
    await page.context().close()
  }
})
