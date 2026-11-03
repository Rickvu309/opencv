import assert from "node:assert/strict"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  coverageProblems,
  fixtureProblems,
  libModules,
  loadFixtures,
  shrinkProblems,
} from "./lib/bad-fixtures.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const config = JSON.parse(
  readFileSync(
    path.join(root, "scripts/verify-bad-fixtures.pending.json"),
    "utf8"
  )
)
const files = libModules(root)
const fixtures = Object.fromEntries(
  await Promise.all(
    files.map(async (file) => [file, await loadFixtures(root, file)])
  )
)
const today = new Date().toISOString().slice(0, 10)

test("every verifier check module has a bad fixture, or is listed with an issue and an expiry", () => {
  assert.deepEqual(
    coverageProblems({
      files,
      fixtures,
      notChecks: config.notChecks,
      pending: config.pending,
      today,
    }),
    []
  )
})

test("the pending and notChecks lists only shrink", () => {
  assert.deepEqual(
    shrinkProblems({ pending: config.pending, notChecks: config.notChecks }),
    []
  )
})

test("every check fails on its bad fixture", () => {
  const problems = Object.entries(fixtures).flatMap(([file, list]) =>
    list ? fixtureProblems(file, list) : []
  )
  assert.deepEqual(problems, [])
})

test("a module with no fixture and no list entry is refused", () => {
  const base = { fixtures: {}, notChecks: [], pending: [], today: "2026-11-03" }
  assert.match(
    coverageProblems({ ...base, files: ["lib/new-check.mjs"] })[0],
    /exports no badFixture/
  )
})

test("an empty fixture list counts as no fixture", () => {
  const base = { notChecks: [], pending: [], today: "2026-11-03" }
  assert.equal(
    coverageProblems({
      ...base,
      files: ["lib/a.mjs"],
      fixtures: { "lib/a.mjs": [] },
    }).length,
    1
  )
})

test("an expired or incomplete pending entry is refused", () => {
  const base = {
    files: ["lib/a.mjs"],
    fixtures: {},
    notChecks: [],
    today: "2026-11-03",
  }
  const entry = {
    file: "lib/a.mjs",
    issue: "#1",
    reason: "live",
    expires: "2026-11-02",
  }
  assert.match(coverageProblems({ ...base, pending: [entry] })[0], /expired/)
  assert.match(
    coverageProblems({
      ...base,
      pending: [{ ...entry, issue: "", expires: "2027-01-01" }],
    })[0],
    /needs an issue/
  )
})

test("a pending entry for a module that now has a fixture is refused", () => {
  const entry = {
    file: "lib/a.mjs",
    issue: "#1",
    reason: "live",
    expires: "2027-01-01",
  }
  assert.match(
    coverageProblems({
      files: ["lib/a.mjs"],
      fixtures: { "lib/a.mjs": [{ name: "x", fails: () => true }] },
      notChecks: [],
      pending: [entry],
      today: "2026-11-03",
    })[0],
    /also on pending/
  )
})

test("a check that passes its bad fixture is refused", () => {
  const passing = [{ name: "white on white", fails: () => false }]
  assert.match(
    fixtureProblems("lib/a.mjs", passing)[0],
    /did not fail on its bad fixture/
  )
  assert.match(
    fixtureProblems("lib/a.mjs", [{ name: "", fails: () => true }])[0],
    /needs a name/
  )
})

const entry = (file, extra = {}) => ({
  file,
  issue: "#963",
  reason: "live",
  expires: "2026-12-15",
  ...extra,
})

test("a pending entry that is not already frozen is refused", () => {
  const problems = shrinkProblems({
    pending: [entry("lib/new.mjs")],
    notChecks: [],
    frozen: ["lib/old.mjs"],
    pendingCeiling: 5,
  })
  assert.match(problems[0], /new pending entry/)
})

test("a pending list past its ceiling is refused", () => {
  const pending = [entry("lib/a.mjs"), entry("lib/b.mjs")]
  const problems = shrinkProblems({
    pending,
    notChecks: [],
    frozen: ["lib/a.mjs", "lib/b.mjs"],
    pendingCeiling: 1,
  })
  assert.match(problems[0], /ceiling is 1/)
})

test("a notChecks list past its ceiling is refused", () => {
  const notChecks = [
    { file: "lib/a.mjs", why: "no verdict" },
    { file: "lib/b.mjs", why: "no verdict" },
  ]
  const problems = shrinkProblems({
    pending: [],
    notChecks,
    notChecksCeiling: 1,
  })
  assert.match(problems[0], /notChecks has 2 entries/)
})

test("a pending entry cannot be re-dated past the fixed date", () => {
  const problems = shrinkProblems({
    pending: [entry("lib/a.mjs", { expires: "2027-01-01" })],
    notChecks: [],
    frozen: ["lib/a.mjs"],
  })
  assert.match(problems[0], /later than the fixed date 2026-12-15/)
})

test("a notChecks entry with no why is refused", () => {
  const base = {
    files: ["lib/a.mjs"],
    fixtures: {},
    pending: [],
    today: "2026-11-03",
  }
  assert.match(
    coverageProblems({ ...base, notChecks: [{ file: "lib/a.mjs" }] })[0],
    /needs a why/
  )
  assert.match(
    coverageProblems({
      ...base,
      notChecks: [{ file: "lib/a.mjs", why: " " }],
    })[0],
    /needs a why/
  )
  assert.deepEqual(
    coverageProblems({
      ...base,
      notChecks: [{ file: "lib/a.mjs", why: "no verdict" }],
    }),
    []
  )
})

test("a module with a badFixture and a sidecar badFixture is refused", async () => {
  const dir = path.join(root, "node_modules/.cache/bad-fixtures-test")
  mkdirSync(dir, { recursive: true })
  try {
    writeFileSync(path.join(dir, "both.mjs"), "export const badFixture = []\n")
    writeFileSync(
      path.join(dir, "both.bad-fixture.mjs"),
      "export const badFixture = []\n"
    )
    await assert.rejects(
      loadFixtures(root, "node_modules/.cache/bad-fixtures-test/both.mjs"),
      /both export a badFixture/
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
