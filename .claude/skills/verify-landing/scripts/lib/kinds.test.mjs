import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { gate, selectTier } from "../../../verify-app-ui/scripts/lib/tier.mjs"
import {
  artProblem,
  diffLines,
  finish,
  recorderDecision,
  recordSpec,
} from "../design-spec.mjs"
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

const anySnapshot = () =>
  new Proxy(function () {}, {
    get: (_, key) =>
      key === Symbol.toPrimitive
        ? (hint) => (hint === "string" ? "" : 0)
        : key === Symbol.iterator
          ? function* () {}
          : key === "then"
            ? undefined
            : anySnapshot(),
    apply: () => anySnapshot(),
  })

const run = (tier, spec) => {
  const want = gate(KINDS, tier)
  const snap = anySnapshot()
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

const coachRaster = (spec, file = "../../reference/coach-art.png") => ({
  title: spec["30"].title,
  png: `data:image/png;base64,${readFileSync(join(here, file)).toString("base64")}`,
})
const page = (spec, edit = () => {}) => {
  const measured = { ...measuredPage(), benefitRasters: [coachRaster(spec)] }
  edit(measured)
  return measured
}
const quiet = (decision) => {
  const written = []
  const log = console.log
  console.log = () => {}
  try {
    const exit = finish(decision, "out.json", (path, text) =>
      written.push([path, text])
    )
    return { exit, written }
  } finally {
    console.log = log
  }
}

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

test("dry run: prints one line per value, exits 0 when none differs, and writes nothing", () => {
  const spec = loadSpec()
  const decision = recorderDecision(spec, page(spec))
  assert.equal(decision.exit, 0)
  assert.equal(decision.write, null)
  assert.ok(decision.lines.length > 20)
  assert.ok(decision.lines.every((line) => line.endsWith(": unchanged")))
  assert.deepEqual(quiet(decision), { exit: 0, written: [] })
})

test("dry run: prints committed -> measured for a differing value, exits 1, and writes nothing", () => {
  const spec = loadSpec()
  const regressed = page(spec, (m) => {
    m.benefitArt.count = 2
    m.navLockup.fontSize = "12px"
    m.ctas.nav.inset = false
  })
  const decision = recorderDecision(spec, regressed)
  assert.equal(decision.exit, 1)
  assert.equal(decision.write, null)
  assert.ok(decision.lines.includes("27.cards: 3 -> 2"))
  assert.ok(decision.lines.includes("28.fontSize: 16 -> 12"))
  assert.ok(decision.lines.includes("29.buttons.nav.inset: true -> false"))
  assert.ok(decision.lines.includes("27.viewBox: unchanged"))
  assert.deepEqual(quiet(decision), { exit: 1, written: [] })
})

test("dry run: a value outside a committed tolerance exits 1 even when no spec value moves", () => {
  const spec = loadSpec()
  const decision = recorderDecision(
    spec,
    page(spec, (m) => {
      m.navLockup.gap = 14.4
    })
  )
  assert.equal(decision.exit, 1)
  assert.ok(decision.lines.every((l) => !l.includes("->")))
  assert.match(decision.lines.at(-1), /outside tolerance: 28 nav gap 14.40px/)
})

test("--accept writes the measured spec, and a second accept of the same page changes nothing", () => {
  const spec = loadSpec()
  const redesign = page(spec, (m) => {
    m.benefitArt.count = 2
  })
  const decision = recorderDecision(spec, redesign, { accept: true })
  assert.equal(decision.exit, 0)
  assert.equal(decision.write["27"].cards, 2)
  const done = quiet(decision)
  assert.equal(done.exit, 0)
  assert.equal(done.written.length, 1)
  assert.equal(done.written[0][0], "out.json")
  assert.deepEqual(JSON.parse(done.written[0][1]), decision.write)
  const again = recorderDecision(decision.write, redesign, { accept: true })
  assert.ok(again.lines.every((line) => line.endsWith(": unchanged")))
})

test("--accept refuses a page outside the committed tolerances and writes nothing", () => {
  const spec = loadSpec()
  const attempts = {
    "28 nav gap 14.40px is outside the committed 9 to 13px": (m) => {
      m.navLockup.gap = 14.4
    },
    "29 nav height 36.00px": (m) => {
      m.ctas.nav = sampleButton(36)
    },
    "29 close padInline 22.00px": (m) => {
      m.ctas.close.padInline = 22
    },
  }
  for (const [message, edit] of Object.entries(attempts)) {
    const decision = recorderDecision(spec, page(spec, edit), { accept: true })
    assert.equal(decision.exit, 2, message)
    assert.equal(decision.write, null, message)
    assert.match(decision.lines.join("\n"), /refusing to record/)
    assert.ok(decision.lines.join("\n").includes(message), message)
    assert.deepEqual(quiet(decision), { exit: 2, written: [] })
  }
  const narrow = structuredClone(spec)
  narrow["28"].gapMax = 10
  assert.equal(recorderDecision(narrow, page(narrow), { accept: true }).exit, 2)
})

test("--accept refuses Coach art over the committed pixel ratio, and never writes a reference", () => {
  const spec = loadSpec()
  const same = { benefitRasters: [coachRaster(spec)] }
  assert.equal(artProblem(spec, same), null)
  assert.match(artProblem(spec, { benefitRasters: [] }), /no raster/)
  const strict = structuredClone(spec)
  strict["30"].maxRatio = -1
  assert.match(artProblem(strict, same), /over the committed/)
  const decision = recorderDecision(strict, page(strict), { accept: true })
  assert.equal(decision.exit, 2)
  assert.equal(decision.write, null)
  const source = readFileSync(join(here, "../design-spec.mjs"), "utf8")
  assert.equal(source.match(/writeFileSync/g).length, 2)
  assert.doesNotMatch(source, /--reference|png\.split/)
})

test("a value only one side has shows as none", () => {
  assert.deepEqual(diffLines({ 27: { a: 1 } }, { 27: { b: 2 } }), [
    "27.a: 1 -> none",
    "27.b: none -> 2",
  ])
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

test("specProblem names the first section or field the spec lacks", () => {
  assert.equal(
    specProblem({ 27: {} }),
    "section 27 lacks viewBox, cards, shapes"
  )
  assert.equal(specProblem({}), "no section 27")
  assert.equal(specProblem(loadSpec()), null)
  const noGap = structuredClone(loadSpec())
  delete noGap["28"].gapMax
  assert.equal(specProblem(noGap), "section 28 lacks gapMax")
  const noTolerance = structuredClone(loadSpec())
  delete noTolerance["29"].tolerance
  assert.equal(specProblem(noTolerance), "section 29 lacks tolerance")
  const noInset = structuredClone(loadSpec())
  delete noInset["29"].buttons.close.inset
  assert.equal(specProblem(noInset), "29 button close lacks inset")
  const noButtons = structuredClone(loadSpec())
  noButtons["29"].buttons = {}
  assert.equal(specProblem(noButtons), "section 29 has no buttons")
})

test("a missing or malformed spec is an error for the checker, not a verdict", () => {
  const source = readFileSync(join(here, "../verify-landing.mjs"), "utf8")
  assert.match(source, /if \(spec\.error\) throw new Error\(spec\.error\)/)
})
