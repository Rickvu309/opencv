import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import test from "node:test"
import { chromium } from "playwright-core"
import { detect } from "./lib/paper-header-fit.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const webRequire = createRequire(`${root}apps/web/package.json`)
const { createServer, transformWithEsbuild } = await import(
  pathToFileURL(webRequire.resolve("vite"))
)
const { default: tailwindcss } = await import(
  pathToFileURL(webRequire.resolve("@tailwindcss/vite"))
)
const pagePath = "apps/web/src/features/paper/rich-page.tsx"
const cssPath = "apps/web/src/features/paper/design/rich-page-header.pen.css"
const read = (path, rev) =>
  rev === "working"
    ? readFileSync(`${root}${path}`, "utf8")
    : execFileSync("git", ["show", `${rev}:${path}`], {
        cwd: root,
        encoding: "utf8",
      })
const sync = read("apps/web/src/lib/paper-sync.ts", "working")
const labels = sync.match(/export const SYNC_LABEL[^=]*= (\{[^}]+\})/)[1]

export async function headerLayouts(rev = "working") {
  const source = read(pagePath, rev)
  const header = source.slice(
    source.indexOf("<PageHeader>"),
    source.indexOf("</PageHeader>") + 13
  )
  const css = read(cssPath, rev)
  const module = `
    import React from "react"
    import { createRoot } from "react-dom/client"
    import { ArrowLeft } from "lucide-react"
    import { Button } from "@workspace/ui/components/button"
    import { PageHeader, PageHeaderTitle } from "@workspace/ui/components/page-header"
    import { RichDocumentMenu } from "/src/features/paper/rich-document-menu.tsx"
    import "@workspace/ui/globals.css"
    const SYNC_LABEL = ${labels}
    const name = "Alexandra Nguyễn-Wiśniewska — Senior Product Designer — Curriculum Vitae 2026"
    const session = null
    const onBack = () => {}
    const root = createRoot(document.getElementById("root"))
    window.renderHeader = (status, editorError) => {
      const blocked = editorError || status === "stuck" || status === "refused"
      const statusLabel = editorError ? "Editor unavailable. Your document is kept" : SYNC_LABEL[status]
      root.render(<section data-pen-surface="paper" className="rich-paper-page">${header}</section>)
    }
    window.statuses = [...Object.keys(SYNC_LABEL), "editor-error"]
  `
  const scratch = `${homedir()}/tmp/paper-header-layout`
  mkdirSync(scratch, { recursive: true })
  const cacheDir = mkdtempSync(`${scratch}/vite-`)
  const server = await createServer({
    cacheDir,
    configFile: false,
    root: `${root}apps/web`,
    logLevel: "error",
    plugins: [
      tailwindcss(),
      {
        name: "paper-header-layout",
        resolveId(id) {
          if (id === "virtual:paper-header") return "\0paper-header.tsx"
        },
        async load(id) {
          if (id === "\0paper-header.tsx")
            return (
              await transformWithEsbuild(module, "header-case.tsx", {
                jsx: "automatic",
              })
            ).code
        },
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === "/header-case") {
              res.setHeader("Content-Type", "text/html")
              res.end(
                `<html><head><style>${css}</style></head><body><div id="root"></div><script type="module" src="/@id/virtual:paper-header"></script></body></html>`
              )
            } else next()
          })
        },
      },
    ],
    resolve: {
      alias: {
        "@": `${root}apps/web/src`,
        "@workspace/domain": `${root}packages/domain/src/index.ts`,
        "@workspace/paper-crdt": `${root}packages/paper-crdt/src/index.ts`,
      },
    },
    optimizeDeps: {
      noDiscovery: false,
      include: [
        "react",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "lucide-react",
        "@base-ui/react/button",
        "@base-ui/react/menu",
        "@base-ui/react/tooltip",
        "@base-ui/react/use-render",
        "@base-ui/react/merge-props",
        "sonner",
      ],
    },
    server: { port: 0, host: "127.0.0.1", fs: { allow: [root] } },
  })
  let browser
  try {
    await server.listen()
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    const errors = []
    page.on("pageerror", (error) => {
      errors.push(error.message)
      process.stderr.write(`${error.message}\n`)
    })
    page.on("console", (msg) => {
      if (msg.type() === "error") process.stderr.write(`${msg.text()}\n`)
    })
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/header-case`
    )
    await page.waitForFunction(
      () => typeof window.renderHeader === "function",
      null,
      { timeout: 10000 }
    )
    const statuses = await page.evaluate(() => window.statuses)
    const rows = []
    for (const width of [320, 360, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const scale of [1, 2]) {
        for (const status of statuses) {
          await page.evaluate(
            ({ scale, status }) => {
              document.documentElement.style.fontSize = `${16 * scale}px`
              window.renderHeader(
                status === "editor-error" ? "saved" : status,
                status === "editor-error"
              )
            },
            { scale, status }
          )
          await page.evaluate(() => new Promise(requestAnimationFrame))
          await page.evaluate(() => document.fonts.ready)
          const row = await page
            .locator('[data-slot="page-header"]')
            .evaluate((header) => {
              const box = (el) => {
                const r = el.getBoundingClientRect()
                return { x: r.x, y: r.y, right: r.right, width: r.width }
              }
              const title = header.querySelector("h1")
              const status = header.querySelector('[role="status"]')
              const menu = header.querySelector('[aria-label="Document menu"]')
              const probe = document.createElement("span")
              probe.style.font = getComputedStyle(title).font
              probe.textContent = "0000"
              header.append(probe)
              const minimum = probe.getBoundingClientRect().width
              probe.remove()
              return {
                title: box(title),
                status: box(status),
                menu: box(menu),
                minimum,
                viewport: innerWidth,
                sameLine:
                  Math.abs(
                    title.getBoundingClientRect().top -
                      menu.getBoundingClientRect().top
                  ) < menu.clientHeight,
                fullStatus: status.getAttribute("aria-label"),
                tooltip: status.title,
                text: status.textContent,
                ellipsis: getComputedStyle(status).textOverflow,
              }
            })
          rows.push({
            ...row,
            case: `${rev}/${width}/${scale}/${status}`,
            normal:
              scale === 1 && ["saved", "saving", "loading"].includes(status),
          })
        }
      }
    }
    assert.deepEqual(errors, [])
    return rows
  } finally {
    await browser?.close()
    await server.close()
    rmSync(cacheDir, { recursive: true, force: true })
  }
}

test(
  "Paper header browser layout preserves title and menu for every sync and editor status",
  { timeout: 120000 },
  async () => {
    const rows = await headerLayouts()
    assert.deepEqual(detect(rows), [])
    for (const row of rows) {
      assert.equal(row.fullStatus, row.text)
      assert.equal(row.tooltip, row.text)
      assert.equal(row.ellipsis, "ellipsis")
    }
    assert.ok(
      detect([{ ...rows[0], title: { ...rows[0].title, width: 0 } }]).length
    )
    assert.ok(
      detect([{ ...rows[0], menu: { ...rows[0].menu, right: 9999 } }]).length
    )
  }
)

test(
  "layout guard rejects title collapse at reviewed head and status overflow on main",
  { timeout: 180000 },
  async () => {
    for (const rev of ["b25d93f1", "31528653", "7f4a5597"]) {
      const hits = detect(await headerLayouts(rev))
      assert.ok(hits.length, rev)
      if (rev === "b25d93f1")
        assert.ok(hits.some((hit) => hit.includes("title collapsed")))
      if (rev === "31528653")
        assert.ok(hits.some((hit) => hit.includes("menu leaves")))
    }
  }
)
