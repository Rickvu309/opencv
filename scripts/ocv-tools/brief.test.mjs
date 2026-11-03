import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  FENCES_FILE,
  RULES_FILE,
  parseFences,
  parseRoles,
  parseRules,
  rulesForRole,
} from "./brief.mjs"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts, issue } from "./ports/fake.mjs"

const AGENTS_FILE = fileURLToPath(new URL("../../AGENTS.md", import.meta.url))
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

const rulesInFile = () => parseRules(readFileSync(RULES_FILE, "utf8"))
const ruleBlock = () =>
  rulesInFile()
    .map((rule) => rule.text)
    .join("\n")
const outputRules = (text) =>
  text
    .split("\nRules:\n")[1]
    .split("\n")
    .filter((line) => /^\d+\. /.test(line))

test("brief prints every rule tagged for the role, renumbered", () => {
  const rules = rulesInFile()
  assert.ok(rules.length >= 15)
  for (const role of ROLES) {
    const { code, text } = run(["brief", "90", "--role", role])
    assert.equal(code, 0)
    assert.deepEqual(
      outputRules(text),
      rulesForRole(rules, role).map((rule, i) => `${i + 1}. ${rule.text}`)
    )
  }
})

test("every rule names its roles and the AGENTS.md section it follows", () => {
  const headings = readFileSync(AGENTS_FILE, "utf8")
    .split("\n")
    .map((line) => /^#{1,6} (?:\d+\. )?(.+)$/.exec(line)?.[1])
    .filter(Boolean)
  for (const rule of rulesInFile()) {
    assert.ok(headings.includes(rule.section), rule.line)
    for (const role of rule.roles)
      assert.ok(["all", ...ROLES].includes(role), rule.line)
  }
})

test("a rule with no role tag or no section is refused", () => {
  const block = (line) => `## Rules\n\n\`\`\`text\n${line}\n\`\`\`\n`
  assert.throws(() => parseRules(block("1. No tag here. (AGENTS.md: Git)")))
  assert.throws(() => parseRules(block("1. [all] No section here.")))
  assert.equal(
    parseRules(block("1. [build plan] Fine. (AGENTS.md: Git)"))[0].section,
    "Git"
  )
})

test("the git and model words in the rules are also in AGENTS.md", () => {
  const agents = readFileSync(AGENTS_FILE, "utf8")
  const block = ruleBlock()
  for (const word of [
    "--no-verify",
    "SKIP_CHECKS",
    "--author",
    "Co-Authored-By",
    "AI attribution",
    "finish --body-file",
    "scripts/ocv-tools.mjs save",
    "scripts/ocv-tools.mjs done",
    "scripts/ocv-tools.mjs block",
    "haiku for search, exploration, polling and mechanical edits, sonnet for writing code, opus for planning, architecture and review",
  ]) {
    assert.ok(block.includes(word), `rules lack ${word}`)
    assert.ok(agents.includes(word), `AGENTS.md lacks ${word}`)
  }
})

test("the model rule and the role table agree", () => {
  const table = parseRoles(readFileSync(RULES_FILE, "utf8"))
  const modelRule = rulesInFile().find((rule) =>
    rule.text.startsWith("Subagents.")
  ).text
  assert.match(modelRule, /haiku for [^.]*mechanical edits/)
  assert.match(modelRule, /sonnet for writing code/)
  assert.match(modelRule, /opus for planning, architecture and review/)
  assert.doesNotMatch(modelRule, /sonnet for [^,]*mechanical/)
  assert.equal(table.mechanical.model, "haiku")
  assert.equal(table.build.model, "sonnet")
  assert.equal(table.review.model, "opus")
  assert.equal(table.plan.model, "opus")
})

test("the rules name the commands an agent must run and hold no machine path", () => {
  const block = ruleBlock()
  for (const word of [
    "scripts/ocv-tools.mjs take",
    "scripts/ocv-tools.mjs finish",
  ])
    assert.ok(block.includes(word), word)
  assert.doesNotMatch(block, /\/home\/|\/Users\//)
})

test("a review or plan brief never tells the agent to change anything", () => {
  for (const role of ["review", "plan"]) {
    const { text } = run(["brief", "90", "--role", role], { worktrees: [] })
    assert.doesNotMatch(
      text,
      /scripts\/ocv-tools\.mjs (take|save|finish|done|block)/
    )
    assert.match(text, /Read only/)
  }
  for (const role of ["build", "mechanical"]) {
    const { text } = run(["brief", "90", "--role", role], { worktrees: [] })
    for (const verb of ["take", "save", "finish", "done", "block"])
      assert.ok(text.includes(`scripts/ocv-tools.mjs ${verb}`), verb)
  }
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

const PAPER_FENCE = {
  fences: [
    {
      issue: 916,
      expires: "2026-12-01",
      paths: ["apps/web/src/features/paper/**"],
    },
  ],
}

test("the shipped fence holds the #916 paths and an expiry date", () => {
  const raw = readFileSync(FENCES_FILE, "utf8")
  const [fence] = JSON.parse(raw).fences
  assert.equal(fence.issue, 916)
  assert.match(fence.expires, /^\d{4}-\d{2}-\d{2}$/)
  const { active } = parseFences(raw, Date.parse("2026-11-03T00:00:00Z"))
  const paths = active.map((entry) => entry.path)
  for (const path of [
    "apps/web/src/features/paper/**",
    "apps/api/src/paper/**",
    ".claude/skills/verify-app-ui/scripts/verify-letter-editor.mjs",
    "apps/web/src/features/coach/chat-api.ts",
    "apps/web/src/lib/paper-selection.ts",
    "apps/web/src/lib/paper-sync*",
    "apps/web/src/test/paper-fixture.ts",
    "apps/api/src/test/paper-client.ts",
    "packages/domain/src/paper-doc/**",
    "packages/paper-crdt/**",
    "apps/web/package.json",
  ])
    assert.ok(paths.includes(path), path)
})

test("brief prints the shipped fence before its expiry", () => {
  const { text } = run(["brief", "90", "--role", "build"])
  assert.match(text, /^Fenced paths \(never edit\):$/m)
  assert.match(text, /^ {2}apps\/api\/src\/paper\/\*\* \(issue #916\)$/m)
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
