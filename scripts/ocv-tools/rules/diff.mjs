import { FIXES } from "../result.mjs"

function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    fix: () => FIXES[spec.id],
    ...spec,
  }
}

export const OWNER_DEFAULT_MASS_DELETE_LIMITS = Object.freeze({
  files: 25,
  lines: 2000,
  percent: 10,
})

export const CHANGE_SIZE_LIMIT = 25

const NOT_COUNTED =
  /(?:[.-](?:test|spec)\.[cm]?[jt]sx?|\.type-test\.ts|\.snapshot\.json|\.layout\.json)$|(?:^|\/)(?:test|tests|__tests__|__snapshots__|drizzle)\/|^pnpm-lock\.yaml$/

export function countedSourceFiles(changes) {
  return changes.filter(
    (change) =>
      !change.generated && change.added > 0 && !NOT_COUNTED.test(change.path)
  )
}

function asLines(value) {
  if (Array.isArray(value)) return value
  if (value == null || value === "") return []
  return String(value).split("\n").filter(Boolean)
}

function workflowFiles(facts) {
  return asLines(facts.diff?.files)
}

function noWorkflows(facts) {
  const bad = workflowFiles(facts).filter(
    (file) =>
      file.startsWith(".github/workflows/") &&
      file !== ".github/workflows/ci.yml" &&
      file !== ".github/workflows/nightly.yml"
  )
  if (!bad.length) return null
  return `workflows other than ci.yml and nightly.yml are not added without an issue: ${bad.slice(0, 3).join(" ")}`
}

function ciKept(facts) {
  if (!workflowFiles(facts).includes(".github/workflows/ci.yml")) return null
  if (facts.diff?.ciYmlAtHead !== false) return null
  return "the change deletes .github/workflows/ci.yml: the file may change, never vanish (the required ci check runs from it)"
}

function riskHigh(facts) {
  const watched = [
    ".github/workflows/ci.yml",
    ".github/workflows/nightly.yml",
    "scripts/check.mjs",
    ".github/rulesets/main.json",
  ]
  if (
    !workflowFiles(facts).some(
      (file) => watched.includes(file) || file.startsWith(".github/actions/")
    )
  )
    return null
  if (asLines(facts.diff?.labels).includes("risk:high")) return null
  return "the change touches ci.yml, nightly.yml, composite actions, check.mjs or the main ruleset, which attest the ci check itself, and the issue is not labeled risk:high (owner approval, slice 5 of epic #582)"
}

function massDelete(facts) {
  const d = facts.diff?.deleted
  if (!d) return null
  if (asLines(facts.diff?.labels).includes("needs-human-review")) return null
  const { files, lines, percent } = OWNER_DEFAULT_MASS_DELETE_LIMITS
  const over = []
  if (d.files > files) over.push(`${d.files} files (limit ${files})`)
  if (d.lines > lines) over.push(`${d.lines} lines (limit ${lines})`)
  if (d.total > 0 && d.files * 100 > percent * d.total)
    over.push(`${d.files} of ${d.total} authored files (limit ${percent}%)`)
  if (!over.length) return null
  return `the change deletes a lot of authored source: ${over.join(", ")}; a human must review it first, so ask the owner to label the issue needs-human-review`
}

function changeTooBig(facts) {
  const changes = facts.diff?.changes
  if (!changes) return null
  if (asLines(facts.diff?.labels).includes("needs-human-review")) return null
  const counted = countedSourceFiles(changes)
  if (counted.length <= CHANGE_SIZE_LIMIT) return null
  return `the change adds or edits ${counted.length} authored source files (limit ${CHANGE_SIZE_LIMIT}); large changes cause most of our bugs, so split it into sub-issues (AGENTS.md section 1) and ship one part at a time; if it truly cannot split, ask the owner to label the issue needs-human-review`
}

export const diffRows = [
  rule({
    id: "NO_WORKFLOWS",
    section: "5",
    says: "Only ci.yml and nightly.yml are workflows; .github/actions/setup/** is allowed.",
    at: ["finish", "pr"],
    needs: ["diff"],
    check: noWorkflows,
    fix: () => "git rm -rf -- <files> && git commit --amend --no-edit",
  }),
  rule({
    id: "CI_WORKFLOW_KEPT",
    section: "5",
    says: "ci.yml may change but never vanish.",
    at: ["finish", "pr"],
    needs: ["diff"],
    check: ciKept,
    fix: () =>
      "git checkout origin/main -- .github/workflows/ci.yml && git commit --amend --no-edit",
  }),
  rule({
    id: "RISK_HIGH_FOR_CI",
    section: "5",
    says: "A change to ci.yml, nightly.yml, a composite action, check.mjs or the main ruleset needs the risk:high label.",
    at: ["finish", "pr"],
    needs: ["diff"],
    check: riskHigh,
    fix: () => "gh issue edit <issue> --add-label risk:high",
  }),
  rule({
    id: "MASS_DELETE",
    section: "5",
    why: "Issue #618: a mass deletion needs a human. The limits are the owner's defaults.",
    says: "More than 25 authored files, 2000 lines or 10% of authored files deleted needs needs-human-review on the issue.",
    at: ["finish", "pr"],
    needs: ["diff"],
    check: massDelete,
    fix: () => "Ask the owner to label the issue needs-human-review",
  }),
  rule({
    id: "CHANGE_TOO_BIG",
    section: "1",
    says: `More than ${CHANGE_SIZE_LIMIT} authored source files with added lines need sub-issues, or needs-human-review on the issue; tests do not count.`,
    at: ["finish", "pr"],
    needs: ["diff"],
    check: changeTooBig,
    fix: () =>
      "Split into sub-issues; if it truly cannot split, ask the owner to label the issue needs-human-review",
  }),
]
