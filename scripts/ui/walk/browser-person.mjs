import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { LOOP_FILES } from "../sweep/loop.mjs"
import {
  KEYSTROKE_PROBE,
  cvText,
  keystrokeStats,
  lineStart,
} from "./keystrokes.mjs"
import { wordBytesFacts } from "./word-file.mjs"

const FIXTURES = new URL("../fixtures/", import.meta.url)
const PAGE = '[contenteditable="true"]'
const PARAGRAPH = `${PAGE} .bn-block-content[data-content-type="paragraph"]`
const SAVED = 'p.writing-note[title="Saved"], p.writing-note:text-is("Saved")'
const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const STEP_MS = 20_000
const PAGE_MS = 30_000
const SETTLE_MS = 120
const PASTE_SETTLE_MS = 700
const OPEN_SETTLE_MS = 800
const PERF_KEYS = 40
const PERF_TEXT = { lines: 42, wordsPerLine: 20 }
const PERF_TARGET = lineStart(PERF_TEXT.lines / 2)
const CHROME =
  'nav, header, aside, [role="toolbar"], [role="menubar"], [role="navigation"], [data-slot="sidebar"]'

export function blocksInPage(editorSelector) {
  const editor = document.querySelector(editorSelector)
  if (!editor) return []
  return [...editor.querySelectorAll(".bn-block-content")]
    .filter((block) => {
      const type = block.getAttribute("data-content-type")
      return (
        block.getBoundingClientRect().height > 0 &&
        getComputedStyle(block).display !== "none" &&
        type !== "paperCvHeader" &&
        !(type === "paperCvField" && !block.textContent.trim())
      )
    })
    .map((block) => {
      let depth = 0
      for (
        let node = block.parentElement;
        node && node !== editor;
        node = node.parentElement
      )
        if (node.classList.contains("bn-block-group")) depth += 1
      const weights = []
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
      while (walker.nextNode())
        if (walker.currentNode.textContent.trim())
          weights.push(
            Number(
              getComputedStyle(walker.currentNode.parentElement).fontWeight
            )
          )
      return {
        type: block.getAttribute("data-content-type"),
        level: Number(block.getAttribute("data-level")) || null,
        depth,
        text: block.innerText.replaceAll("​", "").trim(),
        bold: weights.length > 0 && weights.every((weight) => weight >= 600),
        links: [...block.querySelectorAll("a[href]")].map((link) =>
          link.getAttribute("href")
        ),
      }
    })
}

function chromeInPrint(selector) {
  const editor = document.querySelector('[contenteditable="true"]')
  return [...document.querySelectorAll(selector)]
    .filter((element) => {
      if (editor && (editor.contains(element) || element.contains(editor)))
        return false
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return (
        box.width > 0 &&
        box.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      )
    })
    .map(
      (element) =>
        element.getAttribute("aria-label") ??
        element.getAttribute("role") ??
        element.tagName.toLowerCase()
    )
}

function caretInPage(editorSelector) {
  const editor = document.querySelector(editorSelector)
  const selection = document.getSelection()
  return Boolean(
    editor &&
    selection?.anchorNode &&
    editor.contains(selection.anchorNode) &&
    editor.contains(document.activeElement)
  )
}

function textRect(word) {
  const walker = document.createTreeWalker(
    document.querySelector('[contenteditable="true"]'),
    NodeFilter.SHOW_TEXT
  )
  while (walker.nextNode()) {
    const at = walker.currentNode.textContent.indexOf(word)
    if (at < 0) continue
    const range = document.createRange()
    range.setStart(walker.currentNode, at)
    range.setEnd(walker.currentNode, at + word.length)
    range.startContainer.parentElement.scrollIntoView({ block: "center" })
    const box = range.getBoundingClientRect()
    return { x: box.right - 1, y: box.top + box.height / 2 }
  }
  return null
}

const twoFrames = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  )

