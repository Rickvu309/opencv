import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  FENCES_FILE,
  RULES_FILE,
  parseFences,
  parseRoles,
  parseRules,
} from "./brief.mjs"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts, issue } from "./ports/fake.mjs"

const WORKTREE = "/tmp/opencv.worktrees/90-keep-my-search"

function run(args, world = {}) {
  const ports = fakePorts({
    issues: [issue(90, { title: "feat: Keep my search" })],
    worktrees: [{ path: WORKTREE, branch: "feat/90-keep-my-search" }],
    files: { [`${WORKTREE}/.env`]: "PORT=4090\n" },
    ...world,
  })
  return runCli(args, ctxFor(ports))
}

const rulesInFile = () =>
  /```text\n([\s\S]*?)\n```/
    .exec(readFileSync(RULES_FILE, "utf8"))[1]
    .split("\n")
    .filter((line) => /^\d+\. /.test(line))

test("brief prints every rule in the block", () => {
  const rules = rulesInFile()
  assert.ok(rules.length >= 15)
  const { code, text } = run(["brief", "90", "--role", "build"])
  assert.equal(code, 0)
  for (const rule of rules) assert.ok(text.includes(rule), rule)
})

test("the parsed rules are the rules in the file", () => {
  assert.deepEqual(parseRules(readFileSync(RULES_FILE, "utf8")), rulesInFile())
})

test("the rules name the commands an agent must run and hold no machine path", () => {
  const block = rulesInFile().join("\n")
  for (const word of [
    "scripts/ocv-tools.mjs take",
    "scripts/ocv-tools.mjs done",
    "scripts/ocv-tools.mjs block",
    "scripts/ocv-tools.mjs save",
    "scripts/ocv-tools.mjs finish",
    "--no-verify",
    "AI attribution",
  ])
    assert.ok(block.includes(word), word)
  assert.doesNotMatch(block, /\/home\/|\/Users\//)
})

test("each role gets its model and budget from the table", () => {
  const expected = {
    build: "sonnet",
    mechanical: "haiku",
    review: "opus",
    plan: "opus",
  }
  const table = parseRoles(readFileSync(RULES_FILE, "utf8"))
  for (const [role, model] of Object.entries(expected)) {
    assert.equal(table[role].model, model)
    const { code, text } = run(["brief", "90", "--role", role])
    assert.equal(code, 0)
    assert.match(text, new RegExp(`^Model: ${model}$`, "m"))
    assert.match(
      text,
      new RegExp(`^Tool budget: ${table[role].budget} calls$`, "m")
    )
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

test("fenced paths are empty by default and listed when the file has some", () => {
  assert.deepEqual(parseFences(readFileSync(FENCES_FILE, "utf8")), [])
  const none = run(["brief", "90", "--role", "build"])
  assert.match(none.text, /^Fenced paths: none$/m)
  const some = run(["brief", "90", "--role", "build"], {
    files: {
      [FENCES_FILE]: JSON.stringify({
        fences: [{ issue: 916, paths: ["apps/web/src/features/paper/**"] }],
      }),
    },
  })
  assert.match(some.text, /^Fenced paths \(never edit\):$/m)
  assert.match(
    some.text,
    /^ {2}apps\/web\/src\/features\/paper\/\*\* \(issue #916\)$/m
  )
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
