import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import assert from "node:assert/strict"
import { SLOW, discoverTests } from "./run-tests.mjs"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)))
const tracked = execFileSync("git", ["ls-files", "*.test.mjs"], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)

test("every tracked node test is run by exactly one package script", () => {
  const discovered = new Set(discoverTests())
  for (const file of tracked) {
    const owners = [
      discovered.has(file) ? "test" : null,
      file === SLOW ? "test:open-pr" : null,
    ].filter(Boolean)
    assert.equal(
      owners.length,
      1,
      `${file} is run by ${owners.join(", ") || "no package script"}`
    )
  }
  assert.match(pkg.scripts.test, /run-tests\.mjs$/)
  assert.match(pkg.scripts["test:open-pr"], /run-tests\.mjs --open-pr$/)
})

test("discovery fails when it finds nothing", () => {
  assert.throws(() => discoverTests(() => ""), /found no \*\.test\.mjs/)
  assert.throws(
    () => discoverTests(() => `${SLOW}\n`),
    /found no \*\.test\.mjs/
  )
})

test("a file missing from the listing is caught by the completeness rule", () => {
  const files = discoverTests(() => "scripts/a.test.mjs\nscripts/b.test.mjs\n")
  assert.deepEqual(files, ["scripts/a.test.mjs", "scripts/b.test.mjs"])
  assert.ok(!files.includes("scripts/c.test.mjs"))
})
