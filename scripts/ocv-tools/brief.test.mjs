import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  FENCES_FILE,
  RULES_FILE,
  keepOpenFences,
  parseFences,
} from "./brief.mjs"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts, issue } from "./ports/fake.mjs"

const WORKTREE = "/tmp/opencv.worktrees/90-keep-my-search"
const ROLES = ["build", "mechanical", "review", "plan"]

const NO_FENCES = JSON.stringify({ fences: [] })

function run(args, world = {}) {
  const ports = fakePorts({
    issues: [issue(90, { title: "feat: Keep my search" })],
    worktrees: [{ path: WORKTREE, branch: "feat/90-keep-my-search" }],
    ...world,
    files: {
      [`${WORKTREE}/.env`]: "PORT=4090\n",
      [FENCES_FILE]: NO_FENCES,
      ...world.files,
    },
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

test("the shipped fence file fences the old Paper core for #2207 until 2027-03-31", () => {
  const fences = JSON.parse(readFileSync(FENCES_FILE, "utf8")).fences
  assert.deepEqual(fences, [
    {
      issue: 2207,
      expires: "2027-03-31",
      paths: [
        "apps/web/src/features/paper/rich-editor/**",
        "apps/api/src/paper/content/**",
        "apps/api/src/paper/native-output/**",
      ],
    },
  ])
})

test("a brief prints the shipped fence while its issue is open", () => {
  const { code, text } = run(["brief", "90", "--role", "build"], {
    files: { [FENCES_FILE]: readFileSync(FENCES_FILE, "utf8") },
    issues: [
      issue(90, { title: "feat: Keep my search" }),
      issue(2207, { title: "chore: Track the Paper core rebuild" }),
    ],
  })
  assert.equal(code, 0, text)
  assert.match(
    text,
    /^ {2}apps\/web\/src\/features\/paper\/rich-editor\/\*\* \(issue #2207\)$/m
  )
  assert.match(
    text,
    /^ {2}apps\/api\/src\/paper\/native-output\/\*\* \(issue #2207\)$/m
  )
})

test("a brief prints no shipped fence", () => {
  const { text } = run(["brief", "90", "--role", "build"])
  assert.match(text, /^Fenced paths: none$/m)
  assert.doesNotMatch(text, /#1041/)
})

test("a fence for a closed issue is not printed", () => {
  const files = { [FENCES_FILE]: JSON.stringify(PAPER_FENCE) }
  const closed = run(["brief", "90", "--role", "build"], {
    files,
    issues: [
      issue(90, { title: "feat: Keep my search" }),
      issue(916, { state: "CLOSED", title: "old writing fence" }),
    ],
  })
  assert.equal(closed.code, 0, closed.text)
  assert.match(closed.text, /^Fenced paths: none$/m)
  assert.doesNotMatch(closed.text, /features\/paper/)
  assert.match(closed.text, /Fence for #916 is closed and is not listed/)
  const parsed = parseFences(
    JSON.stringify(PAPER_FENCE),
    Date.parse("2026-11-03T00:00:00Z")
  )
  const kept = keepOpenFences(parsed.active, () => "CLOSED")
  assert.equal(kept.open.length, 0)
  assert.deepEqual(kept.closed, [{ issue: 916 }])
})

test("fenced paths come from the file and an expired fence is dropped", () => {
  const files = { [FENCES_FILE]: JSON.stringify(PAPER_FENCE) }
  const issues = [
    issue(90, { title: "feat: Keep my search" }),
    issue(916, { title: "writing fence" }),
  ]
  const live = run(["brief", "90", "--role", "build"], { files, issues })
  assert.match(live.text, /^Fenced paths \(never edit\):$/m)
  assert.match(
    live.text,
    /^ {2}apps\/web\/src\/features\/paper\/\*\* \(issue #916\)$/m
  )
  const expired = run(["brief", "90", "--role", "build"], {
    now: Date.parse("2026-12-02T00:00:00Z"),
    files,
    issues,
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
