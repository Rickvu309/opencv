// Every check id has one kind, the invariant tier computes no design check and reads no design/ or reference/ file,
// and the design numbers come from the spec. Run: node --test .claude/skills/verify-landing/scripts/lib
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { gate, selectTier } from "../../../verify-app-ui/scripts/lib/tier.mjs"
import { recordSpec } from "../design-spec.mjs"
import { designChecks } from "./design-checks.mjs"
import { KINDS } from "./kinds.mjs"
import { pageChecks } from "./page-checks.mjs"
import { designReads, loadSpec } from "./spec.mjs"
import { textRules } from "./text-rules.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const emittedIds = () => {
  const ids = new Set()
  for (const dir of [here, join(here, "..")])
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".mjs") || name.endsWith(".test.mjs")) continue
      const text = readFileSync(join(dir, name), "utf8")
      for (const [, id] of text.matchAll(
        /(?:verdict|stale|judged)\(\s*"(\d+[a-z]?)"/g
      ))
        ids.add(id)
    }
  return ids
}

// A snapshot that answers every property read with another snapshot, so a check runs without a browser.
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

const run = (tier, spec) => {
  const want = gate(KINDS, tier)
  const snap = anything()
  const results = [
    ...textRules(snap, want),
    ...pageChecks({
      desktop: snap,
      mobile: snap,
      mobileOpen: snap,
      first: snap,
      mobileFirst: snap,
      reduced: snap,
      deep: snap,
      reducedDeep: snap,
      penSections: snap,
      design: spec,
      want,
    }),
  ]
  return selectTier(KINDS, tier, results)
}
const idsOf = (kind) => Object.keys(KINDS).filter((id) => KINDS[id] === kind)

test("KINDS holds every id the checker emits and nothing else", () => {
  assert.deepEqual([...emittedIds()].sort(), Object.keys(KINDS).sort())
  for (const kind of Object.values(KINDS))
    assert.ok(["invariant", "design"].includes(kind), kind)
})

test("tier all runs every check, and each result carries its kind", () => {
  const results = run("all", loadSpec())
  assert.deepEqual(results.map((r) => r.id).sort(), Object.keys(KINDS).sort())
  for (const r of results) assert.equal(r.kind, KINDS[r.id], r.id)
})

test("tier invariant computes no design check and reads no design/ or reference/ file", () => {
  designReads.length = 0
  const results = run("invariant", null)
  assert.deepEqual(results.map((r) => r.id).sort(), idsOf("invariant").sort())
  assert.deepEqual(designReads, [])
})

test("tier design keeps only the design checks", () => {
  const results = run("design", loadSpec())
  assert.deepEqual(results.map((r) => r.id).sort(), idsOf("design").sort())
})

test("an id with no kind is an error, not a silent skip", () => {
  assert.throws(() => gate(KINDS, "invariant")("99"), /no kind/)
})

test("29 reads the button size from the spec", () => {
  const spec = loadSpec()
  const button = (h, over = {}) => ({
    h,
    fontSize: "13px",
    fontWeight: "500",
    padInline: 12,
    inset: true,
    outer: true,
    borderVisible: false,
    radius: h / 2,
    ...over,
  })
  const desktop = {
    benefitArt: { section: true },
    ctas: {
      nav: button(32),
      close: button(44, { fontSize: "16px", padInline: 20 }),
      sample: button(44, {
        fontSize: "16px",
        padInline: 20,
        inset: false,
        outer: false,
      }),
    },
  }
  const status = (s) =>
    designChecks(desktop, s).find((r) => r.id === "29").status
  assert.equal(status(spec), "PASS")
  const taller = structuredClone(spec)
  taller["29"].buttons.nav.height = 36
  assert.equal(status(taller), "FAIL")
})

test("the recorder turns measurements into the committed spec shape, with a band around the gap", () => {
  const spec = loadSpec()
  const button = (h, over = {}) => ({
    h,
    fontSize: "13px",
    fontWeight: "500",
    padInline: 12,
    inset: true,
    outer: true,
    borderVisible: false,
    radius: h / 2,
    ...over,
  })
  const measured = {
    benefitArt: {
      section: true,
      count: 3,
      viewBoxes: ["0 0 300 300", "0 0 300 300", "0 0 300 300"],
      shapes: 94,
      hex: 0,
    },
    navLockup: { gap: 11.04, fontSize: "16px", fontWeight: "600" },
    ctas: {
      nav: button(32),
      close: button(44, { fontSize: "16px", padInline: 20 }),
      sample: button(44, {
        fontSize: "16px",
        padInline: 20,
        inset: false,
        outer: false,
      }),
    },
  }
  assert.deepEqual(recordSpec(spec, measured), spec)
  measured.navLockup.gap = 14.4
  const moved = recordSpec(spec, measured)["28"]
  assert.deepEqual([moved.gapMin, moved.gapMax], [12, 16])
  measured.ctas.nav = null
  assert.throws(() => recordSpec(spec, measured), /no nav button/)
})
