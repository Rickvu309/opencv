import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  PAPER_EDITOR_DIR,
  paperLayoutOwnsLinesProblems,
} from "./lib/paper-editor-guards.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const painter = `${PAPER_EDITOR_DIR}painter.ts`
const css = `${PAPER_EDITOR_DIR}paper-editor.css`

const MISTAKES = [
  [`const width = context.measureText(word).width`, painter],
  [`const rows = range.getClientRects().length`, painter],
  [`.paper-line { white-space: normal; }`, css],
  [`.paper-run { white-space:pre-wrap }`, css],
  [`line.style.whiteSpace = "normal"`, painter],
  [`<span className="whitespace-pre-wrap" />`, `${PAPER_EDITOR_DIR}page.tsx`],
]

const CLEAN = [
  [`.paper-line { white-space: pre; }`, css],
  [`span.style.left = \`\${px(run.x)}px\``, painter],
  [`const rect = element.getBoundingClientRect()`, painter],
  [
    `.writing-page p { white-space: pre-wrap; }`,
    "apps/web/src/features/paper/design/paper-writing-page.css",
  ],
  [
    `const width = context.measureText(word).width`,
    "apps/web/src/features/coach/chart.ts",
  ],
]

test("browser measuring or wrapping fires in the new Paper editor", () => {
  for (const [source, file] of MISTAKES)
    assert.ok(
      paperLayoutOwnsLinesProblems(source, file).length > 0,
      `expected ${file} to fire: ${source}`
    )
})

test("positioned lines and code outside the new editor stay quiet", () => {
  for (const [source, file] of CLEAN)
    assert.deepEqual(paperLayoutOwnsLinesProblems(source, file), [], file)
})

test("the new Paper editor paints only the lines Layout made", () => {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      PAPER_EDITOR_DIR,
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((name) => /\.(?:[cm]?[jt]sx?|css)$/.test(name))
    .filter((name) => !/\.test\.[jt]s$/.test(name))
    .filter((name) => existsSync(path.join(root, name)))
  assert.ok(files.includes(css), "expected the editor stylesheet")
  const problems = files.flatMap((name) =>
    paperLayoutOwnsLinesProblems(
      readFileSync(path.join(root, name), "utf8"),
      name
    )
  )
  assert.deepEqual(problems, [])
})
