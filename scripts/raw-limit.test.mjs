import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/raw-limit.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const HISTORIC = "69a6caa7988ea5ab6daa3e71fff7d2c31ba17895"
const PAST = "apps/api/src/account/export-gate.ts"
const QUIET = "apps/api/src/limits/refusal.ts"

function show(rev, file) {
  return execFileSync("git", ["show", `${rev}:${file}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 30_000,
  })
}

test("the export gate that answered 429 without x-limit fires", () => {
  const problems = detect(show(HISTORIC, PAST), PAST)
  assert.ok(
    problems.some((line) => line.includes("export.running")),
    problems.join("\n")
  )
})

test("a refusal that names its catalog id stays quiet", () => {
  assert.deepEqual(
    detect(readFileSync(path.join(root, QUIET), "utf8"), QUIET),
    []
  )
})
