import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { test } from "node:test"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)))

test("every tracked shell suite runs, and an empty or failed listing fails", () => {
  let listing
  try {
    listing = execFileSync("git", ["ls-files", "scripts/test-*.sh"], {
      cwd: root,
      encoding: "utf8",
    })
  } catch (error) {
    assert.fail(`git ls-files scripts/test-*.sh failed: ${error.message}`)
  }

  const suites = listing.split(/\r?\n/).filter(Boolean).sort()
  assert.ok(suites.length > 0, "git ls-files found no scripts/test-*.sh suites")

  for (const suite of suites) {
    console.log(`running ${suite}`)
    const result = spawnSync("bash", [suite], {
      cwd: root,
      encoding: "utf8",
    })
    assert.equal(
      result.status,
      0,
      `${suite} failed (status ${result.status ?? result.signal})\n${result.stdout}\n${result.stderr}`
    )
  }
})
