import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  detect,
  judge,
  kindOf,
  protectedSet,
  weakenings,
} from "./protected.mjs"
import { retirementProblems } from "../rules/protected.mjs"

const fixture = (name) =>
  readFileSync(new URL(`./protected-fixtures/${name}`, import.meta.url), "utf8")

const one = (path, baseText, headText, extra = [], retirements = []) =>
  judge(
    [
      { path, kind: kindOf(path), baseText, headText },
      ...extra.map((file) => ({
        ...file,
        kind: file.baseText === null ? null : kindOf(file.path),
      })),
    ],
    retirements
  )

const whats = (result) => result.weakened.map((item) => item.what)

const T = "apps/web/src/features/paper/letter.test.ts"
const SPEC = `import { describe, expect, it } from "vitest"
describe("letter", () => {
  it("keeps order", () => {
    expect(order([2, 1])).toEqual([1, 2])
    expect(order([])).toEqual([])
  })
  it("refuses a letter that is too long", () => {
    expect(() => save(long)).toThrow(/too long/)
  })
})
`

test("every protected kind is read from its path", () => {
  const cases = {
    "apps/api/src/paper/import.test.ts": "test",
    "scripts/ui/compare.test.mjs": "guard",
    "packages/guards/run-tests.test.mjs": "guard",
    "apps/api/src/acceptance/1500.limits.test.ts": "acceptance",
    "scripts/ui/fixtures/annotate/one.png": "fixture",
    "apps/web/src/features/apply/design/w9-1-board-empty.snapshot.json":
      "fixture",
    "apps/api/src/paper/corpus/honest.docx": "corpus",
    "scripts/guard-ledger/catalog-stale.json": "ledger",
    "scripts/guard-ledger.baseline.json": "ratchet",
    "apps/api/src/registry/owned-known-reds.json": "ratchet",
    "packages/domain/src/limits/export.ts": "bound",
    "apps/web/vitest.quarantine.ts": "checker-config",
    "scripts/ocv-tools/jobs/test-selection.mjs": "checker-config",
    "packages/guards/run-tests.mjs": "checker-config",
  }
  const guards = new Set([
    "scripts/ui/compare.test.mjs",
    "packages/guards/run-tests.test.mjs",
  ])
  for (const [path, kind] of Object.entries(cases))
    assert.equal(kindOf(path, { guards }), kind, path)
  assert.equal(kindOf("scripts/ui/compare.test.mjs"), "test")
  for (const path of [
    "apps/web/src/test/apply-fixtures.ts",
    "apps/web/vitest.config.ts",
    "apps/api/src/paper/import.ts",
    "scripts/guard-ledger.proofs.json",
    "packages/domain/src/limits/export.test.ts",
  ])
    assert.equal(kindOf(path), path.endsWith(".test.ts") ? "test" : null, path)
  const set = protectedSet(["a.ts", T, "scripts/guard-ledger/x.json"])
  assert.deepEqual([...set.keys()], [T, "scripts/guard-ledger/x.json"])
})

