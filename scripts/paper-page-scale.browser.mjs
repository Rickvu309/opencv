import assert from "node:assert/strict"
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join } from "node:path"
import { chromium } from "playwright-core"
import { signInFresh } from "./ui/fresh-account.mjs"
import { execFileSync, spawn } from "node:child_process"
import { appendFileSync } from "node:fs"
import { stackEnv } from "./ui/stack.mjs"

const out = process.argv[2] ?? join(homedir(), "tmp/paper-page-scale")
mkdirSync(out, { recursive: true })
const state = JSON.parse(
  readFileSync(
    join(homedir(), "tmp/ocv-ui", basename(process.cwd()), "state.json"),
    "utf8"
  )
)
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-experimental-web-platform-features"],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
})
const results = []
try {
  const email = await signInFresh(context, state, "paper-page-scale")
  for (const pid of [state.pool?.pid, state.pids[0]].filter(Boolean))
    process.kill(-pid, "SIGTERM")
  const fixture = join(out, "fixture.json")
  execFileSync(
    "pnpm",
    [
      "--dir",
      "apps/api",
      "exec",
      "tsx",
      "--conditions=opencv-source",
      "src/test/page-scale.fixture.ts",
      join(state.dir, "pglite"),
      email,
      fixture,
    ],
    { stdio: "pipe" }
  )
  const env = stackEnv({
    base: process.env,
    ports: state,
    dir: state.dir,
    name: state.name,
  }).api
  const api = spawn(
    "pnpm",
    [
      "--dir",
      "apps/api",
      "exec",
      "tsx",
      "--conditions=opencv-source",
      "src/index.ts",
    ],
    { env, detached: true, stdio: ["ignore", "pipe", "pipe"] }
  )
  state.pids[0] = api.pid
  delete state.pool
  writeFileSync(join(state.dir, "state.json"), JSON.stringify(state))
  await new Promise((resolve, reject) => {
    api.once("exit", (code) => reject(new Error(`API exited ${code}`)))
    api.stdout.on("data", (chunk) => {
      appendFileSync(state.logs.api, chunk)
      if (String(chunk).includes("api listening")) resolve()
    })
    api.stderr.on("data", (chunk) => appendFileSync(state.logs.api, chunk))
  })
  api.stdout.unref()
  api.stderr.unref()
  api.unref()
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  await page.goto(
    `${state.webOrigin}/paper/${JSON.parse(readFileSync(fixture, "utf8")).id}`
  )
  const editor = page.locator('.paper-rich-sheet[contenteditable="true"]')
  await editor.waitFor()
  const measure = () =>
    page.evaluate(() => {
      const sheet = document.querySelector(".paper-rich-sheet")
      const pane = document.querySelector("[data-paper-document-pane]")
      const css = getComputedStyle(sheet)
      const scale = Number(css.getPropertyValue("--cv-rich-page-scale"))
      const width = parseFloat(css.getPropertyValue("--cv-rich-page-width"))
      const height = parseFloat(css.getPropertyValue("--cv-rich-page-height"))
      const rect = sheet.getBoundingClientRect()
      const lines = []
      const walker = document.createTreeWalker(
        sheet.querySelector(":scope > .bn-block-group"),
        NodeFilter.SHOW_TEXT
      )
      let node
      while ((node = walker.nextNode())) {
        for (let index = 0; index < node.length; index++) {
          const range = document.createRange()
          range.setStart(node, index)
          range.setEnd(node, index + 1)
          const box = range.getBoundingClientRect()
          if (!box.width || !box.height) continue
          const y = (box.top - rect.top) / scale
          const x = (box.left - rect.left) / scale
          let line = lines.find(
            (value) =>
              Math.abs(value.y - y) < 1 && Math.abs(value.x - x) < width
          )
          if (!line) {
            line = { y, x, text: "" }
            lines.push(line)
          }
          line.text += node.textContent[index]
        }
      }
      return {
        scale,
        width,
        height,
        renderedWidth: rect.width,
        renderedHeight: rect.height,
        pages: Math.round((rect.height / scale + 24) / (height + 24)),
        margin: parseFloat(css.paddingLeft),
        lines,
        horizontalOverflow: pane.scrollWidth - pane.clientWidth,
        viewportOverflow: document.documentElement.scrollWidth - innerWidth,
        cropped:
          rect.left < pane.getBoundingClientRect().left - 1 ||
          rect.right > pane.getBoundingClientRect().right + 1,
        pagination: sheet.dataset.paperPagination,
        viewportMeta: document.querySelector('meta[name="viewport"]')?.content,
      }
    })
  for (const size of ["Letter", "A4"]) {
    await page
      .getByRole("button", { name: "Document menu", exact: true })
      .click()
    await page
      .getByRole("menuitem", { name: "Page setup", exact: true })
      .click()
    await page
      .getByRole("combobox", { name: "Paper size", exact: true })
      .click()
    await page.getByRole("option", { name: size, exact: true }).click()
    await page.getByRole("button", { name: "Apply", exact: true }).click()
    let reference
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.evaluate(async () => {
        await document.fonts.ready
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
      })
      await editor.waitFor()
      await page.waitForFunction(() => {
        const sheet = document.querySelector(".paper-rich-sheet")
        const pane = document.querySelector("[data-paper-document-pane]")
        if (!sheet || !pane) return false
        const css = getComputedStyle(pane)
        const available =
          pane.clientWidth -
          parseFloat(css.paddingLeft) -
          parseFloat(css.paddingRight)
        const width = parseFloat(
          sheet.style.getPropertyValue("--cv-rich-page-width")
        )
        return (
          Math.abs(
            Number(sheet.style.getPropertyValue("--cv-rich-page-scale")) -
              Math.min(1, available / width)
          ) < 0.0001
        )
      })
      const value = await measure()
      writeFileSync(
        join(out, "current.json"),
        JSON.stringify({ size, viewport: width, ...value })
      )
      assert.equal(value.pagination, "true")
      assert.ok(value.pages > 1)
      assert.ok(Math.abs(value.renderedWidth - value.width * value.scale) < 1)
      assert.ok(
        Math.abs(
          value.renderedHeight -
            (value.pages * (value.height + 24) - 24) * value.scale
        ) < 1
      )
      assert.ok(
        Math.abs(
          value.renderedWidth / (value.height * value.scale) -
            value.width / value.height
        ) < 0.001
      )
      assert.equal(value.margin, 96)
      assert.ok(
        value.lines.every(
          (line) =>
            line.x >= value.margin - 1 && line.x < value.width - value.margin
        )
      )
      assert.ok(
        value.horizontalOverflow <= 1 &&
          value.viewportOverflow <= 1 &&
          !value.cropped
      )
      assert.doesNotMatch(
        value.viewportMeta,
        /user-scalable=no|maximum-scale=1(?:[,\s]|$)/
      )
      if (reference) {
        assert.deepEqual(
          value.lines.map((line) => line.text),
          reference.lines.map((line) => line.text)
        )
        assert.deepEqual(
          value.lines.map((line) => Math.floor(line.y / (value.height + 24))),
          reference.lines.map((line) =>
            Math.floor(line.y / (value.height + 24))
          )
        )
        assert.equal(value.pages, reference.pages)
      } else reference = value
      const screenshot = join(out, `${size.toLowerCase()}-${width}.png`)
      await page.evaluate(() => {
        document.querySelector("[data-paper-document-pane]").scrollTop = 0
      })
      await page.screenshot({ path: screenshot })
      results.push({ size, viewport: width, ...value, screenshot })
    }
  }
  await page.setViewportSize({ width: 390, height: 1000 })
  const first = editor.getByText("Summary", { exact: true }).first()
  await first.click({ clickCount: 3 })
  assert.match(await page.evaluate(() => getSelection()?.toString()), /Summary/)
  await first.click()
  const caret = await page.evaluate(() => {
    const selection = getSelection()
    return {
      text: selection.anchorNode.textContent,
      offset: selection.anchorOffset,
    }
  })
  assert.equal(caret.text, "Summary")
  const expected =
    caret.text.slice(0, caret.offset) + "HIT" + caret.text.slice(caret.offset)
  await page.keyboard.type("HIT")
  await page.waitForFunction(
    (expected) =>
      document
        .querySelector(".paper-rich-sheet")
        ?.textContent.includes(expected),
    expected
  )
  await page.keyboard.press("Control+z")
  await page.keyboard.press("Control+f")
  await page
    .getByRole("textbox", { name: "Find in document", exact: true })
    .fill("Experience 12")
  await page.getByRole("button", { name: "Next match", exact: true }).click()
  await page.getByRole("button", { name: "Close find", exact: true }).click()
  await page.screenshot({ path: join(out, "find-390.png") })
  await first.click()
  const action = async (name) => {
    const button = page.getByRole("button", { name, exact: true })
    if (!(await button.isVisible()))
      await page
        .getByRole("button", { name: "More formatting", exact: true })
        .click()
    await button.click()
  }
  await action("Insert table")
  await page
    .getByRole("button", { name: "Insert table", exact: true })
    .last()
    .click()
  const table = editor.locator('[data-paper-layout="paperTable"]').last()
  await table.locator('[data-paper-layout="paperCell"]').first().click()
  await page.getByRole("button", { name: "Table options", exact: true }).click()
  await page
    .getByRole("button", { name: "Insert row below", exact: true })
    .click()
  assert.equal(await table.locator('[data-paper-layout="paperRow"]').count(), 3)
  await page.screenshot({ path: join(out, "table-390.png") })
  await first.click()
  const portrait = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 120
    canvas.height = 160
    const draw = canvas.getContext("2d")
    draw.fillStyle = "#e2e8f0"
    draw.fillRect(0, 0, 120, 160)
    draw.fillStyle = "#475569"
    draw.beginPath()
    draw.arc(60, 48, 24, 0, Math.PI * 2)
    draw.fill()
    draw.fillRect(24, 90, 72, 70)
    return canvas.toDataURL("image/png").split(",")[1]
  })
  await page.getByLabel("Photo file", { exact: true }).setInputFiles({
    name: "illustrated-portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from(portrait, "base64"),
  })
  await page.getByRole("textbox", { name: "Width", exact: true }).fill("120")
  await page.getByRole("button", { name: "Apply", exact: true }).click()
  const photo = editor.locator("[data-paper-photo]").last()
  await photo.click()
  assert.equal(await photo.getAttribute("aria-pressed"), "true")
  const photoSize = await photo.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    scale: Number(
      element
        .closest(".paper-rich-sheet")
        .style.getPropertyValue("--cv-rich-page-scale")
    ),
  }))
  assert.ok(Math.abs(photoSize.width / photoSize.scale - 120) < 1)
  await page.screenshot({ path: join(out, "photo-390.png") })
  writeFileSync(
    join(out, "result.json"),
    JSON.stringify(
      {
        status: "pass",
        results,
        interactions: [
          "scaled pointer selection",
          "typing at selected caret",
          "Undo",
          "Find",
          "table menu adds row",
          "photo resize and pointer selection",
        ],
      },
      null,
      2
    )
  )
  console.log(
    JSON.stringify({
      status: "pass",
      sizes: 2,
      widths: 5,
      pages: results.map((value) => [value.size, value.viewport, value.pages]),
      result: join(out, "result.json"),
    })
  )
} catch (error) {
  writeFileSync(
    join(out, "failure.json"),
    JSON.stringify(
      { message: error.message, stack: error.stack, results },
      null,
      2
    )
  )
  await context.pages()[0]?.screenshot({ path: join(out, "failure.png") })
  throw error
} finally {
  await browser.close()
}
