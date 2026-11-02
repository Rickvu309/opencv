import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import assert from "node:assert/strict"
import { SLOW, discoverTests } from "./run-tests.mjs"

const VITEST_APPS = ["api", "web"]
const VITEST_FILE = /\.test\.tsx?$/

const undiscovered = (tracked, listed) =>
  tracked.filter((file) => !listed.has(file))

const listedByVitest = (app) =>
  new Set(
    execFileSync("pnpm", ["exec", "vitest", "list", "--filesOnly"], {
      cwd: new URL(`../../apps/${app}/`, import.meta.url),
      encoding: "utf8",
      timeout: 120_000,
    })
      .split("\n")
      .map((line) => line.replace(/^\[[^\]]+\]\s*/, "").trim())
      .filter((line) => VITEST_FILE.test(line))
  )

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

for (const app of VITEST_APPS)
  test(`every tracked ${app} vitest file is found by the ${app} vitest config`, () => {
    const prefix = `apps/${app}/`
    const tracked = execFileSync("git", ["ls-files", `${prefix}src`], {
      cwd: new URL("../../", import.meta.url),
      encoding: "utf8",
    })
      .split("\n")
      .filter((file) => VITEST_FILE.test(file))
      .map((file) => file.slice(prefix.length))
    assert.ok(tracked.length > 0, `no ${app} vitest files are tracked`)
    assert.deepEqual(undiscovered(tracked, listedByVitest(app)), [])
  })

test("a vitest file outside the include pattern is caught", () => {
  const listed = new Set(["src/a.test.ts"])
  assert.deepEqual(undiscovered(["src/a.test.ts", "src/b.test.ts"], listed), [
    "src/b.test.ts",
  ])
})
