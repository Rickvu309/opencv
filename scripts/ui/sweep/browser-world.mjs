import { mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { runStep, settle } from "../capture.mjs"
import { contextOptions } from "../fresh-account.mjs"
import { TYPED_LINE } from "./loop.mjs"
import { HOME_SIZE } from "./runner.mjs"
import { requestRecorder } from "./requests.mjs"
import {
  contrastInPage,
  motionInPage,
  ringBaseInPage,
  ringOfFocusedInPage,
  scaleTextInPage,
  textClipsInPage,
} from "./hig-probes.mjs"
import {
  markOpeners,
  measureInPage,
  openLayer,
  twoFrames,
} from "./page-probes.mjs"

const FIXTURES = new URL("../fixtures/", import.meta.url)
const PAGE = ".paper-editor"
const SAVED = 'p.writing-note[title="Saved"], p.writing-note:text-is("Saved")'
const PANEL = '[data-slot="coach-panel"]'
const COMPOSER = `${PANEL} [data-slot="coach-workspace-composer"] textarea`
const PANEL_UNDO = `${PANEL} button[aria-label="Undo"]`
const CONTROL_LIMIT = 400
const STEP_MS = 20_000
const PAGE_MS = 30_000
const COACH_MS = 45_000
const ESCAPE_SETTLE_MS = 200
const HIG_TEXT_LIMIT = 600
const HIG_CLIP_LIMIT = 3000
const HIG_TABS = 16

const safe = (name) => name.replace(/[^a-z0-9.-]+/gi, "_")
const firstLine = (error) => error.message.split("\n")[0]

const RICH_EDITOR_WRITER = {
  documentVersion: 4,
  writerProtocol: 1,
  supportedSchemaRevisions: [2],
  capabilities: [
    "rich-text-1",
    "semantic-cv-fields-1",
    "document-presentation-1",
    "tables-1",
    "photos-1",
    "flow-sections-1",
  ],
}

export function browserWorld({ browser, state, accounts, shotsDir, now }) {
  mkdirSync(shotsDir, { recursive: true })
  let shared = null
  const accountFor = async (screen) => {
    if (screen.signedIn === false) return null
    if (!screen.sharedAccount) return accounts.take(screen.id)
    shared ??= accounts.take("sweep route smokes")
    return shared
  }
  const shoot = async (page, name) => {
    const path = join(shotsDir, `${safe(name)}.png`)
    try {
      await page.screenshot({ path })
      return path
    } catch (error) {
      return `no screenshot (${firstLine(error)})`
    }
  }
  const newContext = async (account) => {
    const context = await browser.newContext({
      ...contextOptions({ width: HOME_SIZE.width }),
      viewport: HOME_SIZE,
      acceptDownloads: true,
    })
    if (account) await context.addCookies(account.cookies)
    return context
  }

  async function openScreen(screen) {
    const account = await accountFor(screen)
    const context = await newContext(account)
    const recorder = requestRecorder({ apiOrigin: state.apiOrigin, now })
    context.on("request", recorder.onRequest)
    await context.addInitScript(markOpeners)
    const page = await context.newPage()
    const errors = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text().slice(0, 240))
    })
    page.on("pageerror", (error) => errors.push(firstLine(error).slice(0, 240)))
    return {
      runSteps: async () => {
        try {
          await page.goto(`${state.webOrigin}${screen.route}`, {
            waitUntil: "domcontentloaded",
          })
        } catch (error) {
          return `opening ${screen.route} failed: ${firstLine(error)}`
        }
        for (const [at, step] of (screen.steps ?? []).entries()) {
          try {
            await runStep(
              page,
              state.webOrigin,
              step,
              undefined,
              state.apiOrigin
            )
          } catch (error) {
            return `step ${at + 1} ${JSON.stringify(step)} failed: ${firstLine(error)}`
          }
        }
        return null
      },
      settle: () => settle(page),
      idle: async (ms) => {
        recorder.setPhase("idle")
        await page.waitForTimeout(ms)
        recorder.setPhase("done")
      },
      requests: () => recorder.log,
      resize: async (viewport) => {
        await page.setViewportSize(viewport)
        await page.evaluate(twoFrames)
      },
      measure: () => page.evaluate(measureInPage, CONTROL_LIMIT),
      escapeReturnsFocus: async () => {
        const before = await page.evaluate(openLayer)
        if (!before.layer || !before.opener) return { checked: false }
        await page.keyboard.press("Escape")
        await page.evaluate(twoFrames)
        await page.waitForTimeout(ESCAPE_SETTLE_MS)
        const after = await page.evaluate(openLayer)
        if (after.count >= before.count)
          return before.modal
            ? { checked: true, problem: `Escape did not close ${before.layer}` }
            : { checked: false }
        if (after.onOpener) return { checked: true }
        return {
          checked: true,
          problem: `${before.layer} closed and focus went to ${after.focus}, not back to its opener ${before.opener}`,
        }
      },
      higSample: async ({ textScale, shotName }) => {
        const contrast = await page.evaluate(contrastInPage, HIG_TEXT_LIMIT)
        const motion = await page.evaluate(motionInPage)
        const baseShot = await shoot(page, shotName)
        await page.evaluate(textClipsInPage, {
          phase: "base",
          limit: HIG_CLIP_LIMIT,
        })
        await page.evaluate(scaleTextInPage, textScale)
        await page.evaluate(twoFrames)
        const clips = await page.evaluate(textClipsInPage, {
          phase: "scaled",
          limit: HIG_CLIP_LIMIT,
        })
        const clipShot = clips.length
          ? await shoot(page, `${shotName}-text-${textScale * 100}`)
          : null
        await page.evaluate(scaleTextInPage, 1)
        await page.evaluate(twoFrames)
        return {
          sample: { contrast, motion, clips, rings: [] },
          baseShot,
          clipShot,
        }
      },
      focusRings: async (shotName) => {
        await page.evaluate(ringBaseInPage)
        const rings = []
        const keys = new Set()
        for (let press = 0; press < HIG_TABS; press += 1) {
          await page.keyboard.press("Tab")
          const focused = await page.evaluate(ringOfFocusedInPage)
          if (!focused || keys.has(focused.key)) break
          keys.add(focused.key)
          rings.push({
            name: focused.name,
            ring: focused.ring,
            x: focused.x,
            y: focused.y,
            width: focused.width,
            height: focused.height,
          })
          if (focused.editor) break
        }
        return { rings, shot: await shoot(page, shotName) }
      },
      consoleErrors: () => errors,
      screenshot: (name) => shoot(page, name),
      close: () => context.close(),
    }
  }

  async function loopDriver(file) {
    const context = await newContext(null)
    const page = await context.newPage()
    const api = (path) =>
      context.request.get(`${state.apiOrigin}${path}`, {
        headers: { origin: state.webOrigin },
      })
    const read = (name, input) =>
      context.request.post(`${state.apiOrigin}/api/reads/${name}`, {
        headers: { origin: state.webOrigin },
        data: input,
      })
    const docIdFromUrl = () =>
      /\/paper\/([^/?#]+)/.exec(new URL(page.url()).pathname)?.[1] ?? null
    const findEntry = (data, docId) => {
      if (!data || typeof data !== "object") return null
      if (data.id === docId || data.docId === docId) return data
      for (const value of Object.values(data)) {
        const found = findEntry(value, docId)
        if (found) return found
      }
      return null
    }
    return {
      signIn: async () => {
        const account = await accounts.take(`sweep loop ${file}`)
        await context.addCookies(account.cookies)
      },
      importFile: async (name) => {
        await page.goto(`${state.webOrigin}/paper`, {
          waitUntil: "domcontentloaded",
        })
        await page
          .locator('input[type="file"]')
          .first()
          .setInputFiles(fileURLToPath(new URL(name, FIXTURES)), {
            timeout: STEP_MS,
          })
      },
      waitForPage: async (heading) => {
        try {
          const handle = await page.waitForFunction(
            ([selector, wanted]) => {
              const editor = document.querySelector(selector)
              if (editor && editor.innerText.includes(wanted)) return "page"
              const text = document.body.innerText
              if (text.includes("Document not found")) return "missing"
              return false
            },
            [PAGE, heading],
            { timeout: PAGE_MS }
          )
          if ((await handle.jsonValue()) === "page")
            return { ok: true, docId: docIdFromUrl() }
        } catch {
          return {
            ok: false,
            shows: `${(
              await page
                .locator("main")
                .first()
                .innerText({ timeout: 2_000 })
                .catch(() => "nothing")
            )
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 120)} (after ${PAGE_MS / 1000} s)`,
          }
        }
        return {
          ok: false,
          shows: (await page.locator("main").first().innerText())
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 120),
        }
      },
      openFromLibrary: async (docId) => {
        const library = await (
          await read("paper.list", { writer: RICH_EDITOR_WRITER })
        ).json()
        const entry = findEntry(library, docId)
        if (!entry) return false
        await page.goto(`${state.webOrigin}/paper`, {
          waitUntil: "domcontentloaded",
        })
        const title = entry.title ?? entry.name
        const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const card = page
          .locator("main")
          .getByRole("button", { name: new RegExp(`^Open ${escaped},`) })
          .first()
        const opened = () =>
          page.waitForURL(`**/paper/${docId}`, { timeout: 2_000 }).then(
            () => true,
            () => false
          )
        await card.click({ timeout: STEP_MS })
        if (!(await opened())) await card.click({ timeout: STEP_MS })
        return true
      },
      openByAddress: async (docId) => {
        await page.goto(`${state.webOrigin}/paper/${docId}`, {
          waitUntil: "domcontentloaded",
        })
      },
      typeLine: async (text) => {
        const editor = page.locator(PAGE).first()
        await editor.click({ timeout: STEP_MS, force: true })
        await page.keyboard.press("Control+End")
        await page.keyboard.press("Enter")
        await page.keyboard.type(text)
        await page
          .locator(SAVED)
          .waitFor({ state: "visible", timeout: STEP_MS })
      },
      storedText: async (docId) => {
        let text = ""
        for (let tries = 0; tries < 4; tries += 1) {
          text = await (await read("paper.outline", { docId })).text()
          if (text.includes(TYPED_LINE)) return text
          await page.waitForTimeout(750)
        }
        return text
      },
      askCoachForEdit: async () => {
        await page
          .locator("[data-dock-coach]")
          .first()
          .click({ timeout: STEP_MS })
        await page
          .locator(PANEL)
          .waitFor({ state: "visible", timeout: STEP_MS })
        await page
          .locator(COMPOSER)
          .fill("Please improve the summary", { timeout: STEP_MS })
        await page.keyboard.press("Enter")
        await page
          .getByRole("button", { name: "Approve", exact: true })
          .first()
          .waitFor({ state: "visible", timeout: COACH_MS })
      },
      approve: async () => {
        await page
          .getByRole("button", { name: "Approve", exact: true })
          .first()
          .click({ timeout: STEP_MS })
        await page
          .locator(PANEL_UNDO)
          .waitFor({ state: "visible", timeout: COACH_MS })
      },
      pageText: () => page.locator(PAGE).first().innerText(),
      undoOffered: () => page.locator(PANEL_UNDO).first().isVisible(),
      downloadWord: async () => {
        await page
          .getByRole("button", { name: "File", exact: true })
          .first()
          .click({ timeout: STEP_MS })
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: STEP_MS }),
          page
            .getByRole("menuitem", { name: "Download Word", exact: true })
            .first()
            .click({ timeout: STEP_MS }),
        ])
        return readFileSync(await download.path())
      },
      screenshot: (name) => shoot(page, name),
      close: () => context.close(),
    }
  }

  return { now, openScreen, loopDriver }
}
