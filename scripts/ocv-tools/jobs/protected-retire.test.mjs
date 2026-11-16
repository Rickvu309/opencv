import assert from "node:assert/strict"
import test from "node:test"
import { coversSubject, judge, kindOf } from "./protected.mjs"
import { failedOnAssertion, flipProof } from "./retire.mjs"
import { retiredLines } from "../rules/protected.mjs"

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

test("the flip proof restores changed source files from the fork point, runs the replacement there and on the head, and puts the head back", () => {
  const calls = []
  const outcomes = [
    { ok: false, out: "AssertionError: expected 1 to be 2", err: "" },
    { ok: true, out: "pass", err: "" },
  ]
  const ctx = {
    cwd: "/w",
    ports: {
      proc: {
        run(cmd, args) {
          calls.push(`${cmd} ${args.join(" ")}`)
          return cmd === "git" ? { ok: true, out: "" } : outcomes.shift()
        },
      },
    },
  }
  const proof = flipProof(ctx, "/w", {
    fork: "f0",
    replacedBy: "apps/web/src/a.test.ts",
    command: {
      cmd: "vitest",
      args: ["run", "src/a.test.ts"],
      cwd: "/w/apps/web",
    },
    changed: [
      { path: "apps/web/src/a.ts", baseBlob: "1", headBlob: "2" },
      { path: "apps/web/src/a.test.ts", baseBlob: "3", headBlob: "4" },
      { path: "apps/web/src/new.ts", baseBlob: null, headBlob: "5" },
      { path: "scripts/retired/9.json", baseBlob: "6", headBlob: "7" },
    ],
  })
  assert.deepEqual(calls, [
    "git checkout f0 -- apps/web/src/a.ts",
    "vitest run src/a.test.ts",
    "git checkout HEAD -- apps/web/src/a.ts",
    "vitest run src/a.test.ts",
  ])
  assert.equal(proof.failedOnBase, true)
  assert.equal(proof.passedOnHead, true)
  assert.equal(
    failedOnAssertion("Error: Cannot find module './a.ts'\nFAIL"),
    false
  )
})

