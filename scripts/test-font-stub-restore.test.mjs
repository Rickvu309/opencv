import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  detectFontsStubRestore,
  isolatedTestFiles,
} from "./lib/test-font-stub-restore.mjs"

const root = path.resolve(import.meta.dirname, "..")

const MISTAKE = `const cleanups = new Set()
beforeEach(() => {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
})
`

const CLEAN = `const liveFonts = Object.getOwnPropertyDescriptor(document, "fonts")
beforeEach(() => {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
})
afterEach(() => {
  if (liveFonts) Object.defineProperty(document, "fonts", liveFonts)
  else Reflect.deleteProperty(document, "fonts")
})
`

const CONFIG = `const ISOLATED_FILES = [
  "src/features/paper/rich-page-lifecycle.isolated.test.tsx",
]
`

test("isolated test files come from the vitest config", () => {
  assert.deepEqual(isolatedTestFiles(CONFIG), [
    "src/features/paper/rich-page-lifecycle.isolated.test.tsx",
  ])
  assert.deepEqual(isolatedTestFiles("const other = 1"), [])
})

test("a fonts stub without a save and restore fires", () => {
  assert.deepEqual(detectFontsStubRestore(MISTAKE, "src/lib/a.test.ts", []), [
    "src/lib/a.test.ts: a test that replaces document.fonts must save the live descriptor and restore it after; the shared vitest pool keeps one document between test files",
  ])
})

test("a saved and restored fonts stub, an untouched file and an isolated file stay quiet", () => {
  assert.deepEqual(detectFontsStubRestore(CLEAN, "src/lib/a.test.ts", []), [])
  assert.deepEqual(
    detectFontsStubRestore("it('draws'", "src/lib/b.test.ts", []),
    []
  )
  assert.deepEqual(
    detectFontsStubRestore(MISTAKE, "src/lib/a.test.ts", ["src/lib/a.test.ts"]),
    []
  )
  assert.deepEqual(
    detectFontsStubRestore(MISTAKE, "src/lib/a.isolated.test.tsx", []),
    []
  )
})

test("every tracked web test that replaces document.fonts restores it", () => {
  const isolated = isolatedTestFiles(
    readFileSync(path.join(root, "apps/web/vitest.config.ts"), "utf8")
  )
  const files = execFileSync(
    "git",
    ["ls-files", "apps/web/src/**/*.test.ts", "apps/web/src/**/*.test.tsx"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
    .split("\n")
    .filter(Boolean)
  const problems = files.flatMap((file) =>
    detectFontsStubRestore(
      readFileSync(path.join(root, file), "utf8"),
      path.relative(path.join(root, "apps/web"), path.join(root, file)),
      isolated
    )
  )
  assert.deepEqual(problems, [])
})
