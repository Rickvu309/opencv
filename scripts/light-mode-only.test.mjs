import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { darkStyleProblems } from "./lib/light-mode-only.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const scannedFiles = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps",
      "packages",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => /\.(?:[cm]?[jt]sx?|css|html|svg)$/.test(file))
    .filter((file) => !/\.test\.[cm]?[jt]sx?$/.test(file))
    .filter((file) => existsSync(path.join(root, file)))

const MISTAKES = [
  [
    `export const Box = () => <div className="bg-background dark:bg-input/30 dark:hover:bg-transparent" />`,
    "apps/web/src/features/apply/box.tsx",
  ],
  [
    `@custom-variant dark (&:is(.dark *));`,
    "packages/ui/src/styles/globals.css",
  ],
  [
    `.dark { --background: oklch(0.155 0.009 274.276); }`,
    "packages/ui/src/styles/globals.css",
  ],
  [
    `[data-surface="coach"]:is(.dark *)[data-slot="history-panel"] { color: var(--popover-foreground); }`,
    "apps/web/src/features/coach/design/coach-history.css",
  ],
  [
    `@media (prefers-color-scheme: dark) { html { background: #111; } }`,
    "apps/web/src/styles/paper.css",
  ],
  [
    `const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches`,
    "apps/web/src/main.tsx",
  ],
  [`document.documentElement.classList.add("dark")`, "apps/web/src/main.tsx"],
  [
    `import { ThemeProvider } from "@/components/theme-provider.tsx"`,
    "apps/web/src/main.tsx",
  ],
]

const CLEAN = [
  [
    `:root { color-scheme: light; --background: oklch(0.982 0.001 286.376); }`,
    "packages/ui/src/styles/globals.css",
  ],
  [
    `@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }`,
    "packages/ui/src/styles/globals.css",
  ],
  [
    `export const Box = () => <div className="bg-background hover:bg-muted" />`,
    "packages/ui/src/components/button.tsx",
  ],
  [
    `<BlockNoteViewRaw editor={editor} theme="light" />`,
    "apps/web/src/features/paper/paper-editor-engine.tsx",
  ],
  [
    `<svg><style>@media (prefers-color-scheme: dark) { .mark { color: #f5f5f6; } }</style></svg>`,
    "apps/web/public/favicon.svg",
  ],
]

test("dark variants, .dark selectors, @custom-variant dark, prefers-color-scheme: dark and ThemeProvider fire", () => {
  for (const [source, file] of MISTAKES) {
    assert.ok(
      darkStyleProblems(source, file).length > 0,
      `expected ${file} to fire: ${source}`
    )
  }
})

test("light mode styles and the browser tab favicon stay quiet", () => {
  for (const [source, file] of CLEAN) {
    assert.deepEqual(darkStyleProblems(source, file), [], file)
  }
})

test("apps and packages keep no dark mode styles, theme provider or dark media rules", () => {
  const problems = []
  for (const file of scannedFiles()) {
    const found = darkStyleProblems(
      readFileSync(path.join(root, file), "utf8"),
      file
    )
    problems.push(...found)
  }
  assert.deepEqual(problems, [])
})
