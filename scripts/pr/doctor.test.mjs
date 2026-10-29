import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  doctor,
  format,
  labelDrift,
  parseLabels,
  runCli,
  settings,
} from "./doctor.mjs"

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
const declaredLabels = parseLabels(read(".github/labels.yml"))
const live = declaredLabels.map(({ name, color, description }) => ({
  name,
  color,
  description,
}))

// The `main` ruleset as GitHub returns it: the declared fields plus ids, timestamps and defaults.
const liveRuleset = () => {
  const declared = JSON.parse(read(".github/rulesets/main.json"))
  const copy = structuredClone(declared)
  Object.assign(copy, {
    id: 25725442,
    node_id: "RRS_x",
    source: "quanvu309/opencv",
    created_at: "2026-10-23T20:30:40.358+07:00",
    updated_at: "2026-10-23T20:30:40.423+07:00",
    current_user_can_bypass: "pull_requests_only",
  })
  const pr = copy.rules.find((rule) => rule.type === "pull_request")
  Object.assign(pr.parameters, {
    required_reviewers: [],
    require_extra_approval_for_unattributed_changes: true,
  })
  copy.rules.reverse()
  return copy
}

async function cli(args, io) {
  const logged = []
  const log = console.log
  console.log = (line) => logged.push(line)
  try {
    return { code: await runCli(args, io), logged }
  } finally {
    console.log = log
  }
}

const clean = { ...settings, has_issues: true, has_wiki: false }

function fakeIo(overrides = {}) {
  return {
    read,
    labels: async () => live,
    ruleset: async () => liveRuleset(),
    repo: async () => clean,
    alertsEnabled: async () => true,
    ...overrides,
  }
}

test("labels.yml keeps only the labels something reads", () => {
  assert.deepEqual(
    declaredLabels.map((l) => l.name),
    [
      "feat",
      "fix",
      "hotfix",
      "refactor",
      "chore",
      "docs",
      "needs-human-review",
      "ready-for-human",
      "risk:low",
      "risk:normal",
      "risk:high",
    ]
  )
})

test("a repo in sync with git has no drift and exits 0", async () => {
  const { code, logged } = await cli([], fakeIo())
  assert.equal(code, 0)
  assert.match(logged[0], /no drift/)
})

// The state found on 2026-10-29: bug, dependencies and javascript lived only on GitHub,
// the five triage labels and projects were left on, and alerts were off.
test("the drift found on 2026-10-29 is reported with its fix", async () => {
  const drift = await doctor(
    fakeIo({
      labels: async () => [
        ...live,
        {
          name: "bug",
          color: "d73a4a",
          description: "Something isn't working",
        },
        { name: "javascript", color: "168700", description: "" },
      ],
      repo: async () => ({ ...clean, has_projects: true }),
      alertsEnabled: async () => false,
    })
  )
  const fixes = drift.map((d) => d.fix)
  assert.deepEqual(fixes, [
    'gh label delete "bug" --yes',
    'gh label delete "javascript" --yes',
    "gh api -X PATCH repos/{owner}/{repo} -F has_projects=false",
    "gh api -X PUT repos/{owner}/{repo}/vulnerability-alerts",
  ])
  assert.match(format(drift), /DRIFT label bug: on GitHub, not in/)
  const run = await cli(
    [],
    fakeIo({ repo: async () => ({ ...clean, has_projects: true }) })
  )
  assert.equal(run.code, 1)
})

test("a label in git but missing on GitHub is created", () => {
  const drift = labelDrift(
    declaredLabels,
    live.filter((l) => l.name !== "ready-for-human")
  )
  assert.equal(drift.length, 1)
  assert.match(drift[0].fix, /^gh label create "ready-for-human" --color /)
  assert.match(drift[0].detail, /missing on GitHub/)
})

test("a label with another colour or description is edited, not recreated", () => {
  const drift = labelDrift(declaredLabels, [
    ...live.filter((l) => l.name !== "docs" && l.name !== "fix"),
    {
      name: "docs",
      color: "000000",
      description: "Documentation only (branch docs/)",
    },
    { name: "fix", color: "D73A4A", description: "Bug fix" },
  ])
  assert.deepEqual(
    drift.map((d) => d.fix),
    [
      'gh label edit "fix" --color d73a4a --description "Bug fix (branch fix/)"',
      'gh label edit "docs" --color 0075ca --description "Documentation only (branch docs/)"',
    ]
  )
})

