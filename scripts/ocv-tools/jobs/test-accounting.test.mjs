import assert from "node:assert/strict"
import test from "node:test"
import { selectAndAccount } from "./affected-tests.mjs"
import { pushOk, realWorkspace, workspaceInput, world } from "./hook-world.mjs"
import { workspaceRunners } from "./test-runners.mjs"

const REAL = realWorkspace()
const account = (changed, tests = [], extra = {}) =>
  selectAndAccount({
    changed,
    tests,
    textOf: (file) => extra.texts?.[file] ?? "",
    workspace: workspaceInput({ ...REAL, ...extra.files }),
  })
const ruleOf = (selection) =>
  Object.fromEntries(selection.accounting.entries.map((e) => [e.file, e.rule]))
const proofIds = (selection) => selection.accounting.proofs.map((p) => p.id)
const ran = (selection) =>
  selection.groups.flatMap((g) => g.files.map((f) => f.file))

test("every workspace package with a test script gets a runner, read from the workspace definition", () => {
  const { packages, runners } = workspaceRunners(workspaceInput(REAL))
  assert.deepEqual(
    packages.map((p) => p.dir),
    [
      "apps/api",
      "apps/web",
      "packages/domain",
      "packages/guards",
      "packages/paper-crdt",
      "packages/ui",
    ]
  )
  assert.deepEqual(
    packages.filter((p) => !p.runner).map((p) => p.dir),
    []
  )
  const guards = runners.find((r) => r.name === "packages/guards")
  assert.deepEqual(
    [guards.cmd, guards.root, guards.flat],
    ["node", "packages/guards/", true]
  )
  const domain = runners.find((r) => r.name === "packages/domain")
  assert.deepEqual(domain.args.slice(0, 4), [
    "--experimental-strip-types",
    "--import",
    "./register-ts.mjs",
    "--test",
  ])
  assert.equal(domain.root, "packages/domain/src/")
})

test("the mistake fixtures no longer pass with zero tests: each change is sent to the run that proves it", () => {
  const cases = [
    [
      ["package.json", "pnpm-lock.yaml"],
      ["typecheck", "guards"],
    ],
    [[".githooks/pre-push"], ["guards"]],
    [["apps/web/tsconfig.app.json"], ["typecheck"]],
    [["turbo.json"], ["guards"]],
    [["apps/web/vite.config.ts"], ["test web"]],
    [["apps/api/drizzle.config.ts"], ["test api"]],
    [["apps/api/eslint.config.js"], ["lint"]],
    [["packages/guards/run-tests.mjs"], ["guards"]],
    [["scripts/ocv-tools/jobs/finish.mjs"], ["tools"]],
    [[".github/labels.yml"], ["guards"]],
    [["scripts/unreached-helper.mjs"], ["guards"]],
  ]
  for (const [changed, proofs] of cases) {
    const selection = account(changed)
    for (const id of proofs)
      assert.ok(
        proofIds(selection).includes(id),
        `${changed.join(", ")} needs ${id}, got ${proofIds(selection)}`
      )
  }
})

test("a change to a guards test runs it in the guards package, and only guards files run the guards suite", () => {
  const own = "packages/guards/test-completeness.test.mjs"
  const selection = account([own], [own, "packages/guards/run-tests.test.mjs"])
  assert.deepEqual(selection.groups, [
    {
      runner: "packages/guards",
      files: [{ file: own, why: "changed in this branch", rank: 0 }],
      dropped: [],
    },
  ])
  assert.deepEqual(ruleOf(selection), { [own]: "tests" })
  assert.deepEqual(proofIds(selection), [])
  const w = world({ changed: [own], tests: [own] })
  const r = w.call(["pre-push"], { stdin: pushOk })
  assert.equal(r.code, 0, r.text)
  const runs = w.s.calls.filter(
    (c) => c.cmd === "node" && c.args.includes("--test")
  )
  assert.deepEqual(
    runs.map((c) => [c.options.cwd, c.args.at(-1)]),
    [["/repo/packages/guards", "test-completeness.test.mjs"]]
  )
  assert.equal(w.receipts().length, 1)
})

test("a new package is read from its package.json: its tests run, and without a test script its files are unknown", () => {
  const files = {
    "packages/fresh/package.json": JSON.stringify({
      name: "@workspace/fresh",
      scripts: { test: "vitest run" },
    }),
  }
  const tested = account(
    ["packages/fresh/src/a.ts", "packages/fresh/src/a.test.ts"],
    ["packages/fresh/src/a.test.ts"],
    { files, texts: { "packages/fresh/src/a.test.ts": 'import "./a"\n' } }
  )
  assert.deepEqual(ran(tested), ["packages/fresh/src/a.test.ts"])
  assert.deepEqual(proofIds(tested), [])
  const bare = account(
    ["packages/bare/src/a.ts", "packages/bare/src/a.test.ts"],
    ["packages/bare/src/a.test.ts"],
    {
      files: {
        "packages/bare/package.json": JSON.stringify({
          name: "@workspace/bare",
        }),
      },
    }
  )
  assert.deepEqual(ran(bare), [])
  assert.equal(ruleOf(bare)["packages/bare/src/a.ts"], "unknown")
  assert.match(
    bare.accounting.entries[0].says,
    /@workspace\/bare has no test script/
  )
  assert.ok(proofIds(bare).length > 0)
})

