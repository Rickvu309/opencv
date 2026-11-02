import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { expiredMessage, expiredPending } from "./lib/pending-fixes.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const PENDING = [
  {
    file: ".claude/skills/verify-app-ui/scripts/verify-letter-editor.mjs",
    issue: "#830",
    expires: "2026-11-16",
  },
]

const drivers = execFileSync(
  "git",
  [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    ".claude/skills/**/scripts/*.mjs",
  ],
  { cwd: root, encoding: "utf8" }
)
  .split("\n")
  .filter((file) => file && !file.endsWith(".test.mjs"))

const READS_MISMATCHES =
  /\.mismatches\b|\bmismatches\.(?:length|filter|some|every|map|forEach)\b/

function driversThatIgnoreMismatches(files, read) {
  return files.filter((file) => {
    const source = read(file)
    return (
      /import[^;]*\bcomparePenLayout\b[^;]*pen-layout-compare/s.test(source) &&
      !READS_MISMATCHES.test(source)
    )
  })
}

test("a driver that compares the layout reads the mismatches it finds", () => {
  const pending = new Set(PENDING.map((entry) => entry.file))
  const ignoring = driversThatIgnoreMismatches(drivers, (file) =>
    readFileSync(path.join(root, file), "utf8")
  ).filter((file) => !pending.has(file))
  assert.deepEqual(
    ignoring,
    [],
    `${ignoring.join(", ")} calls comparePenLayout but never reads its mismatches, so the driver reports PASS with the layout wrong. Fail the run when mismatches.length is not 0, as verify-pen-layout.mjs does.`
  )
})

test("the detector flags a driver that records the comparison and never reads it", () => {
  const sources = {
    recorded: `import { comparePenLayout } from "./lib/pen-layout-compare.mjs"
const comparison = { ...comparePenLayout({ layout, ...measured }), measured }
report.status = "PASS"`,
    checked: `import { comparePenLayout } from "./lib/pen-layout-compare.mjs"
const { mismatches } = comparePenLayout({ layout, ...measured })
if (mismatches.length) process.exitCode = 1`,
  }
  assert.deepEqual(
    driversThatIgnoreMismatches(Object.keys(sources), (file) => sources[file]),
    ["recorded"]
  )
})

test("pending layout-gate fixes have not expired", () => {
  assert.equal(expiredMessage(expiredPending(PENDING)), "")
})
