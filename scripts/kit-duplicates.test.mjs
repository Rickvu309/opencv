import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { expiredMessage, expiredPending } from "./lib/pending-fixes.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const SOURCE = /^(?:apps|packages)\/[^/]+\/.+\.(?:[cm]?[jt]sx?)$/
const NOT_PRODUCT_CODE =
  /\.(?:test|type-test|spec|stories)\.[cm]?[jt]sx?$|\.d\.ts$|\/test\//

export const RULES = [
  {
    name: "clipboard",
    scope: /^(?:apps|packages)\//,
    hit: (source) =>
      /\bclipboard\s*\.\s*write(?:Text)?\s*\(|execCommand\(\s*["'`]copy["'`]/.test(
        source
      ),
    allowed: ["packages/ui/src/components/copy-button.tsx"],
    use: "CopyButton, or copyText for a copy that has no button, from @workspace/ui/components/copy-button. It already falls back to execCommand and toasts the result.",
    pending: [],
  },
]

export function offenders(rule, files, read) {
  return files
    .filter((file) => rule.scope.test(file))
    .filter((file) => !rule.allowed.includes(file))
    .filter((file) => rule.hit(read(file)))
}

const productFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8" }
)
  .split("\n")
  .filter((file) => SOURCE.test(file) && !NOT_PRODUCT_CODE.test(file))

const read = (file) => readFileSync(path.join(root, file), "utf8")

for (const rule of RULES) {
  const pending = new Set(rule.pending.map((entry) => entry.file))

  test(`${rule.name}: no file rebuilds what the kit already has`, () => {
    const strays = offenders(rule, productFiles, read).filter(
      (file) => !pending.has(file)
    )
    assert.deepEqual(
      strays,
      [],
      `${strays.join(", ")} rebuilds the kit ${rule.name} by hand. Use ${rule.use}`
    )
  })

  test(`${rule.name}: every pending file still has the problem`, () => {
    const hits = new Set(offenders(rule, productFiles, read))
    const fixed = [...pending].filter((file) => !hits.has(file))
    assert.deepEqual(
      fixed,
      [],
      `${fixed.join(", ")} no longer rebuilds the kit ${rule.name}. Delete its pending entry.`
    )
  })

  test(`${rule.name}: pending entries have not expired`, () => {
    assert.equal(expiredMessage(expiredPending(rule.pending)), "")
  })
}

const byName = Object.fromEntries(RULES.map((rule) => [rule.name, rule]))

test("clipboard: the hand-rolled copy-link code that #844 deleted is caught", () => {
  const past = `
    try {
      await navigator.clipboard.writeText(publicShareUrl(token))
    } catch {
      document.execCommand("copy")
    }`
  assert.ok(byName.clipboard.hit(past))
  assert.ok(byName.clipboard.hit("navigator.clipboard\n  .writeText(value)"))
  assert.ok(byName.clipboard.hit("document.execCommand('copy')"))
})

test("clipboard: reading the clipboard and mocking execCommand are allowed", () => {
  assert.ok(!byName.clipboard.hit("await navigator.clipboard.readText()"))
  assert.ok(!byName.clipboard.hit("document.execCommand = () => false"))
})

test("the scan sees the kit file that is allowed and the files that are pending", () => {
  assert.ok(productFiles.includes("packages/ui/src/components/copy-button.tsx"))
  assert.ok(productFiles.length > 200)
})
