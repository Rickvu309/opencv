import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { tempDir } from "../lib/temp-dir.mjs"

const root = fileURLToPath(new URL("../..", import.meta.url))
const COPIED =
  /^(?:scripts\/|packages\/domain\/|packages\/guards\/|\.github\/|pnpm-workspace\.yaml$)|(?:^|\/)package\.json$/
const MISSING = /Cannot find module|ERR_MODULE_NOT_FOUND|Cannot find package/

const cleanEnv = (extra = {}) => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith("GIT_") &&
        key !== "NODE_PATH" &&
        key !== "NODE_OPTIONS" &&
        key !== "NODE_TEST_CONTEXT" &&
        key !== "GITHUB_ACTIONS"
    )
  )
  return { ...env, ...extra }
}

function run(cmd, args, { cwd, env = {}, input } = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    env: cleanEnv(env),
    input,
    encoding: "utf8",
    timeout: 120_000,
  })
  return {
    status: r.status,
    out: `${r.stdout ?? ""}${r.stderr ?? ""}`,
  }
}

const FAKE_GH = `#!/usr/bin/env node
const args = process.argv.slice(2)
if (args[0] === "pr" && args[1] === "view") console.log(process.env.FAKE_PR)
else if (args[0] === "issue" && args[1] === "view")
  console.log(JSON.stringify({ state: "OPEN", labels: [] }))
else if (args[0] === "repo") console.log("o/r")
else console.log("[]")
`

function world(t) {
  const dir = tempDir(t, "no-packages-")
  const tracked = run("git", ["ls-files", "-z"], { cwd: root })
  assert.equal(tracked.status, 0, tracked.out)
  for (const path of tracked.out.split("\0")) {
    if (!COPIED.test(path) || !existsSync(join(root, path))) continue
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    copyFileSync(join(root, path), join(dir, path))
  }
  mkdirSync(join(dir, "bin"))
  writeFileSync(join(dir, "bin", "gh"), FAKE_GH)
  chmodSync(join(dir, "bin", "gh"), 0o755)
  const repo = join(dir, "repo")
  mkdirSync(repo)
  const git = (...args) => {
    const r = run("git", args, { cwd: repo })
    assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.out}`)
    return r.out.trim()
  }
  const write = (path, text) => {
    mkdirSync(join(repo, path, ".."), { recursive: true })
    writeFileSync(join(repo, path), text)
  }
  git("init", "-q", "-b", "main")
  if (run("git", ["config", "user.email"], { cwd: repo }).status !== 0) {
    git("config", "user.email", "t@example.com")
    git("config", "user.name", "t")
  }
  write("lib/price.mjs", "export const price = (n) => n * 2\n")
  write(
    "lib/price.test.mjs",
    'import assert from "node:assert/strict"\nimport test from "node:test"\nimport { price } from "./price.mjs"\ntest("doubles a price", () => {\n  assert.equal(price(2), 4)\n})\n'
  )
  git("add", "-A")
  git("commit", "-q", "-m", "base")
  git("update-ref", "refs/remotes/origin/main", "HEAD")
  write("lib/price.mjs", "export const price = (n) => n * 3\n")
  write(
    "lib/price.test.mjs",
    'import test from "node:test"\ntest("prices exist", () => {})\n'
  )
  write(
    "scripts/retired/7.json",
    `${JSON.stringify(
      [
        {
          subject: "lib/price.test.mjs > doubles a price",
          because: "prices are set elsewhere",
          replacedBy: null,
          class: "owner",
          classBecause: "no replacement test",
          items: 1,
        },
      ],
      null,
      2
    )}\n`
  )
  git("add", "-A")
  git("commit", "-q", "-m", "chore: drop the doubling test (#7)")
  const head = git("rev-parse", "HEAD")
  const pr = (labels) =>
    JSON.stringify({
      number: 7,
      url: "https://github.com/o/r/pull/7",
      state: "OPEN",
      title: "chore: drop the doubling test (#7)",
      body: "Closes #7\n\n**Now:** The doubling check is retired.\n**Proof:** `node --test scripts/prices.test.mjs`: 1 pass.\n",
      author: { login: "rickvu" },
      isDraft: false,
      labels: labels.map((name) => ({ name })),
      headRefOid: head,
      headRefName: "chore/7-drop-doubling",
      baseRefName: "main",
      mergeCommit: null,
      closingIssuesReferences: [{ number: 7 }],
      autoMergeRequest: null,
    })
  const tool = (args, env = {}) =>
    run("node", [join(dir, "scripts", "ocv-tools.mjs"), ...args], {
      cwd: repo,
      env: { PATH: `${join(dir, "bin")}:${process.env.PATH}`, ...env },
    })
  return { dir, repo, pr, tool }
}

test("the copy cannot see any installed package, so the checks below are not vacuous", (t) => {
  const { dir } = world(t)
  const r = run(
    "node",
    ["--input-type=module", "-e", 'await import("typescript")'],
    { cwd: join(dir, "scripts") }
  )
  assert.notEqual(r.status, 0)
  assert.match(r.out, MISSING)
})

test("policy runs with Node alone and passes a recorded retirement without approval", (t) => {
  const w = world(t)
  const without = w.tool(["policy", "7"], { FAKE_PR: w.pr([]) })
  assert.doesNotMatch(without.out, MISSING)
  assert.equal(without.status, 0, without.out)
  assert.match(without.out, /PR #7 passes the server-held rules\./)
  assert.match(
    without.out,
    /Retired 1 checks without self-serve replacement proof: lib\/price\.test\.mjs > doubles a price \(no replacement test\)/
  )
})

test("the other verbs and scripts ci runs before installing load with Node alone", (t) => {
  const w = world(t)
  const choice = run(
    "node",
    [join(w.dir, "scripts", "lib", "ci-workflow.mjs"), "policy"],
    {
      cwd: w.repo,
      env: { GITHUB_EVENT_NAME: "pull_request", PR_NUMBER: "7" },
    }
  )
  assert.equal(choice.out.trim(), "run:7", choice.out)
  for (const r of [
    w.tool(["why", "7"], { FAKE_PR: w.pr([]) }),
    w.tool(["help"]),
    run("node", [join(w.dir, "scripts", "ci-first-errors.mjs")], {
      cwd: w.repo,
      env: { NEEDS: "{}" },
    }),
  ])
    assert.doesNotMatch(r.out, MISSING)
})

test("without the TypeScript parser the judge refuses in plain words and never passes", (t) => {
  const w = world(t)
  const script = `
const { branchVerdict } = await import(${JSON.stringify(join(w.dir, "scripts/ocv-tools/jobs/protected-facts.mjs"))})
const { evaluate } = await import(${JSON.stringify(join(w.dir, "scripts/ocv-tools/rules/index.mjs"))})
const { spawnSync } = await import("node:child_process")
const run = (cmd, args, o = {}) => { const r = spawnSync(cmd, args, { cwd: o.cwd ?? process.cwd(), encoding: "utf8", timeout: 60000 }); return { ok: r.status === 0, out: o.raw ? r.stdout : r.stdout.trim(), err: r.stderr } }
const facts = branchVerdict({ cwd: process.cwd(), ports: { proc: { run } } }, "origin/main", "HEAD")
const hit = evaluate("PROTECTED_WEAKENED", { protected: facts })
console.log(hit ? hit.message : "PASSED")
`
  const r = run("node", ["--input-type=module", "-e", script], { cwd: w.repo })
  assert.equal(r.status, 0, r.out)
  assert.doesNotMatch(r.out, /PASSED|\n\s+at /)
  assert.match(r.out, /the TypeScript parser is not installed here/)
})
