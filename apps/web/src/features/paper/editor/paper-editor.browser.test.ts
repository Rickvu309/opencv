import { readFileSync } from "node:fs"
import path from "node:path"
import { chromium, type Browser, type Page } from "playwright-core"
import { build, type Rollup } from "vite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { domainEntryAliases } from "../../../../domain-entries"

const webRoot = path.resolve(__dirname, "../../../..")
const ORIGIN = "http://paper-editor.test"
const HARNESS = "\0paper-editor-harness"
const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

type Facts = { kind: string; list: string | null; level: number; text: string }

let browser: Browser
let html = ""

async function bundle(): Promise<string> {
  const editor = path.join(__dirname, "paper-editor.ts")
  const documents = path.join(__dirname, "lab-documents.ts")
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

const blocks = (page: Page) =>
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

const texts = async (page: Page) => (await blocks(page)).map((b) => b.text)

const paintedPages = (page: Page) =>
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

async function typeLines(page: Page, lines: string[]) {
  for (const [n, line] of lines.entries()) {
    if (n > 0) await page.keyboard.press("Enter")
    await page.keyboard.type(line)
  }
}

async function compose(page: Page, steps: string[]) {
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

beforeAll(async () => {
  html = await bundle()
  browser = await launch()
}, 120_000)

afterAll(async () => {
  await browser?.close()
})

describe("the new Paper page in a real browser", () => {
  it("keeps every line after select all, End and typing", async () => {
    const page = await open("blank")
    await typeLines(page, ["Alpha", "Beta"])
    await page.keyboard.press("Control+a")
    await page.keyboard.press("End")
    await page.keyboard.press("Enter")
    await page.keyboard.type("Gamma")
    expect(await texts(page)).toEqual(["Alpha", "Beta", "Gamma"])
    expect((await paintedPages(page))[0]).toEqual(["Alpha", "Beta", "Gamma"])
    await page.context().close()
  })

  it("adds the key after the last line after select all and ArrowRight", async () => {
    const page = await open("blank")
    await typeLines(page, ["Alpha", "Beta"])
    await page.keyboard.press("Control+a")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.type("Z")
    expect(await texts(page)).toEqual(["Alpha", "BetaZ"])
    await page.context().close()
  })

  it("continues, nests and ends a bullet list with Enter and Tab", async () => {
    const page = await open("blank")
    await page.keyboard.press("Control+Shift+8")
    await typeLines(page, ["One", "Two"])
    await page.keyboard.press("Enter")
    await page.keyboard.press("Tab")
    await page.keyboard.type("Nested")
    await page.keyboard.press("Enter")
    await page.keyboard.press("Enter")
    await page.keyboard.type("After")
    const facts = await blocks(page)
    expect(facts.map((b) => [b.text, b.list, b.level])).toEqual([
      ["One", "bullet", 0],
      ["Two", "bullet", 0],
      ["Nested", "bullet", 1],
      ["After", null, 0],
    ])
    const markers = await page
      .locator(".paper-line [data-marker]")
      .allTextContents()
    expect(markers).toHaveLength(3)
    await page.context().close()
  })

  it("types Vietnamese with a Telex composition and keeps it on the page", async () => {
    const page = await open("blank")
    const first = await compose(page, [
      "T",
      "Ti",
      "Tie",
      "Tiê",
      "Tiên",
      "Tiêng",
      "Tiếng",
    ])
    await page.keyboard.type(" ")
    await compose(page, ["V", "Vi", "Vie", "Viê", "Viêt", "Việt"])
    expect(first).toBeGreaterThan(0)
    expect(await texts(page)).toEqual(["Tiếng Việt"])
    expect((await paintedPages(page))[0]).toEqual(["Tiếng Việt"])
    expect(await page.locator(".paper-composition").count()).toBe(0)
    await page.keyboard.press("Control+z")
    expect(["", "Tiếng", "Tiếng "]).toContain((await texts(page))[0])
    await page.context().close()
  })

  it("takes a one-shot composition that arrives after compositionend once", async () => {
    const page = await open("blank")
    await page.keyboard.type("Tie")
    await page.evaluate(() => {
      const input = document.querySelector<HTMLTextAreaElement>(".paper-input")!
      input.dispatchEvent(
        new CompositionEvent("compositionstart", { data: "" })
      )
      input.value = "Tiê"
      input.setSelectionRange(3, 3)
      input.dispatchEvent(new CompositionEvent("compositionend", { data: "ê" }))
      input.dispatchEvent(
        new InputEvent("input", {
          inputType: "insertCompositionText",
          data: "ê",
        })
      )
    })
    await page.keyboard.type("ng")
    expect(await texts(page)).toEqual(["Tiêng"])
    await page.context().close()
  })

  it("undoes a paste on its own and keeps the typing before it", async () => {
    const page = await open("blank")
    await page.keyboard.type("Draft")
    await page.evaluate(() => {
      const data = new DataTransfer()
      data.setData("text/plain", "One\nTwo")
      document
        .querySelector(".paper-input")!
        .dispatchEvent(new ClipboardEvent("paste", { clipboardData: data }))
    })
    expect(await texts(page)).toEqual(["Draft", "One", "Two"])
    await page.keyboard.press("Control+z")
    expect(await texts(page)).toEqual(["Draft"])
    await page.context().close()
  })

  it("loses no key while typing pushes lines onto a new page", async () => {
    const page = await open("en-10")
    const before = await blocks(page)
    const pagesBefore = (await paintedPages(page)).length
    await page.keyboard.press("Control+End")
    for (let n = 0; n < 45; n += 1) await page.keyboard.press("Enter")
    await page.keyboard.type("Last words")
    const after = await blocks(page)
    expect(after).toHaveLength(before.length + 45)
    expect(after.at(-1)!.text).toBe("Last words")
    expect((await paintedPages(page)).length).toBeGreaterThan(pagesBefore)
    expect(
      await page.evaluate(() =>
        document.activeElement?.classList.contains("paper-input")
      )
    ).toBe(true)
    await page.context().close()
  })

  it("selects by click, double click and a drag across two pages", async () => {
    const page = await open("en-10")
    const firstLine = page
      .locator('.paper-editor-page[data-page="0"] .paper-line')
      .first()
    const box = (await firstLine.boundingBox())!
    await page.mouse.dblclick(box.x + 10, box.y + box.height / 2)
    const word = await page.evaluate(() => window.paperLab!.read().selection)
    expect(word.kind).toBe("text")
    const lastOnSecond = page
      .locator('.paper-editor-page[data-page="1"] .paper-line')
      .last()
    const end = (await lastOnSecond.boundingBox())!
    await page.mouse.move(box.x + 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(end.x + 20, end.y + end.height / 2, { steps: 8 })
    await page.mouse.up()
    const dragged = await page.evaluate(() => window.paperLab!.read().selection)
    expect(dragged.kind).toBe("text")
    if (dragged.kind === "text")
      expect(dragged.anchor.block).not.toBe(dragged.head.block)
    expect(await page.locator(".paper-selection").count()).toBeGreaterThan(10)
    await page.context().close()
  })

  it("shows the same page on a phone, only smaller", async () => {
    const desk = await open("en-10")
    const deskPages = await paintedPages(desk)
    const deskWidth = (await desk
      .locator(".paper-editor-page")
      .first()
      .boundingBox())!.width
    await desk.context().close()
    const phone = await open("en-10", PHONE, true)
    const phonePages = await paintedPages(phone)
    const phoneWidth = (await phone
      .locator(".paper-editor-page")
      .first()
      .boundingBox())!.width
    const scale = await phone.evaluate(() => window.paperLab!.scale())
    await phone.locator(".paper-editor-page").first().tap()
    await phone.keyboard.type("Phone words")
    expect(
      await phone.evaluate(() =>
        document.activeElement?.classList.contains("paper-input")
      )
    ).toBe(true)
    expect((await texts(phone)).join(" ")).toContain("Phone words")
    expect(phonePages).toEqual(deskPages)
    expect(phoneWidth / deskWidth).toBeCloseTo(scale, 2)
    expect(phoneWidth).toBeLessThanOrEqual(PHONE.width - 32 + 1)
    await phone.context().close()
  })
})

async function pasteClipboard(page: Page, html: string, text = "") {
  await page.locator(".paper-input").evaluate(
    (target, clipboard) => {
      const data = new DataTransfer()
      data.setData("text/html", clipboard.html)
      data.setData("text/plain", clipboard.text)
      target.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data }))
    },
    { html, text }
  )
}

