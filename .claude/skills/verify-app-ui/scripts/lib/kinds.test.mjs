// Every check id has one kind, and the invariant tier computes no design check. Run: node --test .claude/skills/verify-app-ui/scripts/lib
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { runChecks } from "./checks.mjs"
import { KINDS } from "./kinds.mjs"
import { gate, selectTier } from "./tier.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const emittedIds = () => {
  const ids = new Set()
  for (const name of readdirSync(here)) {
    if (!name.endsWith(".mjs") || name.endsWith(".test.mjs")) continue
    const text = readFileSync(join(here, name), "utf8")
    for (const [, id] of text.matchAll(
      /(?:result|stale|judged)\(\s*"(\d+[a-z]?)"/g
    ))
      ids.add(id)
  }
  return ids
}

const anything = () =>
  new Proxy(function () {}, {
    get: (_, key) =>
      key === Symbol.toPrimitive
        ? (hint) => (hint === "string" ? "" : 0)
        : key === Symbol.iterator
          ? function* () {}
          : key === "then"
            ? undefined
            : anything(),
    apply: () => anything(),
  })

const run = (tier) =>
  selectTier(KINDS, tier, runChecks(anything(), gate(KINDS, tier)))
const idsOf = (kind) => Object.keys(KINDS).filter((id) => KINDS[id] === kind)

test("KINDS holds every id the checker emits and nothing else", () => {
  assert.deepEqual([...emittedIds()].sort(), Object.keys(KINDS).sort())
  for (const kind of Object.values(KINDS))
    assert.ok(["invariant", "design"].includes(kind), kind)
})

test("tier all runs every check, and each result carries its kind", () => {
  const results = run("all")
  assert.deepEqual(results.map((r) => r.id).sort(), Object.keys(KINDS).sort())
  for (const r of results) assert.equal(r.kind, KINDS[r.id], r.id)
})

test("tier invariant computes no design check", () => {
  assert.deepEqual(
    run("invariant")
      .map((r) => r.id)
      .sort(),
    idsOf("invariant").sort()
  )
})

test("tier design keeps only the design checks", () => {
  assert.deepEqual(
    run("design")
      .map((r) => r.id)
      .sort(),
    idsOf("design").sort()
  )
})