test("a removed case, a removed assertion and a changed expected value are weakenings", () => {
  assert.deepEqual(
    whats(one(T, SPEC, SPEC.replace(/  it\("refuses[^]*?\n  }\)\n/, ""))),
    ["case-removed"]
  )
  assert.deepEqual(
    whats(
      one(T, SPEC, SPEC.replace("    expect(order([])).toEqual([])\n", ""))
    ),
    ["assertion-removed"]
  )
  assert.deepEqual(whats(one(T, SPEC, SPEC.replace("/too long/", "/./"))), [
    "expected-changed",
  ])
  assert.deepEqual(whats(one(T, SPEC, null)), ["case-removed", "case-removed"])
})

test("skip, todo, only, skipIf and a skipped group are weakenings on an existing case; .fails is left to PIN_ISSUE_OPEN", () => {
  assert.deepEqual(
    whats(one(T, SPEC, SPEC.replace('it("keeps', 'it.fails("keeps'))),
    []
  )
  for (const mark of ["skip", "todo", "only"])
    assert.deepEqual(
      whats(one(T, SPEC, SPEC.replace('it("keeps', `it.${mark}("keeps`))),
      ["skipped"],
      mark
    )
  assert.deepEqual(
    whats(one(T, SPEC, SPEC.replace('it("keeps', 'it.skipIf(ci)("keeps'))),
    ["skipped"]
  )
  assert.deepEqual(
    whats(
      one(T, SPEC, SPEC.replace('describe("letter"', 'describe.skip("letter"'))
    ),
    ["skipped", "skipped"]
  )
  const nodeTest = `import test from "node:test"
import assert from "node:assert/strict"
test("adds", () => { assert.equal(add(1, 1), 2) })
`
  assert.deepEqual(
    whats(
      one(
        "scripts/add.test.mjs",
        nodeTest,
        nodeTest.replace('test("adds", ', 'test("adds", { skip: true }, ')
      )
    ),
    ["skipped"]
  )
})

test(".only on a new case is refused, a skipped new case and removing a skipped case are free", () => {
  const added = SPEC.replace(
    /\n}\)\n$/,
    '\n  it.only("new", () => { expect(1).toBe(1) })\n})\n'
  )
  assert.deepEqual(whats(one(T, SPEC, added)), ["skipped"])
  const skipped = SPEC.replace('it("keeps', 'it.skip("keeps')
  assert.deepEqual(
    whats(
      one(T, skipped, skipped.replace(/  it\.skip\("keeps[^]*?\n  }\)\n/, ""))
    ),
    []
  )
})

test("added cases, added assertions, renamed and moved cases stay quiet", () => {
  assert.deepEqual(
    whats(
      one(
        T,
        SPEC,
        SPEC.replace(
          "    expect(order([])).toEqual([])\n",
          "    expect(order([])).toEqual([])\n    expect(order([1])).toEqual([1])\n"
        ).replace('it("keeps order"', 'it("keeps the order of paragraphs"')
      )
    ),
    []
  )
  const other = "apps/web/src/features/paper/letter-save.test.ts"
  const moved = `import { expect, it } from "vitest"
it("refuses a long letter", () => {
  expect(() => save(long)).toThrow(/too long/)
})
`
  assert.deepEqual(
    whats(
      one(T, SPEC, SPEC.replace(/  it\("refuses[^]*?\n  }\)\n/, ""), [
        { path: other, baseText: null, headText: moved },
      ])
    ),
    []
  )
  assert.deepEqual(
    whats(
      one(T, SPEC, null, [{ path: other, baseText: null, headText: SPEC }])
    ),
    []
  )
})

test("assertions are read by meaning: an aliased expect, an assert import and a helper that asserts", () => {
  const aliased = `import { expect as check, it } from "vitest"
it("a", () => { check(f()).toBe(1) })
`
  assert.deepEqual(
    whats(one(T, aliased, aliased.replace("check(f()).toBe(1)", "f()"))),
    ["assertion-removed"]
  )
  const named = `import { strict as sure } from "node:assert"
import test from "node:test"
test("a", () => { sure.equal(f(), 1) })
`
  assert.deepEqual(
    whats(
      one(
        "scripts/a.test.mjs",
        named,
        named.replace("sure.equal(f(), 1)", "f()")
      )
    ),
    ["assertion-removed"]
  )
  const helper = `import { expect, it } from "vitest"
const fits = (box) => { expect(box.width).toBeLessThan(390) }
it("fits", () => { fits(card()) })
`
  assert.deepEqual(
    whats(one(T, helper, helper.replace("fits(card())", "card()"))),
    ["assertion-removed"]
  )
})

test("a dropped table row and a raised ceiling constant in a test are weakenings", () => {
  const table = `import { expect, it } from "vitest"
const HOSTILE = ["bomb.pdf", "zip.docx"]
const CEILING = 52
it.each([["a", 1], ["b", 2]])("%s", (n, v) => { expect(v).toBeGreaterThan(0) })
`
  assert.deepEqual(whats(one(T, table, table.replace(', "zip.docx"', ""))), [
    "case-removed",
  ])
  assert.deepEqual(whats(one(T, table, table.replace(', ["b", 2]', ""))), [
    "case-removed",
  ])
  assert.deepEqual(
    whats(one(T, table, table.replace("CEILING = 52", "CEILING = 53"))),
    ["bound-loosened"]
  )
  assert.deepEqual(
    whats(one(T, table, table.replace("CEILING = 52", "CEILING = 51"))),
    []
  )
})

test("fixtures and corpora: a change or removal is refused, a new file and a rename are free", () => {
  const png = "scripts/ui/fixtures/annotate/one.png"
  assert.deepEqual(
    weakenings("blob1", "blob2", png, "fixture").map((w) => w.what),
    ["fixture-changed"]
  )
  assert.deepEqual(
    whats(
      judge([
        {
          path: png,
          kind: "fixture",
          baseText: "blob1",
          headText: null,
          baseBlob: "blob1",
        },
      ])
    ),
    ["file-removed"]
  )
  assert.deepEqual(
    whats(
      judge([
        {
          path: png,
          kind: "fixture",
          baseText: "blob1",
          headText: null,
          baseBlob: "blob1",
        },
        {
          path: "scripts/ui/fixtures/annotate/renamed.png",
          kind: null,
          baseText: null,
          headText: "blob1",
          headBlob: "blob1",
        },
      ])
    ),
    []
  )
  assert.deepEqual(
    whats(
      judge([
        {
          path: "scripts/ui/fixtures/new.png",
          kind: null,
          baseText: null,
          headText: "b9",
          headBlob: "b9",
        },
      ])
    ),
    []
  )
  assert.deepEqual(
    weakenings("x", "y", "apps/api/src/paper/corpus/honest.docx", "corpus").map(
      (w) => w.what
    ),
    ["fixture-changed"]
  )
})

test("ledger rows: a changed proof or a removal is refused, a new reason is free", () => {
  const row = JSON.stringify({
    id: "a",
    file: "a.test.mjs",
    historic: { mode: "detect", sha: "abc", path: "x" },
    reason: "r",
  })
  const path = "scripts/guard-ledger/a.json"
  assert.deepEqual(
    weakenings(row, row.replace('"r"', '"better words"'), path, "ledger"),
    []
  )
  assert.deepEqual(
    weakenings(row, row.replace('"abc"', '"HEAD"'), path, "ledger").map(
      (w) => w.subject
    ),
    [`${path} .historic`]
  )
  assert.deepEqual(
    weakenings(row, null, path, "ledger").map((w) => w.what),
    ["file-removed"]
  )
})

test("ratchets and known-failure lists may only shrink", () => {
  const reds = "apps/api/src/registry/owned-known-reds.json"
  assert.deepEqual(
    weakenings(
      "{}",
      '{"jobs:OWN-1": "the board hides imports"}',
      reds,
      "ratchet"
    ).map((w) => w.what),
    ["ratchet-raised"]
  )
  assert.deepEqual(weakenings('{"jobs:OWN-1": "x"}', "{}", reds, "ratchet"), [])
  const base = "scripts/guard-ledger.baseline.json"
  assert.deepEqual(
    weakenings(
      '["a.test.ts"]',
      '["a.test.ts", "b.test.ts"]',
      base,
      "ratchet"
    ).map((w) => w.what),
    ["ratchet-raised"]
  )
  assert.deepEqual(
    weakenings('["a.test.ts", "b.test.ts"]', '["a.test.ts"]', base, "ratchet"),
    []
  )
  assert.deepEqual(
    weakenings(
      '{"oversize": 3}',
      '{"oversize": 4}',
      "x-ratchet.json",
      "ratchet"
    ).map((w) => w.what),
    ["ratchet-raised"]
  )
})

test("limit bounds: looser is refused in each direction, tighter is free", () => {
  const limit = `export const EXPORT = defineLimit({
  honest: { uses: 5 },
  accepts: { oneKeyShare: 0.25, keysToDenyAll: 4, targetedDenialMs: 60_000 },
})
`
  const path = "packages/domain/src/limits/export.ts"
  for (const [from, to] of [
    ["uses: 5", "uses: 4"],
    ["oneKeyShare: 0.25", "oneKeyShare: 0.5"],
    ["keysToDenyAll: 4", "keysToDenyAll: 3"],
    ["targetedDenialMs: 60_000", "targetedDenialMs: 90_000"],
  ])
    assert.deepEqual(
      weakenings(limit, limit.replace(from, to), path, "bound").map(
        (w) => w.what
      ),
      ["bound-loosened"],
      to
    )
  for (const [from, to] of [
    ["uses: 5", "uses: 6"],
    ["oneKeyShare: 0.25", "oneKeyShare: 0.2"],
    ["keysToDenyAll: 4", "keysToDenyAll: 5"],
  ])
    assert.deepEqual(
      weakenings(limit, limit.replace(from, to), path, "bound"),
      [],
      to
    )
})

test("checker config: a quarantine entry added, a scanner dropped or a cap lowered is refused", () => {
  const quarantine = `export const quarantine: { file: string }[] = []
`
  assert.deepEqual(
    weakenings(
      quarantine,
      quarantine.replace("= []", '= [{ file: "a.test.ts" }]'),
      "apps/web/vitest.quarantine.ts",
      "checker-config"
    ).map((w) => w.what),
    ["ratchet-raised"]
  )
  const selection = `export const MAX_PER_RUNNER = 40
export const LOCAL_CAP = 25
export const TREE_SCANS = Object.freeze({
  "apps/api/src/registry/names.test.ts": [WEB_SRC, /^apps\\/api\\//],
})
`
  const path = "scripts/ocv-tools/jobs/test-selection.mjs"
  assert.deepEqual(
    weakenings(
      selection,
      selection.replace(", /^apps\\/api\\//", ""),
      path,
      "checker-config"
    ).map((w) => w.what),
    ["scanner-dropped"]
  )
  assert.deepEqual(
    weakenings(
      selection,
      selection.replace("LOCAL_CAP = 25", "LOCAL_CAP = 10"),
      path,
      "checker-config"
    ).map((w) => w.what),
    ["bound-loosened"]
  )
  assert.deepEqual(
    weakenings(
      selection,
      selection.replace("LOCAL_CAP = 25", "LOCAL_CAP = 30"),
      path,
      "checker-config"
    ),
    []
  )
  assert.deepEqual(
    weakenings("a", "b", "packages/guards/run-tests.mjs", "checker-config").map(
      (w) => w.what
    ),
    ["scanner-dropped"]
  )
})

test("a retirement clears the weakening it names, never an acceptance test, and needs a flip proof", () => {
  const removed = SPEC.replace(/  it\("refuses[^]*?\n  }\)\n/, "")
  const subject = `${T} > letter > refuses a letter that is too long`
  const r = one(T, SPEC, removed, [], [{ subject }])
  assert.deepEqual(r.weakened, [])
  assert.equal(r.retired[0].retiredBy, subject)
  const acceptance = "apps/api/src/acceptance/1500.letter.test.ts"
  assert.deepEqual(
    whats(one(acceptance, SPEC, removed, [], [{ subject: acceptance }])),
    ["case-removed"]
  )
  const facts = {
    retired: r.retired,
    retirements: [
      {
        subject,
        because: "b",
        replacedBy: "x.test.ts",
        proof: {
          replacedByBlob: "old",
          failedOnBase: true,
          passedOnHead: true,
        },
      },
    ],
    changed: [{ path: "x.test.ts", headBlob: "new" }],
  }
  assert.match(
    retirementProblems(facts)[0],
    /no flip proof for the current x\.test\.ts/
  )
  facts.retirements[0].proof.replacedByBlob = "new"
  assert.deepEqual(retirementProblems(facts), [])
  facts.retirements[0].replacedBy = "y.test.ts"
  assert.match(retirementProblems(facts)[0], /does not add or edit/)
  assert.match(
    retirementProblems({
      retired: [],
      retirements: [
        {
          subject: "z",
          because: "b",
          replacedBy: "x.test.ts",
          proof: {
            replacedByBlob: "new",
            failedOnBase: true,
            passedOnHead: true,
          },
        },
      ],
      changed: facts.changed,
    })[0],
    /retires nothing/
  )
})

test("the real past cases are refused: #1381 round 1 (D4) and #1435 round 1 (D52)", () => {
  const d4 = detect(fixture("d4-mistake.json")).map((w) => w.subject)
  assert.ok(
    d4.some((s) =>
      s.endsWith(
        "refuses a letter that needs more inserts than one save allows"
      )
    ),
    d4.join("\n")
  )
  const d52 = detect(fixture("d52-mistake.json")).map((w) => w.subject)
  assert.deepEqual(d52, [
    "apps/api/src/paper/import-parse-bounds.test.ts > paper import bounds > stores at most 200 KB of DOCX text and refuses a zip with too many entries",
  ])
  assert.deepEqual(detect(fixture("d4-clean.json")), [])
})

test("#1447 round 1 edited an expected dialog name, and #1475's known-reds list can grow by hand: both are refused", () => {
  const before = `import { expect, it } from "vitest"
it("keeps the delete action", () => {
  expect(
    screen.getByRole("dialog", { name: "Delete this file?" })
  ).toBeInTheDocument()
})
`
  const after = before.replace(
    '"Delete this file?"',
    "'Delete \"Original CV.pdf\"?'"
  )
  assert.equal(
    one(
      "apps/web/src/features/paper/paper-library-sections.test.tsx",
      before,
      after
    ).weakened.length,
    1
  )
  assert.equal(
    one(
      "apps/api/src/registry/owned-known-reds.json",
      "{}\n",
      '{ "jobs:OWN-1": "imports hidden" }\n'
    ).weakened[0].what,
    "ratchet-raised"
  )
})

test("a matcher that gains expected fields is tighter, and a JSON fixture that only gains keys is additive", () => {
  const was = `import { expect, it } from "vitest"
it("lists", () => { expect(page).toMatchObject({ name: "Page.docx" }) })
`
  assert.deepEqual(
    whats(
      one(
        T,
        was,
        was.replace(
          'name: "Page.docx" }',
          'name: "Page.docx", kind: "letter" }'
        )
      )
    ),
    []
  )
  assert.deepEqual(
    whats(
      one(
        T,
        was,
        was
          .replace("toMatchObject", "toBeDefined")
          .replace('{ name: "Page.docx" }', "")
      )
    ),
    ["expected-changed"]
  )
  const path = "scripts/tla/fixtures/Counter.tla.json"
  assert.deepEqual(
    weakenings('{"a": 1}', '{"a": 1, "covers": ["x"]}', path, "fixture"),
    []
  )
  assert.deepEqual(
    weakenings(
      '{"a": 1, "b": [1, 2]}',
      '{"a": 2, "b": [1]}',
      path,
      "fixture"
    ).map((w) => w.subject),
    [`${path}.a`, `${path}.b`]
  )
})
