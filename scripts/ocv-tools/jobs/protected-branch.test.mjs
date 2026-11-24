import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { branchVerdict, guardsRefusals } from "./protected-facts.mjs"

const root = fileURLToPath(new URL("../../..", import.meta.url))

const cleanEnv = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))
  )

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, {
    cwd: options.cwd ?? root,
    env: cleanEnv(),
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: 120_000,
  })
  return {
    ok: r.status === 0,
    out: options.raw ? (r.stdout ?? "") : (r.stdout ?? "").trim(),
    err: (r.stderr ?? "").trim(),
  }
}

const ctx = { cwd: root, ports: { proc: { run } } }

const refusals = guardsRefusals

test("this branch weakens no protected check without a proved retirement, and each recorded class is the one the judge computes", () => {
  assert.deepEqual(
    refusals(branchVerdict(ctx, "origin/main", "HEAD", { cwd: root })),
    []
  )
})

const PAST = [
  [
    "#1381 round 1 (D4)",
    "ea5b270c015d34190d797e8e87dadef826d8afa5",
    /refuses a letter that needs more inserts than one save allows/,
  ],
  [
    "#1435 round 1 (D52)",
    "7b79a562e4fec699fefa81434c98b3ecdee0a882",
    /refuses a zip with too many entries/,
  ],
  [
    "#1447 round 1",
    "db5cdc3f9bb96e8bed27ea2985108aac40d50103",
    /Delete this file\?/,
  ],
]

test("the same judge refuses the real past weakenings replayed from git: D4, D52 and the edited dialog name of #1447", () => {
  for (const [name, sha, expected] of PAST) {
    assert.ok(
      run("git", ["cat-file", "-e", `${sha}^{commit}`]).ok,
      `${name}: ${sha} is not in this clone; fetch the guard-proof tags`
    )
    const fork = run("git", ["merge-base", "origin/main", sha]).out
    const facts = branchVerdict(ctx, fork, sha, { cwd: root })
    assert.match(
      facts.weakened.map((item) => item.subject).join("\n"),
      expected,
      name
    )
    assert.match(refusals(facts).join("\n"), /^PROTECTED_WEAKENED: /, name)
  }
})
