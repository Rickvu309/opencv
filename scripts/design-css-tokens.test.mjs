import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { detect, tokenize } from "./lib/design-css-tokens.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const srcDir = path.join(root, "apps/web/src")

const MISTAKE = `[data-surface="apply"] [data-slot="page-header"] {
  border-bottom-color: #ededef;
}
[data-surface="apply"] [data-slot="page-header-title"] {
  color: #2f2f31;
}
`

const CLEAN = `[data-surface="apply"] [data-slot="page-header"] {
  border-bottom-color: var(--hairline);
}
[data-surface="apply"] [data-slot="page-header-title"] {
  color: var(--foreground);
}
`

const LOCAL_OVERRIDE = `.paper-library {
  --border: color-mix(in oklch, var(--foreground) 8%, transparent);
  background: color-mix(in oklch, var(--secondary) 35%, var(--background));
}
`

const DESIGN_FILE = "apps/web/src/features/apply/design/page-header.css"

test("MISTAKE: a hex colour in a feature design file fires and names the token", () => {
  assert.deepEqual(detect(MISTAKE, DESIGN_FILE), [
    "features/apply/design/page-header.css:2: #ededef; use var(--hairline)",
    "features/apply/design/page-header.css:5: #2f2f31; use var(--foreground)",
  ])
})

test("MISTAKE: an unknown hex colour fires and lists the globals.css tokens", () => {
  const [problem] = detect(
    '[data-surface="apply"] p { color: #123456; }',
    DESIGN_FILE
  )
  assert.match(
    problem,
    /#123456; use a token from packages\/ui\/src\/styles\/globals\.css \(var\(--foreground\)/
  )
})

test("MISTAKE: a screen that redeclares a globals.css token fires", () => {
  const [problem] = detect(
    LOCAL_OVERRIDE,
    "apps/web/src/features/paper/design/paper-hand.css"
  )
  assert.match(
    problem,
    /^features\/paper\/design\/paper-hand\.css:2: --border redeclared/
  )
})

test("CLEAN: tokens stay quiet, and files outside feature CSS are ignored", () => {
  assert.deepEqual(detect(CLEAN, DESIGN_FILE), [])
  assert.deepEqual(
    detect(MISTAKE, "apps/web/src/features/apply/apply-board.tsx"),
    []
  )
})

test("CLEAN: a kept file may hold hex colours when every selector is scoped", () => {
  const file = "apps/web/src/features/coach/design/cap-notice.css"
  assert.deepEqual(
    detect('[data-surface="coach"] p { color: #eaeffa; }', file),
    []
  )
  assert.equal(detect("p { color: #eaeffa; }", file).length, 1)
})

test("the codemod turns the mistake into the clean file and is safe to rerun", () => {
  assert.equal(tokenize(MISTAKE), CLEAN)
  assert.equal(tokenize(CLEAN), CLEAN)
  assert.equal(
    tokenize("box-shadow: 0 2px 4px #0000000a, 0 16px 48px #00000014;"),
    "box-shadow: 0 2px 4px rgb(0 0 0 / 4%), 0 16px 48px rgb(0 0 0 / 8%);"
  )
})

test("every feature CSS file in the app passes", () => {
  const files = readdirSync(path.join(srcDir, "features"), {
    recursive: true,
    encoding: "utf8",
  }).filter((file) => file.endsWith(".css"))
  const problems = files.flatMap((file) =>
    detect(
      readFileSync(path.join(srcDir, "features", file), "utf8"),
      `features/${file}`
    )
  )
  assert.deepEqual(problems, [])
})

test("the codemod has nothing left to rewrite", () => {
  const out = execFileSync(
    process.execPath,
    [path.join(root, "scripts/design-css-tokens.mjs"), "--check"],
    { encoding: "utf8", timeout: 30_000 }
  )
  assert.equal(out, "")
})
