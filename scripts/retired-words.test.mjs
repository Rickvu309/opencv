import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { RETIRED, detect, matches } from "./lib/retired-words.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const trackedFiles = () =>
  execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\0")
    .filter((file) => file && existsSync(path.join(root, file)))

const readText = (file) => {
  const bytes = readFileSync(path.join(root, file))
  return bytes.subarray(0, 8000).includes(0) ? null : bytes.toString("utf8")
}

const files = trackedFiles().filter((file) =>
  RETIRED.some((entry) => entry.scope(file))
)
const hits = files.flatMap((file) => matches(readText(file), file))
const violations = (id) =>
  hits
    .filter((hit) => hit.id === id && !hit.rule)
    .map((hit) => `${hit.where} uses "${hit.match}". ${hit.hint}`)
const used = new Set(hits.map((hit) => hit.rule).filter(Boolean))

test("no source file or file name uses a word CONTEXT.md retired", () => {
  assert.deepEqual(
    [...violations("thread"), ...violations("opportunity")],
    [],
    "Say Chat or Job."
  )
})

test("no file outside docs/adr uses the old project name", () => {
  assert.deepEqual(violations("openpath"), [])
})

test("every allowed retired-word use still matches something", () => {
  const stale = RETIRED.flatMap((entry) => entry.allowed).filter(
    (rule) => !used.has(rule)
  )
  assert.deepEqual(
    stale.map((rule) => rule.why),
    [],
    "These allowed entries in scripts/lib/retired-words.mjs match nothing now. Delete them."
  )
})

test("a source file that names the old project fires, in any case", () => {
  assert.equal(
    detect(
      `export const url = "https://openpath.example"`,
      "apps/web/src/config.ts"
    ).length,
    1
  )
  assert.equal(detect("OPENPATH=1", ".github/workflows/ci.yml").length, 1)
  assert.equal(detect("export OpenPath=1", "scripts/deploy.sh").length, 1)
})

test("the old project name stays in docs/adr as history, and OpenCV passes", () => {
  assert.deepEqual(
    detect(
      "OpenPath was renamed",
      "docs/adr/0006-design-system-values-and-the-kit-as-generator.md"
    ),
    []
  )
  assert.deepEqual(detect("The OpenCV web app", "docs/deploy.md"), [])
})

test("the native SDK history option is allowed while Coach conversation names remain guarded", () => {
  const file = "apps/api/src/coach/anthropic-runtime.ts"
  assert.deepEqual(detect("      thread: false,", file), [])
  assert.equal(detect("const threadId = 1", file).length, 1)
  assert.equal(detect("      thread: true,", file).length, 1)
  assert.deepEqual(
    detect(
      "const threadId = threads[0].id",
      "apps/api/src/coach/inbox-usage.test.ts"
    ),
    []
  )
  assert.equal(
    detect("const threadId = 1", "apps/api/src/coach/turn.ts").length,
    1
  )
})

test("a source file that uses Thread outside the inbox fires, and the inbox may say thread", () => {
  assert.equal(
    detect("const threadId = 1", "apps/web/src/features/coach/x.ts").length,
    1
  )
  assert.deepEqual(
    detect("const threadId = 1", "apps/web/src/features/inbox/list.ts"),
    []
  )
})
