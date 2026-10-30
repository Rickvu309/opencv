// Rules about the change itself: workflow files, gate paths and deletions.
// Each check takes the facts a job gathered and returns a refusal, or null
// when the rule holds.
import { FIXES } from "../result.mjs"

function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    fix: () => FIXES[spec.id],
    ...spec,
  }
}

// Merge-time limits of issue #618: a mass deletion needs a human. The limits
// below are the owner's defaults.
export const MASS_DELETE_LIMITS = Object.freeze({
  files: 25,
  lines: 2000,
  percent: 10,
})

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
  const { files, lines, percent } = MASS_DELETE_LIMITS
  const over = []
  if (d.files > files) over.push(`${d.files} files (limit ${files})`)
  if (d.lines > lines) over.push(`${d.lines} lines (limit ${lines})`)
  if (d.total > 0 && d.files * 100 > percent * d.total)
    over.push(`${d.files} of ${d.total} authored files (limit ${percent}%)`)
  if (!over.length) return null
  return `the change deletes a lot of authored source: ${over.join(", ")}; a human must review it first`
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
    says: "More than 25 authored files, 2000 lines or 10% of authored files deleted needs a human.",
    at: ["finish", "pr"],
    needs: ["diff"],
    check: massDelete,
    fix: () => "gh pr edit <pr> --add-label needs-human-review",
  }),
]
