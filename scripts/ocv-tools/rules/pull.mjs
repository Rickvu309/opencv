import { FIXES } from "../result.mjs"

function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    fix: () => FIXES[spec.id],
    ...spec,
  }
}

const TITLE =
  /^(feat|fix|hotfix|refactor|chore|docs)(\([a-z0-9-]+\))?!?: [^ ].* \(#(\d+)\)$/

function readyForHuman(facts) {
  const issue = facts.issue
  if (!issue?.labels?.includes("ready-for-human")) return null
  return `#${issue.n} is labeled ready-for-human: it is a decision for a human, never an agent task`
}

function prMetadata(facts) {
  const p = facts.pull
  if (!p || p.issue == null) return null
  const problems = []
  const title = TITLE.exec(p.title ?? "")
  if (!title || Number(title[3]) !== Number(p.issue))
    problems.push(`the title is not "type: description (#${p.issue})"`)
  const closes = new RegExp(`(^|\\s)Closes #${p.issue}(\\D|$)`)
  if (!closes.test(p.body ?? ""))
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
    at: ["take", "finish", "pr"],
    needs: ["issue"],
    check: readyForHuman,
  }),
  rule({
    id: "PR_METADATA",
    section: "4",
    says: "The title is type: description (#n), the body says Closes #n, and issue n is open.",
    at: ["finish", "pr"],
    needs: ["pull"],
    check: prMetadata,
    fix: () =>
      "gh pr edit <pr> --title 'type: text (#<n>)'. scripts/ocv-tools.mjs body <pr> --body-file <file>",
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
]
