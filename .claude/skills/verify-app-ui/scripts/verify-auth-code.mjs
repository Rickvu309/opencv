#!/usr/bin/env node
// PORT=4817 node .claude/skills/verify-app-ui/scripts/verify-auth-code.mjs <evidence directory>
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { launchBrowser } from "./lib/cdp.mjs"
import { comparePenLayout, TEXT_TOKENS } from "./lib/pen-layout-compare.mjs"
import { probeSource } from "./lib/pen-layout-probe.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
const output = resolve(process.argv[2] ?? "")
const port = Number(process.env.PORT)
const webOrigin = process.env.WEB_ORIGIN ?? `http://localhost:${port + 1}`
if (!process.argv[2] || !Number.isInteger(port) || port < 1024 || port > 65534)
  throw new Error(
    "Set PORT to the running API port and provide an evidence directory"
  )
mkdirSync(output, { recursive: true })
const design = join(repo, "apps/web/src/features/auth/design")
const sha = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex")
const sourceFiles = [
  "auth-copy.ts",
  "code-input.tsx",
  "email-code-screen.tsx",
  "sign-in-screen.tsx",
  "design/email-code.pen.css",
  "design/email-code-error-surfaces.styles.json",
  ...["email-code", "email-code-verifying", "email-code-error"].flatMap(
    (name) =>
      ["layout", "snapshot", "styles"].map(
        (kind) => `design/${name}.${kind}.json`
      )
  ),
].map((file) => join(repo, "apps/web/src/features/auth", file))
sourceFiles.push(
  ...[
    ".claude/skills/verify-app-ui/scripts/verify-auth-code.mjs",
    ".claude/skills/verify-app-ui/scripts/lib/pen-layout-probe.mjs",
    ".claude/skills/verify-app-ui/scripts/lib/pen-layout-compare.mjs",
    "packages/ui/src/components/button.tsx",
    "packages/ui/src/components/input.tsx",
  ].map((file) => join(repo, file))
)
const sourceHashes = () =>
  Object.fromEntries(
    sourceFiles.map((file) => [file.slice(repo.length + 1), sha(file)])
  )
const before = sourceHashes()
const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
  }).trim(),
  fixture:
    "HTTP-boundary fixtures: OTP send succeeds, verification holds or returns INVALID_OTP. Does not prove mail delivery or server authentication.",
  scope:
    "Desktop source-form text layout and responsive rendering. Source error digits remain expected: the real reducer clears an invalid code, and that difference is reported.",
  sourceHashes: before,
  captures: [],
}
const browser = await launchBrowser()
let failures = 0
const requireState = async (page, expression) => {
  if (!(await page.waitFor(expression, 15000))) {
    await page.screenshot(join(output, "failure.png"), false)
    writeFileSync(
      join(output, "failure.json"),
      JSON.stringify(
        {
          expression,
          logs: page.logs,
          page: await page.evaluate(
            "({url: location.href, text: document.body.innerText})"
          ),
        },
        null,
        2
      ) + "\n"
    )
    throw new Error(`State not reached: ${expression}`)
  }
}
const paint = (page) =>
  page.evaluate(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
  )
const paste = (page, value) =>
  page.evaluate(`(() => {
  const data = new DataTransfer(); data.setData('text', ${JSON.stringify(value)});
  document.querySelector('[aria-label="Digit 1"]').dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true}));
})()`)

