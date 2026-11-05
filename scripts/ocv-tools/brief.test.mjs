import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { FENCES_FILE, RULES_FILE, parseFences } from "./brief.mjs"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts, issue } from "./ports/fake.mjs"

const WORKTREE = "/tmp/opencv.worktrees/90-keep-my-search"
const ROLES = ["build", "mechanical", "review", "plan"]

function run(args, world = {}) {
  const ports = fakePorts({
    issues: [issue(90, { title: "feat: Keep my search" })],
    worktrees: [{ path: WORKTREE, branch: "feat/90-keep-my-search" }],
    files: { [`${WORKTREE}/.env`]: "PORT=4090\n" },
    ...world,
  })
  return runCli(args, ctxFor(ports))
}

test("brief prints AGENTS.md for every role", () => {
  const rules = readFileSync(RULES_FILE, "utf8")
  for (const role of ROLES) {
    const { code, text } = run(["brief", "90", "--role", role])
    assert.equal(code, 0)
    assert.ok(text.includes(`\nRules:\n${rules}`))
  }
})

test("brief reads rules through the filesystem port", () => {
  const rules = "# Project rules\n\nUse the assigned worktree.\n"
  const { code, text } = run(["brief", "90", "--role", "build"], {
    files: { [RULES_FILE]: rules },
  })
  assert.equal(code, 0)
  assert.ok(text.includes(`\nRules:\n${rules}`))
})

test("review and plan briefs identify their read-only mode", () => {
  for (const role of ["review", "plan"]) {
    const { text } = run(["brief", "90", "--role", role], { worktrees: [] })
    assert.match(text, /^Mode: read only$/m)
    assert.match(text, /^Worktree: none \(read only\)$/m)
    assert.doesNotMatch(text, /^Worktree: none yet;/m)
  }
  for (const role of ["build", "mechanical"]) {
    const { text } = run(["brief", "90", "--role", role], { worktrees: [] })
    assert.doesNotMatch(text, /^Mode: read only$/m)
    assert.match(
      text,
      /^Worktree: none yet; run scripts\/ocv-tools\.mjs take 90$/m
    )
  }
})

test("each role gets its model and tool budget", () => {
  const expected = {
    build: { model: "opus", budget: 60 },
    mechanical: { model: "haiku", budget: 40 },
    review: { model: "opus", budget: 40 },
    plan: { model: "opus", budget: 40 },
  }
  for (const [role, { model, budget }] of Object.entries(expected)) {
    const { code, text } = run(["brief", "90", "--role", role])
    assert.equal(code, 0)
    assert.match(text, new RegExp(`^Model: ${model}$`, "m"))
    assert.match(text, new RegExp(`^Tool budget: ${budget} calls$`, "m"))
  }
})

test("brief names the worktree and port of the task", () => {
  const { text } = run(["brief", "90", "--role", "build"])
  assert.match(text, /Task: #90 feat: Keep my search/)
  assert.ok(
    text.includes(`Worktree: ${WORKTREE} (branch feat/90-keep-my-search)`)
  )
  assert.match(text, /Port: 4090 \(api on 4090, web on 5090\)/)
})

test("brief says so when the issue has no worktree yet", () => {
  const { text } = run(["brief", "90", "--role", "build"], { worktrees: [] })
  assert.match(text, /Worktree: none yet; run scripts\/ocv-tools.mjs take 90/)
  assert.match(text, /Port: none yet/)
})

const PAPER_FENCE = {
  fences: [
    {
      issue: 916,
      expires: "2026-12-01",
      paths: ["apps/web/src/features/paper/**"],
    },
  ],
}

test("the shipped fence holds the #1041 paths and an expiry date", () => {
  const raw = readFileSync(FENCES_FILE, "utf8")
  const [fence] = JSON.parse(raw).fences
  assert.equal(fence.issue, 1041)
  assert.match(fence.expires, /^\d{4}-\d{2}-\d{2}$/)
  const { active } = parseFences(raw, Date.parse("2026-11-03T00:00:00Z"))
  const paths = active.map((entry) => entry.path)
  for (const path of [
    "apps/web/src/features/paper/**",
    "apps/api/src/paper/**",
    "apps/web/src/features/coach/chat-api.ts",
    "apps/web/src/lib/paper-selection.ts",
    "apps/web/src/lib/paper-sync*",
    "apps/web/src/test/paper-fixture.ts",
    "apps/api/src/test/paper-client.ts",
    "packages/domain/src/paper-doc/**",
    "packages/paper-crdt/**",
    "apps/web/package.json",
    "apps/web/src/routes/paper-doc.tsx",
  ])
    assert.ok(paths.includes(path), path)
})

test("brief prints the shipped fence before its expiry", () => {
  const { text } = run(["brief", "90", "--role", "build"])
  assert.match(text, /^Fenced paths \(never edit\):$/m)
  assert.match(text, /^ {2}apps\/api\/src\/paper\/\*\* \(issue #1041\)$/m)
})

test("fenced paths come from the file and an expired fence is dropped", () => {
  const files = { [FENCES_FILE]: JSON.stringify(PAPER_FENCE) }
  const live = run(["brief", "90", "--role", "build"], { files })
  assert.match(live.text, /^Fenced paths \(never edit\):$/m)
  assert.match(
    live.text,
    /^ {2}apps\/web\/src\/features\/paper\/\*\* \(issue #916\)$/m
  )
  const expired = run(["brief", "90", "--role", "build"], {
    now: Date.parse("2026-12-02T00:00:00Z"),
    files,
  })
  assert.match(expired.text, /^Fenced paths: none$/m)
  assert.doesNotMatch(expired.text, /features\/paper/)
  assert.match(expired.text, /Fence for #916 expired on 2026-12-01/)
})

test("a fence with no expiry date is refused", () => {
  const { code, text } = run(["brief", "90", "--role", "build"], {
    files: {
      [FENCES_FILE]: JSON.stringify({
        fences: [{ issue: 916, paths: ["apps/api/src/paper/**"] }],
      }),
    },
  })
  assert.equal(code, 1)
  assert.match(text, /needs "expires"/)
})

test("brief refuses an unknown or missing role", () => {
  for (const args of [
    ["brief", "90", "--role", "boss"],
    ["brief", "90"],
  ]) {
    const { code, text } = run(args)
    assert.equal(code, 1)
    assert.match(text, /build\|mechanical\|review\|plan/)
  }
})

test("brief refuses a number that is not an issue", () => {
  assert.notEqual(run(["brief", "555", "--role", "build"]).code, 0)
})
