import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { detect } from "./lib/tla-sync-anchors.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const record = { file: "Spec.tla.json", sync: "a".repeat(40) }

test("formal sync anchors survive feature branch removal", () => {
  assert.deepEqual(detect([record], new Set([record.sync])), [])
  assert.deepEqual(detect([record], new Set(["b".repeat(40)])), [
    `${record.file}: sync ${record.sync} must belong to origin/main history`,
  ])
})

test("a locally available feature commit is not an accepted anchor", () => {
  const feature = { ...record, sync: "c".repeat(40) }
  assert.equal(detect([record, feature], new Set([record.sync])).length, 1)
})

test("every formal model uses an anchor from accepted main history", () => {
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
  const records = git(
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "*.tla.json"
  ).map((file) => ({
    file,
    sync: JSON.parse(readFileSync(join(root, file), "utf8")).sync,
  }))
  assert.ok(records.length > 0)
  assert.deepEqual(detect(records, new Set(git("rev-list", "origin/main"))), [])
})
