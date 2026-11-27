import { readFileSync } from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { LayoutWork } from "@workspace/paper-engine"
import { chromium, type Browser } from "playwright-core"
import { build, type Rollup } from "vite"
import { afterAll, beforeAll } from "vitest"

import { domainEntryAliases } from "../../domain-entries"

const webRoot = path.resolve(__dirname, "../..")
const ORIGIN = "http://paper-editor.test"
const HARNESS = "\0paper-toolbar-harness"
export const CHROME_DOWNLOAD_REASON = "Save this Paper first to download it"
const REASON = CHROME_DOWNLOAD_REASON

type Viewport = { width: number; height: number }

declare global {
  interface Window {
    paperTestCommits: number
    paperTestLayoutWork: () => LayoutWork
  }
}

async function bundle(): Promise<string> {
  const chrome = path.join(
    webRoot,
    "src/features/paper/editor/chrome/paper-chrome.tsx"
  )
  const documents = path.join(
    webRoot,
    "src/features/paper/editor/lab-documents.ts"
  )
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

async function openWith(
  browser: Browser,
  html: string,
  viewport: Viewport,
  isMobile: boolean,
  doc: string
) {
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

export function paperChromePages() {
  let browser: Browser
  let html = ""
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
  return (viewport: Viewport, isMobile = false, doc = "") =>
    openWith(browser, html, viewport, isMobile, doc)
}
