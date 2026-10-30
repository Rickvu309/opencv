// Rules about the pull request itself: its linked issue, labels, title and
// body. Each check takes the facts a job gathered and returns a refusal, or
// null when the rule holds.
import { FIXES } from "../result.mjs"

function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    jobs: [],
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

export const pullRows = [
  rule({
    id: "READY_FOR_HUMAN",
    section: "5",
    says: "An issue labeled ready-for-human is a decision for a human, never an agent task.",
    jobs: ["take", "open"],
    at: ["take", "pr"],
    needs: ["issue"],
    check: readyForHuman,
  }),
  rule({
    id: "PR_METADATA",
    section: "4",
    says: "The title is type: description (#n), the body says Closes #n, and issue n is open.",
    jobs: ["merge"],
    at: ["pr"],
    needs: ["pull"],
    check: prMetadata,
    fix: () =>
      "gh pr edit <pr> --title 'type: text (#<n>)' --body 'Closes #<n>'",
  }),
]