test("a retirement is self-serve only with a replacement on the same subject; no replacement or a standing promise is classified without self-serve proof", () => {
  const removed = SPEC.replace(/  it\("refuses[^]*?\n  }\)\n/, "")
  const subject = `${T} > letter > refuses a letter that is too long`
  const classOf = (retirement) =>
    one(T, SPEC, removed, [], [{ subject, ...retirement }]).retired[0]
  assert.equal(classOf({ replacedBy: T }).class, "self")
  assert.deepEqual(
    [
      classOf({ replacedBy: null }).class,
      classOf({ replacedBy: null }).because,
    ],
    ["owner", "no replacement test"]
  )
  const sibling = "apps/web/src/features/paper/letter-limits.test.ts"
  const importing = (from) => `import { expect, it } from "vitest"
import { save } from "${from}"
it("keeps a long letter", () => { expect(save(long)).toBe(true) })
`
  const withSpec = SPEC.replace(
    'import { describe, expect, it } from "vitest"',
    'import { describe, expect, it } from "vitest"\nimport { save } from "./letter-save"'
  )
  const cut = withSpec.replace(/  it\("refuses[^]*?\n  }\)\n/, "")
  const covered = one(
    T,
    withSpec,
    cut,
    [{ path: sibling, baseText: null, headText: importing("./letter-save") }],
    [{ subject, replacedBy: sibling }]
  ).retired[0]
  assert.equal(covered.class, "self")
  const elsewhere = one(
    T,
    withSpec,
    cut,
    [{ path: sibling, baseText: null, headText: importing("./other") }],
    [{ subject, replacedBy: sibling }]
  ).retired[0]
  assert.equal(elsewhere.class, "owner")
  assert.match(elsewhere.because, /shares no module, command or route/)
  const reds = "apps/api/src/registry/owned-known-reds.json"
  const grown = one(
    reds,
    "{}",
    '{"jobs:OWN-1": "x"}',
    [],
    [{ subject: reds, replacedBy: T }]
  ).retired[0]
  assert.deepEqual(
    [grown.class, grown.because],
    ["owner", "ratchet-raised (ratchet)"]
  )
  assert.ok(
    coversSubject(
      "a/x.test.ts",
      'run("paper.create")',
      "b/y.test.ts",
      'call("paper.create")'
    )
  )
  assert.deepEqual(
    retiredLines({ retired: [covered, { ...grown, retiredBy: reds }] }),
    [
      `Retired 1 checks with replacements: ${subject}`,
      `Retired 1 checks without self-serve replacement proof: ${reds} (ratchet-raised (ratchet))`,
    ]
  )
})

const USAGE = [
  'import assert from "node:assert/strict"',
  'import test from "node:test"',
  'test("unknown screens are usage errors", async () => {',
  '  assert.match((await runUi(["check", "settings"])).lines[0], /add rows to the design map/)',
  "})",
  "",
].join("\n")

const WRAPPED = [
  'import assert from "node:assert/strict"',
  'import test from "node:test"',
  'test("stale output fires", () => {',
  '  assert.equal(detect(clean, "stale")[0].kind, "stale-output")',
  "})",
  "",
].join("\n")

const TABLE = [
  'import test from "node:test"',
  'import assert from "node:assert/strict"',
  "const check = (id, message) => { assert.equal(evaluate(id), message) }",
  'test("every rule", () => {',
  '  check("MIGRATION_CHANGES", "the merge runs 0022")',
  "})",
  "",
].join("\n")

const WALK = [
  'import { it } from "vitest"',
  "it(`keeps I1 to I4 over ${SEEDS} seeds`, async () => {",
  "  const failure = await walk(steps)",
  "  if (failure) throw new Error(`seed ${seed}: ${failure}`)",
  "})",
  "",
].join("\n")

test("refactors seen on main stay quiet: an input swapped under the same expected message, a re-wrapped equality, a case folded into an imported table, a throw kept under a renamed case", () => {
  assert.deepEqual(
    whats(
      one(
        "scripts/ui/cli.test.mjs",
        USAGE,
        USAGE.replace('"settings"', '"coach-home"')
      )
    ),
    []
  )
  assert.deepEqual(
    whats(
      one(
        "scripts/catalog.test.mjs",
        WRAPPED,
        WRAPPED.replace(
          'assert.equal(detect(clean, "stale")[0].kind, "stale-output")',
          'assert.deepEqual(staleKinds(fresh), [["stale-output", file]])'
        )
      )
    ),
    []
  )
  const folded = TABLE.replace(
    'import assert from "node:assert/strict"',
    'import assert from "node:assert/strict"\nimport { CASES } from "./cases.mjs"'
  ).replace(
    '  check("MIGRATION_CHANGES", "the merge runs 0022")',
    "  for (const [id, message] of CASES) check(id, message)"
  )
  assert.deepEqual(
    whats(
      one("scripts/rules.test.mjs", TABLE, folded, [
        {
          path: "scripts/cases.mjs",
          baseText: null,
          headText:
            'export const CASES = [["MIGRATION_CHANGES", "the merge runs 0022"]]\n',
        },
      ])
    ),
    []
  )
  assert.deepEqual(
    whats(one(T, WALK, WALK.replace("I1 to I4", "I1 to I5"))),
    []
  )
  assert.deepEqual(
    whats(one(T, WALK, WALK.replace(/  if \(failure\)[^\n]*\n/, ""))),
    ["assertion-removed"]
  )
  assert.deepEqual(
    whats(
      one(
        T,
        WALK,
        WALK.replace("I1 to I4", "I1 to I5").replace(
          /  if \(failure\)[^\n]*\n/,
          ""
        )
      )
    ),
    ["case-removed"]
  )
})