function tab(page) {
  const settle = async (ms = SETTLE_MS) => {
    await page.evaluate(twoFrames)
    await page.waitForTimeout(ms)
  }
  return {
    page,
    type: async (text) => {
      await page.keyboard.type(text)
      await settle()
    },
    press: async (key) => {
      await page.keyboard.press(key)
      await settle()
    },
    chord: async (keys) => {
      for (const key of keys) await page.keyboard.press(key)
      await settle()
    },
    paste: async ({ html, text }) => {
      await page.evaluate(
        async ([richText, plainText]) => {
          const items = {
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }
          if (richText)
            items["text/html"] = new Blob([richText], { type: "text/html" })
          await navigator.clipboard.write([new ClipboardItem(items)])
        },
        [html ?? null, text]
      )
      await page.keyboard.press("Control+v")
      await settle(PASTE_SETTLE_MS)
    },
    pause: (ms) => page.waitForTimeout(ms),
    blocks: () => page.evaluate(blocksInPage, PAGE),
    tapPage: async () => {
      await page
        .locator(PARAGRAPH)
        .filter({ visible: true })
        .last()
        .tap({ timeout: STEP_MS })
      await settle()
    },
    caretInPage: () => page.evaluate(caretInPage, PAGE),
    waitForText: (text, ms) =>
      page
        .waitForFunction(
          ([selector, wanted]) =>
            document.querySelector(selector)?.innerText.includes(wanted),
          [PAGE, text],
          { timeout: ms }
        )
        .catch(() => null),
    typeAtEnd: async (text) => {
      await page
        .locator(PARAGRAPH)
        .filter({ visible: true })
        .last()
        .click({ timeout: STEP_MS })
      await page.keyboard.press("Control+End")
      await page.keyboard.type(text)
      await settle()
    },
    waitForEditor: async () => {
      await page.locator(PAGE).first().waitFor({ timeout: PAGE_MS })
      await page.waitForTimeout(OPEN_SETTLE_MS)
    },
  }
}

export function browserPerson({ browser, state, account, shotsDir }) {
  let context = null
  let current = null
  const newContext = async (options = {}) => {
    const made = await browser.newContext({
      viewport: DESK,
      acceptDownloads: true,
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
      ...options,
    })
    await made.addCookies(account.cookies)
    return made
  }
  const page = () => current.page
  const openFile = async () => {
    await page()
      .getByRole("button", { name: "File", exact: true })
      .first()
      .click({ timeout: STEP_MS })
    await page().waitForTimeout(300)
  }
  const downloaded = async (item) => {
    const [download] = await Promise.all([
      page().waitForEvent("download", { timeout: STEP_MS }),
      item.click({ timeout: STEP_MS }),
    ])
    return readFileSync(await download.path())
  }
  const person = {
    currentPage: () => page(),
    begin: async () => {
      context = await newContext()
      current = tab(await context.newPage())
    },
    end: async (row) => {
      await page()
        ?.screenshot({ path: join(shotsDir, `${row.id}.png`) })
        .catch(() => {})
      await context?.close()
      context = null
      current = null
    },
    openBlankCv: async () => {
      await page().goto(`${state.webOrigin}${state.route ?? "/paper"}`, {
        waitUntil: "domcontentloaded",
      })
      await page()
        .getByRole("button", { name: "New", exact: true })
        .click({ timeout: PAGE_MS })
      await page()
        .getByRole("button", { name: "CV", exact: true })
        .click({ timeout: STEP_MS })
      await page()
        .getByRole("dialog", { name: "New CV" })
        .waitFor({ timeout: STEP_MS })
      await page()
        .getByRole("radio", { name: "Blank" })
        .click({ timeout: STEP_MS })
      await page()
        .getByRole("button", { name: "Start blank" })
        .click({ timeout: STEP_MS })
      await current.waitForEditor()
      await page()
        .locator(PARAGRAPH)
        .filter({ visible: true })
        .last()
        .click({ timeout: STEP_MS })
    },
    openImportedCv: async (file) => {
      await page().goto(`${state.webOrigin}${state.route ?? "/paper"}`, {
        waitUntil: "domcontentloaded",
      })
      await page()
        .locator('input[type="file"]')
        .first()
        .setInputFiles(fileURLToPath(new URL(file, FIXTURES)), {
          timeout: STEP_MS,
        })
      await page().waitForFunction(
        ([selector, wanted]) =>
          document.querySelector(selector)?.innerText.includes(wanted),
        [PAGE, LOOP_FILES[file].heading],
        { timeout: PAGE_MS }
      )
      await page().waitForTimeout(OPEN_SETTLE_MS)
    },
    type: (text) => current.type(text),
    press: (key) => current.press(key),
    chord: (keys) => current.chord(keys),
    paste: (clip) => current.paste(clip),
    pause: (ms) => current.pause(ms),
    blocks: () => current.blocks(),
    waitSaved: async () => {
      await page().waitForTimeout(OPEN_SETTLE_MS)
      await page()
        .locator(SAVED)
        .first()
        .waitFor({ state: "visible", timeout: STEP_MS })
    },
    reload: async () => {
      await page().reload({ waitUntil: "domcontentloaded" })
      await current.waitForEditor()
    },
    downloadWord: async () => {
      await person.waitSaved()
      await openFile()
      const item = page()
        .getByRole("menuitem", { name: "Download Word", exact: true })
        .first()
      return wordBytesFacts(await downloaded(item))
    },
    downloadPdf: async () => {
      await openFile()
      const item = page()
        .getByRole("menuitem", { name: /pdf/i })
        .filter({ visible: true })
      if ((await item.count()) === 0) {
        await page().keyboard.press("Escape")
        return { offered: false, isPdf: false }
      }
      const bytes = await downloaded(item.first())
      return {
        offered: true,
        isPdf: bytes.subarray(0, 5).toString("latin1") === "%PDF-",
      }
    },
    printView: async () => {
      await page().emulateMedia({ media: "print" })
      const chrome = await page().evaluate(chromeInPrint, CHROME)
      await page().emulateMedia({ media: "screen" })
      return { chrome }
    },
    onPhone: async (work) => {
      const phoneContext = await newContext({
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      })
      try {
        const phone = tab(await phoneContext.newPage())
        await phone.page.goto(page().url(), { waitUntil: "domcontentloaded" })
        await phone.waitForEditor()
        return await work(phone)
      } finally {
        await phoneContext.close()
      }
    },
    inTwoTabs: async (work) => {
      const second = tab(await context.newPage())
      try {
        await second.page.goto(page().url(), { waitUntil: "domcontentloaded" })
        await second.waitForEditor()
        await page().bringToFront()
        return await work(current, second)
      } finally {
        await second.page.close()
      }
    },
  }
  return person
}

