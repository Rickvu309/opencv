import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { realRun } from "./core.mjs"
import { slugify } from "./worktree.mjs"
import { fakeCtx, issueData, tempClone } from "./fake-ctx.mjs"

const ghRules = (data, extra = []) => [
  ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
  ["api graphql", data],
  ["api user", "me"],
  ["issue edit", ""],
  ["issue comment", ""],
  ...extra,
]

function realCtx(t, rules, env = {}) {
  const fake = fakeCtx(rules, {
    env: {
      PR_DISK_MIN_MB: "1",
      HOME: join(t.root, "home"),
      TMPDIR: t.root,
      PR_RESULT_DIR: join(t.root, "results"),
      ...env,
    },
  })
  return {
    ...fake,
    cwd: t.work,
    writeFile: (p, text) =>
      realRun("sh", ["-c", `printf %s "$1" > "$2"`, "_", text, p]),
    readFile: (p) => readFileSync(p, "utf8"),
    run: (cmd, args, options) =>
      cmd === "gh" ? fake.run(cmd, args) : realRun(cmd, args, options),
    ghCalls: fake.calls,
  }
}

test("slugify keeps the first five words", () => {
  assert.equal(
    slugify("Keep my search: now, please! Really long"),
    "keep-my-search-now-please"
  )
  assert.equal(slugify("!!!"), "")
})

test("take builds the branch, worktree, .env, port record, claim and result", () => {
  const t = tempClone()
  try {
    const ctx = realCtx(t, ghRules(issueData()))
    const r = runCli(["take", "90", "--no-install"], ctx)
    assert.equal(r.code, 0, r.text)
    const wt = join(t.root, "opencv.worktrees", "90-keep-my-search")
    assert.match(r.text, new RegExp(`Worktree: ${wt}`))
    assert.match(r.text, /Branch: feat\/90-keep-my-search/)
    assert.match(r.text, /Port: 4090 /)
    assert.match(readFileSync(join(wt, ".env"), "utf8"), /^PORT=4090$/m)
    assert.equal(
      t.sh(wt, "rev-parse", "--abbrev-ref", "HEAD").trim(),
      "feat/90-keep-my-search"
    )
    assert.equal(t.sh(t.work, "config", "core.hooksPath"), ".githooks\n")
    const gitDir = t.sh(wt, "rev-parse", "--absolute-git-dir").trim()
    assert.equal(
      readFileSync(join(gitDir, "assigned-port"), "utf8").trim(),
      "4090"
    )
    assert.match(
      readFileSync(join(gitDir, "ocv-tools-agent"), "utf8"),
      /^agent-/
    )
    assert.ok(
      ctx.ghCalls.some((c) => c.includes("issue edit 90 --add-assignee @me"))
    )
    assert.ok(
      ctx.ghCalls.some(
        (c) => c.includes("issue comment 90") && c.includes("ocv-tools claim")
      )
    )
    const last = r.text.split("\n").at(-1)
    assert.match(last, /^RESULT_JSON: .*opencv-new-task-feat-90\.json$/)
    const json = JSON.parse(readFileSync(last.slice(13), "utf8"))
    assert.equal(json.status, "ok")
    assert.equal(json.script, "new-task")
    // a second take finds the worktree
    assert.match(
      runCli(["take", "90", "--no-install"], realCtx(t, ghRules(issueData())))
        .text,
      /REFUSED WORKTREE_EXISTS/
    )
  } finally {
    t.done()
  }
})

test("take picks the next free port when another worktree holds the first", () => {
  const t = tempClone()
  try {
    const first = realCtx(t, ghRules(issueData()))
    runCli(["take", "90", "--no-install"], first)
    const second = realCtx(
      t,
      ghRules(issueData({ title: "feat: Other thing here", number: 1090 }))
    )
    const r = runCli(["take", "1090", "--no-install"], second)
    assert.match(r.text, /Port: 4091 /, r.text)
  } finally {
    t.done()
  }
})

test("take refuses on low disk before touching gh writes, git or the worktree, and records cause disk", () => {
  const t = tempClone()
  try {
    const ctx = realCtx(t, ghRules(issueData()), {
      PR_DISK_MIN_MB: "999999999",
    })
    const r = runCli(["take", "90"], ctx)
    assert.equal(r.code, 2)
    assert.match(r.text, /REFUSED DISK: only \d+ MiB free/)
    assert.ok(!existsSync(join(t.root, "opencv.worktrees")))
    assert.ok(
      !ctx.ghCalls.some(
        (c) => c.includes("issue edit") || c.includes("issue comment")
      )
    )
    const json = JSON.parse(
      readFileSync(r.text.split("\n").at(-1).slice(13), "utf8")
    )
    assert.equal(json.status, "fail")
    assert.equal(json.cause, "disk")
  } finally {
    t.done()
  }
})

test("take --take overrides another assignee; a branch already on origin is refused", () => {
  const t = tempClone()
  try {
    const data = issueData({ assignees: { nodes: [{ login: "someone" }] } })
    t.sh(
      t.work,
      "push",
      "-q",
      "origin",
      "main:refs/heads/feat/90-keep-my-search"
    )
    const dup = runCli(
      ["take", "90", "--take", "--no-install"],
      realCtx(t, ghRules(data))
    )
    assert.match(dup.text, /REFUSED BRANCH_EXISTS.*origin/)
    t.sh(t.work, "push", "-q", "origin", ":refs/heads/feat/90-keep-my-search")
    const ok = runCli(
      ["take", "90", "--take", "--no-install", "-d", "my own words here"],
      realCtx(t, ghRules(data))
    )
    assert.equal(ok.code, 0, ok.text)
    assert.match(ok.text, /Branch: feat\/90-my-own-words-here/)
  } finally {
    t.done()
  }
})

test("take with a title files the issue first, then takes it", () => {
  const t = tempClone()
  try {
    const rules = ghRules(issueData(), [
      ["issue list", "[]"],
      ["issue create", "https://github.com/o/r/issues/90"],
    ])
    const ctx = realCtx(t, [rules[0], ...rules.slice(1).filter(Boolean)])
    const r = runCli(
      [
        "take",
        "feat: Keep my search",
        "--what",
        "The page forgets your search. This keeps it.",
        "--done",
        "- I come back and the box still has my words.",
        "--risk",
        "low",
        "--no-install",
      ],
      ctx
    )
    assert.equal(r.code, 0, r.text)
    assert.ok(
      ctx.ghCalls.findIndex((c) => c.includes("issue create")) <
        ctx.ghCalls.findIndex((c) => c.includes("issue comment"))
    )
    assert.match(r.text, /Branch: feat\/90-keep-my-search/)
  } finally {
    t.done()
  }
})
