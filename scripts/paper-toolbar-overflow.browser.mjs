import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { tempDir } from "./lib/temp-dir.mjs"
import { detect, measureToolbar } from "./lib/paper-toolbar-overflow.mjs"

const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "")
const web = `${root}/apps/web`
const require = createRequire(`${web}/package.json`)
const { createServer } = await import(require.resolve("vite"))
const { chromium } = require("playwright-core")
const ref = process.env.PAPER_TOOLBAR_REF
const files = [
  "rich-text-formatting.tsx",
  "rich-text-toolbar-overflow.ts",
  "rich-text-toolbar-item.tsx",
]
const historic = new Map(
  ref
    ? files.flatMap((file) => {
        try {
          return [
            [
              `${web}/src/features/paper/${file}`,
              execFileSync(
                "git",
                ["show", `${ref}:apps/web/src/features/paper/${file}`],
                {
                  cwd: root,
                  encoding: "utf8",
                  stdio: ["ignore", "pipe", "ignore"],
                }
              ),
            ],
          ]
        } catch {
          return []
        }
      })
    : []
)
const fixture = `
import React from 'react'
import {createRoot} from 'react-dom/client'
import '@workspace/ui/globals.css'
import '/src/styles/paper.css'
import {mountRichPaperEditor} from '@workspace/paper-crdt/editor'
import {nativeProvenance} from '@workspace/domain'
import {openRichPaperClient} from '/@fs/${root}/packages/paper-crdt/src/client.ts'
import {seedStoredYDoc} from '/@fs/${root}/packages/paper-crdt/src/stored-document.ts'
import {storedFlowFixture} from '/@fs/${root}/packages/paper-crdt/src/test/flow-fixture.ts'
import {RichPaperTextFormatting} from '/src/features/paper/rich-editor/rich-text-formatting.tsx'
import {RichPhotoControls} from '/src/features/paper/rich-editor/rich-photo-controls.tsx'
const document=storedFlowFixture('letter')
const provenance=nativeProvenance(document)
const client=openRichPaperClient({epoch:1,revision:0,provenance,server:seedStoredYDoc(document),pending:Uint8Array.of(0,0)},{provenance})
const editor=mountRichPaperEditor(client,globalThis.document.querySelector('#editor'))
createRoot(globalThis.document.querySelector('#root')).render(React.createElement(RichPhotoControls,{editor,disabled:false},photoControls=>React.createElement(RichPaperTextFormatting,{editor,blocked:false,photoControls})))
`

test(
  "the rendered Paper toolbar greedily fits at phone and desktop widths",
  { timeout: 120000 },
  async (t) => {
    const cache = tempDir(
      t,
      "paper-toolbar-vite-",
      `${homedir()}/tmp/paper-council/1600`
    )
    const server = await createServer({
      root: web,
      cacheDir: cache,
      server: { port: 0, host: "127.0.0.1", open: false },
      plugins: [
        {
          name: "paper-toolbar-regression",
          enforce: "pre",
          resolveId(id) {
            if (id === "virtual:paper-toolbar") return "\0paper-toolbar"
          },
          load(id) {
            return (
              historic.get(id) ??
              (id === "\0paper-toolbar" ? fixture : undefined)
            )
          },
          configureServer(server) {
            server.middlewares.use(
              "/toolbar-regression",
              async (_request, response) => {
                response.setHeader("content-type", "text/html")
                response.end(
                  await server.transformIndexHtml(
                    "/toolbar-regression",
                    '<html><body style="margin:0"><div id="root"></div><div id="editor"></div><script type="module" src="/@id/__x00__paper-toolbar"></script></body></html>'
                  )
                )
              }
            )
          },
        },
      ],
    })
    let browser
    try {
      await server.listen()
      browser = await chromium.launch({ headless: true })
      const page = await browser.newPage({
        viewport: { width: 320, height: 900 },
      })
      await page.goto(`${server.resolvedUrls.local[0]}toolbar-regression`)
      const toolbar = page.locator('[data-slot="paper-text-formatting"]')
      await toolbar.getByRole("button", { name: "More formatting" }).waitFor()
      await page.evaluate(() => document.fonts.ready)
      for (const width of [
        ...Array.from({ length: 161 }, (_, index) => 320 + index),
        1100,
        1440,
        1280,
        ...Array.from({ length: 40 }, (_, index) => 1286 + index),
        320,
      ]) {
        await page.locator("#root").evaluate((root, width) => {
          root.style.marginInlineStart = width >= 768 ? "254px" : "0"
        }, width)
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve))
            )
        )
        const snapshot = await toolbar.evaluate(measureToolbar)
        if (width === 1440) {
          snapshot.expected = {
            controls: [
              "Undo (Ctrl+Z)",
              "Redo (Ctrl+Shift+Z)",
              "Paragraph style",
              "Font",
              "Text size",
              "Bold",
              "Italic",
              "Underline",
              "Strikethrough",
              "Text color",
              "Highlight",
              "Insert photo",
              "Edit photo",
              "Alignment (Ctrl+Shift+L/E/R/J)",
              "Line spacing",
              "Decrease indent (Ctrl+[)",
              "Increase indent (Ctrl+])",
              "Special indent",
              "Link",
              "Bulleted list",
              "Numbered list",
              "Remove formatting",
            ],
            separators: 4,
          }
        }
        if (width === 1280) {
          for (const label of [
            "Bold",
            "Italic",
            "Underline",
            "More formatting",
          ])
            assert.ok(
              snapshot.controls.some((control) => control.label === label),
              `${label} from main must remain visible with the sidebar`
            )
          assert.equal(snapshot.separators, 1)
        }
        assert.deepEqual(detect(snapshot), [], JSON.stringify(snapshot))
        if (width >= 1286 && width <= 1325) {
          const font = snapshot.candidates.find((item) => item.label === "Font")
          assert.ok(font && (!font.visible || font.width >= 112))
          assert.ok(
            snapshot.overflow,
            `More must remain available at ${width}px`
          )
        }
        if (width === 320)
          for (const label of ["Bold", "Italic"])
            assert.ok(
              snapshot.controls.some((item) => item.label === label),
              `${label} must stay visible when it fits`
            )
        console.log(
          JSON.stringify({
            ref: ref ?? "working tree",
            width,
            remaining: snapshot.remaining,
            controls: snapshot.controls.map((item) => item.label),
            candidates: width === 1440 ? snapshot.candidates : undefined,
          })
        )
      }
      await page.setViewportSize({ width: 360, height: 900 })
      await page.evaluate(
        () =>
          (document.querySelector("[data-toolbar-more-label]").style.fontSize =
            "32px")
      )
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      )
      const resized = await toolbar.evaluate(measureToolbar)
      assert.deepEqual(
        detect(resized),
        [],
        `control resize must remeasure without resizing the viewport: ${JSON.stringify(resized)}`
      )
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%"
      })
      await page.setViewportSize({ width: 320, height: 900 })
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      )
      assert.deepEqual(
        detect(await toolbar.evaluate(measureToolbar)),
        [],
        "200% text must fit"
      )
    } finally {
      await browser?.close()
      await server.close()
    }
  }
)