test("ruleset: a changed rule, an extra rule and a missing ruleset are drift", async () => {
  const changed = liveRuleset()
  changed.rules.find(
    (r) => r.type === "pull_request"
  ).parameters.require_code_owner_review = true
  let drift = await doctor(fakeIo({ ruleset: async () => changed }))
  assert.equal(drift.length, 1)
  assert.match(
    drift[0].detail,
    /require_code_owner_review: git false, GitHub true/
  )
  assert.equal(
    drift[0].fix,
    "gh api -X PUT repos/{owner}/{repo}/rulesets/25725442 --input .github/rulesets/main.json"
  )

  const extra = liveRuleset()
  extra.rules.push({ type: "required_signatures" })
  drift = await doctor(fakeIo({ ruleset: async () => extra }))
  assert.match(
    drift[0].detail,
    /\[required_signatures\]: on GitHub, not in git/
  )

  const other = liveRuleset()
  other.rules.push({ type: "required_signatures" })
  drift = await doctor(fakeIo({ ruleset: async () => other }))
  assert.match(
    drift[0].detail,
    /\[required_signatures\]: on GitHub, not in git/
  )

  const loose = liveRuleset()
  loose.bypass_actors = [
    { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
  ]
  loose.conditions.ref_name.include = ["refs/heads/dev"]
  drift = await doctor(fakeIo({ ruleset: async () => loose }))
  assert.deepEqual(
    drift.map((d) => d.detail.split(":")[0]),
    ["bypass_actors[5]", "conditions.ref_name.include"]
  )

  const nogate = liveRuleset()
  const checks = nogate.rules.find((r) => r.type === "required_status_checks")
  checks.parameters.required_status_checks.pop()
  drift = await doctor(fakeIo({ ruleset: async () => nogate }))
  assert.match(drift[0].detail, /\[ci\]: in git, missing on GitHub/)

  drift = await doctor(fakeIo({ ruleset: async () => null }))
  assert.equal(
    drift[0].fix,
    "gh api -X POST repos/{owner}/{repo}/rulesets --input .github/rulesets/main.json"
  )
})

test("ruleset: required checks are matched by context, not by position", async () => {
  const checks = (live) =>
    live.rules.find((r) => r.type === "required_status_checks").parameters
  const missing = liveRuleset()
  checks(missing).required_status_checks = []
  let drift = await doctor(fakeIo({ ruleset: async () => missing }))
  assert.equal(drift.length, 1)
  assert.match(
    drift[0].detail,
    /required_status_checks\[ci\]: in git, missing on GitHub/
  )

  const extra = liveRuleset()
  checks(extra).required_status_checks.push({
    context: "other",
    integration_id: 1,
  })
  drift = await doctor(fakeIo({ ruleset: async () => extra }))
  assert.equal(drift.length, 1)
  assert.match(
    drift[0].detail,
    /required_status_checks\[other\]: on GitHub, not in git/
  )

  const reordered = liveRuleset()
  checks(reordered).required_status_checks.unshift({
    context: "other",
    integration_id: 1,
  })
  drift = await doctor(fakeIo({ ruleset: async () => reordered }))
  assert.equal(drift.length, 1)
  assert.doesNotMatch(drift[0].detail, /\[ci\]/)
  assert.match(drift[0].detail, /\[other\]: on GitHub, not in git/)
})

test("settings: each declared setting that differs is reported with its PATCH", async () => {
  const drift = await doctor(
    fakeIo({
      repo: async () => ({
        ...clean,
        allow_merge_commit: true,
        allow_rebase_merge: true,
        delete_branch_on_merge: false,
      }),
    })
  )
  assert.deepEqual(
    drift.map((d) => d.fix),
    [
      "gh api -X PATCH repos/{owner}/{repo} -F allow_merge_commit=false",
      "gh api -X PATCH repos/{owner}/{repo} -F allow_rebase_merge=false",
      "gh api -X PATCH repos/{owner}/{repo} -F delete_branch_on_merge=true",
    ]
  )
})

test("--json prints the drift list", async () => {
  const { code, logged } = await cli(
    ["--json"],
    fakeIo({ alertsEnabled: async () => false })
  )
  assert.equal(code, 1)
  assert.equal(JSON.parse(logged[0]).drift[0].subject, "vulnerability alerts")
})
