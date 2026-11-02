import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { expiredMessage, expiredPending } from "./lib/pending-fixes.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const entries = JSON.parse(
  readFileSync(path.join(root, "apps/web/src/test/nav-pending.json"), "utf8")
)

test("every nav-pending entry names a rule, an existing file, a PR or issue and an expiry", () => {
  for (const entry of entries) {
    assert.match(entry.rule, /^(?:touch-targets|active-state|count-in-name)$/)
    assert.ok(
      existsSync(path.join(root, entry.file)),
      `${entry.file} is gone. Remove its entry.`
    )
    assert.match(entry.issue, /^(?:PR )?#\d+$/)
    assert.match(entry.expires, /^\d{4}-\d{2}-\d{2}$/)
  }
})

test("no nav-pending entry has expired", () => {
  assert.equal(expiredMessage(expiredPending(entries)), "")
})
