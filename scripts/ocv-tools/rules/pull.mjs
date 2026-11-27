import { FIXES } from "../result.mjs"
import { closesIssue, issueInTitle } from "./pull-ref.mjs"
import { LABELS, RED_PLACES, openRedIssues } from "./merge-gate.mjs"

function unallowedMigrations(facts) {
  const allowed = facts.migrations?.allowed ?? []
  return (facts.migrations?.files ?? []).filter(
    (item) => item.changes.length && !allowed.includes(item.tag)
  )
}

function migrationChanges(facts) {
  const hits = unallowedMigrations(facts)
  if (!hits.length) return null
  return `the merge runs ${hits.map((item) => `${item.tag} (${item.changes.join(", ")})`).join("; ")} on production data, and it changes existing things`
}

const numbered = (issues) =>
  issues.map((issue) => `#${issue.number}`).join(", ")

function queueClosed(facts) {
  const red = openRedIssues(facts.issues)
  if (!red.length) return null
  if ((facts.pull?.labels ?? []).includes(LABELS.productionRedRevert))
    return null
  const places = RED_PLACES.map(([label, place]) => [
    place,
    red.filter((issue) => issue.labels.includes(label)),
  ])
    .filter(([, issues]) => issues.length)
    .map(([place, issues]) => `${place} is red (${numbered(issues)} open)`)
  return `${places.join(" and ")}, so only a pull request labeled ${LABELS.productionRedRevert} merges`
}

function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    fix: () => FIXES[spec.id],
    ...spec,
  }
}

function readyForHuman(facts) {
  const issue = facts.issue
  if (!issue?.labels?.includes("ready-for-human")) return null
  return `#${issue.n} is labeled ready-for-human: it is a decision for a human, never an agent task`
}

function prMetadata(facts) {
  const p = facts.pull
  if (!p || p.issue == null) return null
  const problems = []
  if (issueInTitle(p.title) !== Number(p.issue))
    problems.push(`the title is not "type: description (#${p.issue})"`)
  if (!closesIssue(p.body, p.issue))
    problems.push(`the body has no "Closes #${p.issue}" line`)
  if (p.issueState && p.issueState !== "OPEN")
    problems.push(`issue #${p.issue} is ${String(p.issueState).toLowerCase()}`)
  if (!problems.length) return null
  return `the pull request details are wrong: ${problems.join("; ")}`
}

const CLOSING_KEYWORD =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+#(\d+)\b/gi

function closedByPull(pull) {
  const closes = new Set((pull.closing ?? []).map(Number))
  if (pull.issue) closes.add(Number(pull.issue))
  for (const m of (pull.body ?? "").matchAll(CLOSING_KEYWORD))
    closes.add(Number(m[1]))
  return closes
}

function pinnedFailures(facts) {
  const closes = closedByPull(facts.pull)
  const problems = []
  for (const pin of facts.pins) {
    if (pin.issue == null) problems.push(`${pin.at} names no issue`)
    else if (closes.has(pin.issue))
      problems.push(
        `${pin.at} cites #${pin.issue}, which this pull request closes`
      )
    else if (pin.state !== "OPEN")
      problems.push(
        `${pin.at} cites #${pin.issue}, which is ${String(pin.state ?? "missing").toLowerCase()}`
      )
  }
  if (!problems.length) return null
  return `an expected failure (it.fails) must cite an issue that stays open after this merge: ${problems.join("; ")}`
}

export const pullRows = [
  rule({
    id: "READY_FOR_HUMAN",
    section: "5",
    says: "An issue labeled ready-for-human is a decision for a human, never an agent task.",
    at: ["take", "pr"],
    needs: ["issue"],
    check: readyForHuman,
  }),
  rule({
    id: "PR_METADATA",
    section: "4",
    says: "The title is type: description (#n), the body says Closes #n, and issue n is open.",
    at: ["authoring", "body", "pr"],
    needs: ["pull"],
    check: prMetadata,
    fix: () =>
      "Run gh pr edit <pr> --title 'type: text (#<n>)', then scripts/ocv-tools.mjs body <pr> --body-file <file>",
  }),
  rule({
    id: "PIN_ISSUE_OPEN",
    section: "4",
    says: "Every expected failure (it.fails) in the head tree cites an open issue that the pull request does not close.",
    at: ["pr"],
    needs: ["pull", "pins"],
    check: pinnedFailures,
    fix: () =>
      "Fix the bug and turn the it.fails back into it, or cite the open issue that still tracks it and drop that issue from Closes",
  }),
  rule({
    id: "QUEUE_CLOSED",
    section: "6",
    says: "While an issue labeled production-red or main-red is open, only a pull request labeled production-red-revert merges.",
    at: ["pr"],
    needs: ["pull", "issues"],
    check: queueClosed,
    fix: (facts) =>
      `Wait until ${numbered(openRedIssues(facts.issues))} is closed, then run: gh run rerun --failed for the policy job of this pull request`,
  }),
  rule({
    id: "MIGRATION_CHANGES",
    section: "6",
    says: "A PR whose database migration has a statement outside the only-adds list (a new table, its indexes and ADD clauses, a type, a sequence, a schema, a comment on what it made) merges only with the label allow-migration:<tag> for that migration, which merge --allow-migration adds, because the merge runs it on production data. The verdict is a static reading of the SQL, not a proof: any character or dollar tag the scanner does not read as Postgres does, any name not schema-qualified to opencv_app, and any journal edit other than appending the migrations the PR adds change existing things.",
    at: ["pr"],
    needs: ["pull", "migrations"],
    check: migrationChanges,
    fix: (facts) =>
      `Name what it changes in the **Risk:** line, then run: scripts/ocv-tools.mjs merge ${facts.pull?.n ?? "<pr#>"} --allow-migration ${unallowedMigrations(
        facts
      )
        .map((item) => item.tag)
        .join(",")}`,
  }),
]
