import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  coverageProblems,
  fixtureProblems,
  libModules,
  loadFixtures,
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