test("a source file whose package ran no test is unknown and names the package suite", () => {
  const selection = account(["packages/paper-crdt/src/leaf.ts"])
  assert.equal(ruleOf(selection)["packages/paper-crdt/src/leaf.ts"], "unknown")
  assert.deepEqual(proofIds(selection), ["test @workspace/paper-crdt"])
  const covered = account(
    ["packages/paper-crdt/src/leaf.ts", "packages/paper-crdt/src/other.ts"],
    ["packages/paper-crdt/src/other.test.ts"],
    { texts: { "packages/paper-crdt/src/other.test.ts": 'import "./other"\n' } }
  )
  assert.equal(ruleOf(covered)["packages/paper-crdt/src/leaf.ts"], "package")
  assert.deepEqual(proofIds(covered), [])
})

test("the four real misses are still selected and each changed file is accounted for by its tests", () => {
  const cases = [
    [
      "apps/api/drizzle/0022_job_word_pages.sql",
      "apps/api/src/paper/photo-references.schema.test.ts",
    ],
    [
      "packages/ui/src/components/sonner.test.tsx",
      "apps/web/src/test/ui-kit-contract.test.ts",
    ],
    ["apps/api/src/auth-limits.ts", "apps/api/src/registry/ownership.test.ts"],
    [
      "apps/api/src/paper/commands.ts",
      "apps/api/src/registry/paper-contract.test.ts",
    ],
  ]
  for (const [changed, missed] of cases) {
    const selection = account([changed], [missed])
    assert.ok(ran(selection).includes(missed), missed)
    assert.equal(ruleOf(selection)[changed], "tests", changed)
    assert.deepEqual(proofIds(selection), [], changed)
  }
})

test("pre-push refuses to record a pass for a lockfile or hook change and names the command that proves it", () => {
  for (const changed of [
    ["package.json", "pnpm-lock.yaml"],
    [".githooks/pre-push"],
  ]) {
    const w = world({ changed })
    const r = w.call(["pre-push"], { stdin: pushOk })
    assert.equal(r.code, 2, r.text)
    assert.match(
      r.text,
      /REFUSED AFFECTED_TESTS: \d changed file\(s\) need more than the tests a push runs/
    )
    assert.match(r.text, /pnpm --filter @workspace\/guards test/)
    assert.match(r.text, /needs a larger run \(/)
    assert.deepEqual(w.receipts(), [])
    const checked = w.cli(["check"])
    assert.equal(checked.code, 0, checked.text)
    assert.ok(
      w.s.calls.some(
        (c) =>
          c.cmd === "pnpm" &&
          c.args.join(" ") === "--filter @workspace/guards test"
      )
    )
    assert.equal(w.receipts().length, 1)
  }
})

test("a docs-only change records a pass and prints the reason it has no tests", () => {
  const w = world({ changed: ["docs/agents/design-parity.md"] })
  const r = w.call(["pre-push"], { stdin: pushOk })
  assert.equal(r.code, 0, r.text)
  assert.match(
    r.text,
    /docs\/agents\/design-parity\.md: no tests by nature \(Markdown under docs\/ is prose/
  )
  assert.equal(w.receipts().length, 1)
  const readme = world({ changed: ["README.md"] })
  assert.equal(readme.call(["pre-push"], { stdin: pushOk }).code, 2)
})

test("the receipt is keyed by rule version, tree and commit, and untracked files block it", () => {
  const w = world({ changed: ["docs/a.md"], tree: "t1" })
  w.call(["pre-push"], { stdin: pushOk })
  assert.deepEqual(w.receipts(), [
    "/repo/.git/ocv-tools-affected-tests-v3-t1-abc",
  ])
  const untracked = world({
    changed: ["docs/a.md"],
    worktreeDirty: "?? apps/web/src/new.ts",
  })
  const r = untracked.call(["pre-push"], { stdin: pushOk })
  assert.match(r.text, /unsaved edits or untracked files, so no receipt/)
  assert.deepEqual(untracked.receipts(), [])
  assert.ok(
    untracked.s.calls.some(
      (c) => c.cmd === "git" && c.args.join(" ") === "status --porcelain -z"
    ),
    "the dirty check must include untracked files"
  )
})