describe("Paper editing tools", () => {
  it("copies and cuts both formats and pastes plain text with Ctrl+Shift+V", async () => {
    const page = await open("blank")
    try {
      await pasteClipboard(
        page,
        '<h1>Draft</h1><p><strong>First</strong> <a href="https://example.com">link</a></p>'
      )
      const selection = page.locator(".paper-input")
      await page.keyboard.press("Control+a")
      for (const type of ["copy", "cut"]) {
        const result = await selection.evaluate((target, type) => {
          const data = new DataTransfer()
          target.dispatchEvent(
            new ClipboardEvent(type, { clipboardData: data })
          )
          return {
            html: data.getData("text/html"),
            text: data.getData("text/plain"),
          }
        }, type)
        expect(result.text).toBe("Draft\nFirst link")
        expect(result.html).toContain("<h1>Draft</h1>")
        expect(result.html).toContain('<a href="https://example.com">link</a>')
      }
      expect(await texts(page)).toEqual([""])
      await page.keyboard.down("Control")
      await page.keyboard.down("Shift")
      await page.keyboard.down("v")
      await pasteClipboard(page, "<h1>Discarded</h1>", "One\nTwo")
      await page.keyboard.up("v")
      await page.keyboard.up("Shift")
      await page.keyboard.up("Control")
      expect(
        (await blocks(page)).map(({ kind, text }) => [kind, text])
      ).toEqual([
        ["paragraph", "One"],
        ["paragraph", "Two"],
      ])
    } finally {
      await page.context().close()
    }
  })

  it("finds literal matches and replaces all in one undo step", async () => {
    const page = await open("blank")
    try {
      await typeLines(page, ["X. x. xxx", "x."])
      await page.keyboard.press("Control+f")
      const find = page.getByRole("textbox", { name: "Find", exact: true })
      await find.fill("x.")
      expect(await page.locator(".paper-find-hit").count()).toBe(3)
      await page.keyboard.press("Control+h")
      await page.getByRole("textbox", { name: "Replace with" }).fill("$1")
      await page.getByRole("button", { name: "Replace all" }).click()
      expect(await texts(page)).toEqual(["$1 $1 xxx", "$1"])
      expect(await page.locator(".paper-find-hit").count()).toBe(0)
      await page.keyboard.press("Escape")
      await page.keyboard.press("Control+z")
      expect(await texts(page)).toEqual(["X. x. xxx", "x."])
    } finally {
      await page.context().close()
    }
  })

  it("opens the link bubble, edits the whole link and removes it", async () => {
    const page = await open("blank")
    try {
      await page.keyboard.type("Portfolio")
      await page.keyboard.press("Control+k")
      const url = page.getByRole("textbox", { name: "Link URL" })
      await url.fill("https://example.com")
      await page.getByRole("button", { name: "Apply" }).click()
      await page.keyboard.press("ArrowLeft")
      const link = page.getByRole("link", { name: "Open link" })
      expect(await link.getAttribute("href")).toBe("https://example.com")
      expect(
        await page
          .locator(".paper-run[data-href]")
          .evaluate((run) => getComputedStyle(run).textDecorationLine)
      ).toBe("underline")
      await page.getByRole("button", { name: "Edit link" }).click()
      await url.fill("https://example.org")
      await page.getByRole("button", { name: "Apply" }).click()
      expect(
        await page.getByRole("link", { name: "Open link" }).getAttribute("href")
      ).toBe("https://example.org")
      await page.getByRole("button", { name: "Remove link" }).click()
      expect(await page.locator(".paper-run[data-href]").count()).toBe(0)
      expect(await texts(page)).toEqual(["Portfolio"])
    } finally {
      await page.context().close()
    }
  })

  it("resizes a photo corner with aspect lock and edits a pasted table", async () => {
    const photo = await open("photo")
    try {
      await photo.locator(".paper-image").click()
      const corner = await photo
        .getByRole("button", { name: "Resize photo bottom right" })
        .boundingBox()
      if (!corner) throw new Error("The photo has no resize handle")
      const x = corner.x + corner.width / 2
      const y = corner.y + corner.height / 2
      const dimensions = () =>
        photo.evaluate(() => {
          const block = window
            .paperLab!.read()
            .doc.content.find((block) => block.type === "image")
          return block ? [block.attrs.widthMpt, block.attrs.heightMpt] : []
        })
      const before = await dimensions()
      await photo.mouse.move(x, y)
      await photo.mouse.down()
      await photo.mouse.move(x + 50, y + 30)
      await photo.mouse.up()
      const after = await dimensions()
      expect(after[0]).toBeGreaterThan(before[0]!)
      expect(after[0]! / after[1]!).toBeCloseTo(before[0]! / before[1]!, 4)
      await photo.keyboard.press("Control+z")
      expect(await dimensions()).toEqual(before)
    } finally {
      await photo.context().close()
    }

    const table = await open("blank")
    try {
      await pasteClipboard(
        table,
        "<table><tr><th>Role</th><th>Year</th></tr><tr><td>Lead</td><td>2026</td></tr></table>"
      )
      await table
        .locator(".paper-line")
        .filter({ hasText: "Lead" })
        .click({ force: true })
      await table.getByRole("button", { name: "Add row" }).click()
      expect(await table.locator(".paper-cell").count()).toBe(6)
      await table.getByRole("button", { name: "Add column" }).click()
      expect(await table.locator(".paper-cell").count()).toBe(9)
      await table.getByRole("button", { name: "Delete row" }).click()
      expect(await table.locator(".paper-cell").count()).toBe(6)
      await table.getByRole("button", { name: "Delete column" }).click()
      expect(await table.locator(".paper-cell").count()).toBe(4)
      await table.getByRole("button", { name: "Delete table" }).click()
      expect(await table.locator(".paper-cell").count()).toBe(0)
    } finally {
      await table.context().close()
    }
  })
})