export async function keystrokeTiming({
  browser,
  state,
  account,
  build,
  shotsDir,
}) {
  const person = browserPerson({ browser, state, account, shotsDir })
  await person.begin()
  try {
    const page = person.currentPage()
    await page.addInitScript(KEYSTROKE_PROBE)
    await person.openBlankCv()
    await person.paste({ text: cvText(PERF_TEXT) })
    await page.waitForTimeout(1500)
    const target = await page.evaluate(textRect, PERF_TARGET)
    if (!target) throw new Error(`the pasted CV has no ${PERF_TARGET}`)
    await page.mouse.click(target.x, target.y)
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      window.__walkKeys = []
      if (window.__walkEventTimings) window.__walkEventTimings = []
    })
    for (let key = 0; key < PERF_KEYS; key += 1) {
      await page.keyboard.press(key % 8 === 7 ? "Space" : "KeyX")
      await page.waitForFunction(
        (count) => window.__walkKeys.length >= count,
        key + 1,
        { timeout: STEP_MS }
      )
    }
    const { samples, events, height, width } = await page.evaluate(() => {
      const editor = document
        .querySelector('[contenteditable="true"]')
        .getBoundingClientRect()
      return {
        samples: window.__walkKeys,
        events: window.__walkEventTimings,
        height: editor.height,
        width: editor.width,
      }
    })
    return {
      build,
      words: PERF_TEXT.lines * PERF_TEXT.wordsPerLine,
      pagesApprox: Math.round((height / width) * (8.5 / 11) * 10) / 10,
      editorHeightPx: Math.round(height),
      editorWidthPx: Math.round(width),
      keydownToNextFrame: keystrokeStats(samples),
      eventTimingKeydown: events
        ? { over16ms: events.length, ...keystrokeStats(events) }
        : null,
    }
  } finally {
    await person.end({ id: "keystrokes" })
  }
}
