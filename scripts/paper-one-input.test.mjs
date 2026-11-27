import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  PAPER_EDITOR_DIR,
  PAPER_INPUT_PORT,
  paperOneInputProblems,
} from "./lib/paper-one-input.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const painter = `${PAPER_EDITOR_DIR}painter.ts`

const MISTAKES = [
  [`stage.contentEditable = "true"`, painter],
  [
    `<div contentEditable suppressContentEditableWarning />`,
    `${PAPER_EDITOR_DIR}page.tsx`,
  ],
  [`page.setAttribute("contenteditable", "true")`, PAPER_INPUT_PORT],
  [`host.addEventListener("keydown", onKey)`, painter],
  [
    `window.addEventListener('paste', onPaste)`,
    `${PAPER_EDITOR_DIR}paper-editor.ts`,
  ],
  [`stage.addEventListener(\`compositionend\`, done)`, painter],
  [`document.addEventListener("beforeinput", onBefore)`, painter],
  [`<div onKeyDown={onKey} />`, `${PAPER_EDITOR_DIR}page.tsx`],
  [`stage.oncopy = copy`, painter],
]

const CLEAN = [
  [`element.addEventListener("keydown", onKeyDown)`, PAPER_INPUT_PORT],
  [`element.addEventListener("paste", onPaste)`, PAPER_INPUT_PORT],
  [
    `surface.addEventListener("pointerdown", onDown)`,
    `${PAPER_EDITOR_DIR}pointer.ts`,
  ],
  [
    `port.element.addEventListener("focus", onFocus)`,
    `${PAPER_EDITOR_DIR}paper-editor.ts`,
  ],
  [
    `<div contentEditable />`,
    "apps/web/src/features/paper/rich-editor/rich-page.tsx",
  ],
  [
    `host.addEventListener("keydown", onKey)`,
    "apps/web/src/features/coach/coach.tsx",
  ],
]

test("a second input path or an editable page fires in the new Paper editor", () => {
  for (const [source, file] of MISTAKES)
    assert.ok(
      paperOneInputProblems(source, file).length > 0,
      `expected ${file} to fire: ${source}`
    )
})

test("the input port, pointer and focus listeners and other features stay quiet", () => {
  for (const [source, file] of CLEAN)
    assert.deepEqual(paperOneInputProblems(source, file), [], file)
})

test("the new Paper editor has one input path", () => {
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
  assert.ok(files.includes(PAPER_INPUT_PORT), "expected the input port")
  const problems = files.flatMap((name) =>
    paperOneInputProblems(readFileSync(path.join(root, name), "utf8"), name)
  )
  assert.deepEqual(problems, [])
})