try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [360, 740],
    [320, 640],
  ]) {
    for (const state of ["code", "verifying", "error"]) {
      const page = await browser.openPage({
        width,
        height,
        mobile: width < 600,
        reducedMotion: true,
        intercept: (request) => {
          if (request.method === "OPTIONS") return null
          if (request.url.includes("send-verification-otp"))
            return { status: 200, body: { success: true } }
          if (request.url.includes("sign-in/email-otp"))
            return state === "error"
              ? {
                  status: 400,
                  body: { code: "INVALID_OTP", message: "Invalid OTP" },
                }
              : "hold"
          return null
        },
      })
      try {
        await page.goto(new URL("/sign-in", webOrigin).href)
        await requireState(page, 'document.querySelector("#sign-in-email")')
        await page.evaluate(`(() => {
          const input = document.querySelector('#sign-in-email');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'linh.nguyen@gmail.com');
          input.dispatchEvent(new Event('input', {bubbles: true}));
          input.dispatchEvent(new Event('change', {bubbles: true}));
        })()`)
        await page.key("Tab")
        await page.evaluate("document.querySelector('form').requestSubmit()")
        await requireState(
          page,
          "document.querySelector('[aria-label=\"Digit 1\"]')"
        )
        await paste(page, state === "code" ? "481" : "481902")
        await requireState(
          page,
          state === "code"
            ? 'document.querySelector(\'[aria-label="Digit 3"]\')?.value === "1" && document.activeElement?.getAttribute("aria-label") === "Digit 4"'
            : `document.querySelector('[data-slot="email-code-${state}"]')`
        )
        await page.evaluate("document.fonts.ready")
        await paint(page)
        const runtime = await page.evaluate(`({
          fontLoaded: document.fonts.check('14.5px "Inter Variable"'),
          fontFamily: getComputedStyle(document.querySelector('[data-slot="email-code-screen"]')).fontFamily,
          overflow: document.documentElement.scrollWidth > innerWidth,
          viewport: {width: innerWidth, height: innerHeight, dpr: devicePixelRatio},
          countdown: document.querySelector('[data-slot="email-code-countdown"]')?.textContent,
          digits: [...document.querySelectorAll('[aria-label^="Digit "]')].map(input => input.value),
        })`)
        if (!runtime.fontLoaded || runtime.overflow) failures += 1
        const name = state === "code" ? "email-code" : `email-code-${state}`
        const layout = JSON.parse(
          readFileSync(join(design, `${name}.layout.json`), "utf8")
        )
        let comparison = null
        if (width === layout.viewport.width) {
          const texts = layout.texts
            .filter((text) => text.x < 720 && text.y >= 250 && text.y < 600)
            .map((text) =>
              text.text.startsWith("Resend in ")
                ? { ...text, text: runtime.countdown }
                : text
            )
          const measured = await page.evaluate(
            probeSource({
              mode: "app",
              pane: "body",
              texts,
              tokens: TEXT_TOKENS,
            })
          )
          if (measured.error) throw new Error(measured.error)
          comparison = {
            ...comparePenLayout({ layout: { ...layout, texts }, ...measured }),
            measured: measured.measured,
          }
          if (comparison.mismatches.length) failures += 1
        }
        const screenshot = `${state}-${width}.png`
        await page.screenshot(join(output, screenshot), false)
        let keyboardFocus = null
        if (state !== "verifying") {
          for (let tab = 0; tab < 12; tab += 1) {
            await page.key("Tab")
            if (
              await page.evaluate(
                "document.activeElement?.matches('[data-slot=\"email-code-open\"]')"
              )
            )
              break
          }
          await paint(page)
          keyboardFocus = await page.evaluate(`(() => {
            const link = document.querySelector('[data-slot="email-code-open"]');
            const style = getComputedStyle(link);
            return { active: document.activeElement === link, visible: link.matches(':focus-visible'), shadow: style.boxShadow, outline: style.outlineStyle, outlineWidth: style.outlineWidth };
          })()`)
          if (
            !keyboardFocus.active ||
            !keyboardFocus.visible ||
            (keyboardFocus.shadow === "none" &&
              (keyboardFocus.outline === "none" ||
                keyboardFocus.outlineWidth === "0px"))
          )
            failures += 1
          await page.screenshot(
            join(output, `focus-${state}-${width}.png`),
            false
          )
        }
        report.captures.push({
          keyboardFocus,
          state,
          capturedAt: new Date().toISOString(),
          screenshot,
          sha256: sha(join(output, screenshot)),
          ...runtime,
          comparison,
        })
      } finally {
        await page.close()
      }
    }
  }
} catch (error) {
  failures += 1
  report.error = error instanceof Error ? error.message : String(error)
  throw error
} finally {
  await browser.quit()
  report.sourceUnchanged =
    JSON.stringify(before) === JSON.stringify(sourceHashes())
  if (!report.sourceUnchanged) failures += 1
  report.failures = failures
  writeFileSync(
    join(output, "result.json"),
    JSON.stringify(report, null, 2) + "\n"
  )
}
for (const capture of report.captures)
  console.log(
    `${capture.state} ${capture.viewport.width}: Inter=${capture.fontLoaded}, overflow=${capture.overflow}, layout=${capture.comparison ? `${capture.comparison.mismatches.length} mismatches` : "responsive capture"}`
  )
console.log(`Source unchanged: ${report.sourceUnchanged}; evidence: ${output}`)
process.exitCode = failures ? 1 : 0
