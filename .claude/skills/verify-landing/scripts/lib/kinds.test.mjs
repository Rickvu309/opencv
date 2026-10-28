// Every check id has one kind, the invariant tier computes no design check and reads no design/ or reference/ file,
// and the design numbers come from the spec. Run: node --test .claude/skills/verify-landing/scripts/lib
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { gate, selectTier } from "../../../verify-app-ui/scripts/lib/tier.mjs"
import { artProblem, recordSpec } from "../design-spec.mjs"
import { designChecks } from "./design-checks.mjs"
import { KINDS } from "./kinds.mjs"
import { pageChecks } from "./page-checks.mjs"
import { designReads, loadSpec, specProblem } from "./spec.mjs"
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

const sampleButton = (h, over = {}) => ({
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
const measuredPage = () => ({
  benefitArt: {
    section: true,
    count: 3,
    viewBoxes: ["0 0 300 300", "0 0 300 300", "0 0 300 300"],
    shapes: 94,
    hex: 0,
  },
  navLockup: { gap: 11.04, fontSize: "16px", fontWeight: "600" },
  ctas: {
    nav: sampleButton(32),
    close: sampleButton(44, { fontSize: "16px", padInline: 20 }),
    sample: sampleButton(44, {
      fontSize: "16px",
      padInline: 20,
      inset: false,
      outer: false,
    }),
  },
})

test("the recorder turns measurements into the committed spec shape and keeps the committed tolerances", () => {
  const spec = loadSpec()
  const measured = measuredPage()
  assert.deepEqual(recordSpec(spec, measured), spec)
  const widened = structuredClone(spec)
  widened["28"].gapMax = 20
  measured.navLockup.gap = 15
  const kept = recordSpec(widened, measured)
  assert.deepEqual([kept["28"].gapMin, kept["28"].gapMax], [9, 20])
  const missing = measuredPage()
  missing.ctas.nav = null
  assert.throws(() => recordSpec(spec, missing), /no nav button/)
})

test("the recorder refuses a page outside the committed tolerances", () => {
  const spec = loadSpec()
  const gap = measuredPage()
  gap.navLockup.gap = 14.4
  assert.throws(
    () => recordSpec(spec, gap),
    /refusing to record[^]*28 nav gap 14.40px is outside the committed 9 to 13px/
  )
  const narrow = structuredClone(spec)
  narrow["28"].gapMax = 10
  assert.throws(() => recordSpec(narrow, measuredPage()), /28 nav gap 11.04px/)
  const tall = measuredPage()
  tall.ctas.nav = sampleButton(36)
  assert.throws(() => recordSpec(spec, tall), /29 nav height 36.00px/)
  const wide = measuredPage()
  wide.ctas.close.padInline = 22
  assert.throws(() => recordSpec(spec, wide), /29 close padInline 22.00px/)
})

test("the recorder refuses Coach art over the committed pixel ratio, and never writes a reference", () => {
  const spec = loadSpec()
  const png = readFileSync(join(here, "../../reference/coach-art.png"))
  const raster = (bytes) => ({
    title: spec["30"].title,
    png: `data:image/png;base64,${bytes.toString("base64")}`,
  })
  const same = { benefitRasters: [raster(png)] }
  assert.equal(artProblem(spec, same), null)
  assert.match(artProblem(spec, { benefitRasters: [] }), /no raster/)
  const strict = structuredClone(spec)
  strict["30"].maxRatio = -1
  assert.match(artProblem(strict, same), /over the committed/)
  const source = readFileSync(join(here, "../design-spec.mjs"), "utf8")
  assert.equal(source.match(/writeFileSync\(/g).length, 1)
  assert.doesNotMatch(source, /--reference|png\.split/)
})

test("a spec flag that is missing or false never turns a FAIL into a PASS", () => {
  const spec = loadSpec()
  const desktop = {
    benefitArt: { section: true },
    ctas: {
      nav: sampleButton(32),
      close: sampleButton(44, { fontSize: "16px", padInline: 20 }),
      sample: sampleButton(44, {
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
  const flat = structuredClone(spec)
  flat["29"].buttons.nav.pill = false
  assert.equal(status(flat), "FAIL")
  for (const flag of ["pill", "borderVisible", "inset", "outer"]) {
    const gone = structuredClone(spec)
    delete gone["29"].buttons.nav[flag]
    assert.equal(status(gone), "FAIL", flag)
  }
  const square = structuredClone(desktop)
  square.ctas.nav.radius = 2
  assert.equal(status(spec), "PASS")
  assert.equal(
    designChecks(square, spec).find((r) => r.id === "29").status,
    "FAIL"
  )
})

test("inline hex is a rule held in the checker, not a spec number", () => {
  const spec = loadSpec()
  assert.equal("inlineHex" in spec["27"], false)
  const art = (hex) => ({
    section: true,
    count: 3,
    viewBoxes: Array(3).fill("0 0 300 300"),
    shapes: 94,
    hex,
    perCard: [1, 1, 1],
  })
  const status = (hex) =>
    designChecks({ benefitArt: art(hex) }, spec).find((r) => r.id === "27")
      .status
  assert.equal(status(0), "PASS")
  assert.equal(status(3), "FAIL")
})

test("a missing or malformed spec makes 27 to 30 STALE instead of throwing", () => {
  const results = designChecks({}, { error: "cannot read the spec" })
  assert.deepEqual(
    results.map((r) => [r.id, r.status]),
    [
      ["27", "STALE"],
      ["28", "STALE"],
      ["29", "STALE"],
      ["30", "STALE"],
    ]
  )
  assert.equal(specProblem({ 27: {} }), "no section 28, 29, 30")
  assert.equal(specProblem(loadSpec()), null)
})
