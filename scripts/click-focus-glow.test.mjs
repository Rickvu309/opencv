import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { clickFocusGlows } from "./lib/click-focus-glow.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const scannedFiles = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src",
      "packages/ui/src",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => /\.(tsx|ts|css)$/.test(file))
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .filter((file) => existsSync(path.join(root, file)))

const COACH_COMPOSER_GLOW = `[data-surface="coach"][data-slot="coach-composer"]:not(
    [data-capped]
  ):focus-within {
  border-color: var(--ring);
  box-shadow:
    0 1px 2px color-mix(in oklab, var(--foreground) 4%, transparent),
    0 0 0 3px color-mix(in oklab, var(--ring) 25%, transparent);
}`

const CANVAS_FIELD_GLOW = `@layer components {
  .paper-canvas-field:focus {
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent);
  }
}`

const KIT_INPUT_GLOW = `const field = cn(
  "rounded-lg border border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
)`

const CALL_SITE_GLOWS = `export const Link = () => (
  <div className="rounded-[11px] bg-secondary focus-within:ring-3 focus-within:ring-ring/50" />
)
export const Search = () => (
  <div className="rounded-[12px] border has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50" />
)
export const Group = () => (
  <div className="has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50" />
)`

test("a coloured glow that shows when a text field is clicked fires in CSS, the kit and at call sites", () => {
  assert.equal(
    clickFocusGlows(
      COACH_COMPOSER_GLOW,
      "apps/web/src/features/coach/design/coach.css"
    ).length,
    1
  )
  assert.equal(
    clickFocusGlows(CANVAS_FIELD_GLOW, "apps/web/src/styles/paper.css").length,
    1
  )
  assert.equal(
    clickFocusGlows(KIT_INPUT_GLOW, "packages/ui/src/components/input.tsx")
      .length,
    1
  )
  assert.deepEqual(
    clickFocusGlows(CALL_SITE_GLOWS, "apps/web/src/features/x.tsx").map((p) =>
      p.replace(/^[^:]+:\d+: /, "").replace(/ draws.*$/, "")
    ),
    [
      "focus-within:ring-ring/50",
      "has-[input:focus-visible]:ring-ring/50",
      "has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50",
    ]
  )
})

test("keyboard focus rings on buttons, neutral borders, error rings and resting shadows stay quiet", () => {
  const css = `[data-slot="dock"] button[aria-label="History"]:focus-visible {
  box-shadow: inset 0 0 0 3px var(--ring);
}
[data-slot="sidebar"] button[aria-label="New chat"]:not(:focus-visible) {
  box-shadow: 0 0 0 1px var(--ring);
}
[data-slot="coach-composer"]:not([data-capped]) {
  box-shadow: 0 1px 2px color-mix(in oklab, var(--foreground) 4%, transparent);
}
.writing-page:focus-visible {
  outline: 1px solid var(--border);
}`
  assert.deepEqual(clickFocusGlows(css, "apps/web/src/features/x.css"), [])
  const classes = `export const Ok = () => (
  <>
    <button className="focus-visible:ring-3 focus-visible:ring-ring/50" />
    <input className="focus-visible:border-muted-foreground/50 aria-invalid:ring-3 aria-invalid:ring-destructive/20" />
    <div className="focus-within:border-muted-foreground/50 focus-within:ring-1 focus-within:ring-muted-foreground/50" />
    <div className="has-[>[data-slot=code-block-content]:focus-visible]:ring-ring/50" />
  </>
)`
  assert.deepEqual(clickFocusGlows(classes, "apps/web/src/features/x.tsx"), [])
  assert.deepEqual(
    clickFocusGlows(
      `const field = "focus-visible:border-muted-foreground/50"`,
      "packages/ui/src/components/input.tsx"
    ),
    []
  )
})

test("no text field in the app or the kit draws a coloured glow when a person clicks into it", () => {
  const problems = scannedFiles().flatMap((file) =>
    clickFocusGlows(readFileSync(path.join(root, file), "utf8"), file)
  )
  assert.deepEqual(problems, [])
})
