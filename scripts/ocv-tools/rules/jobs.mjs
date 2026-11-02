// Preconditions the finish and merge jobs raise: finish (the PR opening, before and
// after the push), merge (the live pull request) and the queue wait. Each
// check reads domain facts the job gathered, never a verdict it made itself.
const BRANCH_ISSUE = /^(?:feat|fix|hotfix|refactor|chore|docs)\/(\d+)-/
const FINISH_TITLE = /^(feat|fix|hotfix|refactor|chore|docs): [^ ].* \(#\d+\)$/
const SECTIONS = ["Summary", "Evidence", "Merge Danger"]
const FINISH_FIX = "Fix the cause, then run scripts/ocv-tools.mjs finish again."
const MERGE_FIX =
  "Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>."

// The text under a `## Heading` line up to the next `## ` line.
function sectionBody(text, heading) {
  const start = new RegExp(`^## ${heading}\\r?$`, "m").exec(text)
  if (!start) return null
  const rest = text.slice(start.index + start[0].length)
  const next = /^## /m.exec(rest)
  return (next ? rest.slice(0, next.index) : rest).trim()
}

function badBody(facts) {
  const body = facts.body
  if (!body?.file) return "Pass --body-file <file>."
  if (body.unreadable) return `The body file ${body.file} cannot be read.`
  const text = body.text ?? ""
  for (const heading of SECTIONS)
    if (!sectionBody(text, heading)) return `The PR body needs ## ${heading}.`
  if (
    !/^\*\*Door:\*\* (one-way|two-way)/m.test(text) ||
    !/^\*\*Blast Radius:\*\* [^<\s]/m.test(text) ||
    /<(diagram|screenshot|one-way|optional)[^>]*>/.test(text)
  )
    return "Fill in Door, Blast Radius and all template placeholders."
  return null
}

const badTitle = (facts) =>
  FINISH_TITLE.test(facts.pull?.title ?? "") ? null : "The PR title is invalid."

const noCommits = (facts) =>
  facts.commits?.count === 0 ? "No commits beyond origin/main." : null

const staleCheck = ({ snapshot }) =>
  JSON.stringify(snapshot.before) === JSON.stringify(snapshot.after)
    ? null
    : "The saved work changed during push. Finish again."

const prNo = (facts) => facts.pull?.n ?? "<pr#>"

const draft = (facts) =>
  facts.pull.isDraft ? `PR #${prNo(facts)} is a draft.` : null

const needsHumanReview = (facts) =>
  facts.pull.labels.includes("needs-human-review") ||
  facts.issue?.labels?.includes("needs-human-review")
    ? `PR #${prNo(facts)} needs human review; an agent never merges it.`
    : null

const badBranch = (facts) =>
  BRANCH_ISSUE.test(facts.pull.branch ?? "")
    ? null
    : `PR #${prNo(facts)} has no linked issue in its branch name.`

const closedPr = (facts) =>
  ["OPEN", "MERGED"].includes(facts.pull.state)
    ? null
    : `PR #${prNo(facts)} is ${facts.pull.state}.`

function ciRequired(facts) {
  const { pull, ci } = facts
  if (pull.state !== "OPEN") return null
  if (
    ci &&
    ci.status === "completed" &&
    ci.conclusion === "success" &&
    ci.head === pull.head
  )
    return null
  return `The ci check on head ${pull.head} is ${ci?.conclusion ?? "pending or missing"}, not success.`
}

const queueKind = (kind, message) => (facts) =>
  facts.queue.kind === kind ? message(facts.queue, facts) : null

const failedRun = (queue) =>
  queue.run?.html_url ? ` Failing run: ${queue.run.html_url}.` : ""

const failedNotes = (queue) =>
  queue.notes?.length ? `\n${queue.notes.join("\n")}` : ""

const waitAgain = (facts) =>
  `Run: scripts/ocv-tools.mjs merge ${facts.queue?.n ?? "<pr#>"} --wait`

function row(spec) {
  return {
    kind: "precondition",
    section: "4",
    needs: [],
    fix: () => FINISH_FIX,
    ...spec,
  }
}

export const jobRows = [
  row({
    id: "STALE_CHECK",
    says: "The saved work changed during push.",
    at: ["finish-pushed"],
    needs: ["snapshot"],
    check: staleCheck,
  }),
  row({
    id: "BAD_BODY",
    says: "The PR body needs a Summary, Evidence and Merge Danger section with content, and no template placeholders.",
    at: ["finish"],
    needs: ["body"],
    check: badBody,
  }),
  row({
    id: "BAD_TITLE",
    says: "The PR title is type: description (#n).",
    at: ["finish"],
    needs: ["pull"],
    check: badTitle,
  }),
  row({
    id: "NO_COMMITS",
    says: "There are no commits beyond origin/main.",
    at: ["finish"],
    needs: ["commits"],
    check: noCommits,
  }),
  row({
    id: "DRAFT",
    section: "6",
    says: "A draft PR cannot merge.",
    at: ["merge"],
    needs: ["pull"],
    check: draft,
    fix: (facts) => `Run: gh pr ready ${prNo(facts)}`,
  }),
  row({
    id: "NEEDS_HUMAN_REVIEW",
    section: "6",
    says: "An agent never merges a PR needing human review.",
    at: ["merge"],
    needs: ["pull"],
    check: needsHumanReview,
    fix: () =>
      "A human reviews it. An agent never removes the needs-human-review label.",
  }),
  row({
    id: "BAD_BRANCH",
    section: "6",
    says: "The PR branch must name its issue.",
    at: ["merge"],
    needs: ["pull"],
    check: badBranch,
    fix: () => "Rename the branch type/<issue#>-short-description and reopen.",
  }),
  row({
    id: "CLOSED_PR",
    section: "6",
    says: "The PR must be open or already merged.",
    at: ["merge"],
    needs: ["pull"],
    check: closedPr,
    fix: () => "Open a new PR with scripts/ocv-tools.mjs finish.",
  }),
  row({
    id: "CI_REQUIRED",
    section: "6",
    says: "The newest ci check must succeed on the PR head.",
    at: ["merge"],
    needs: ["pull", "ci"],
    check: ciRequired,
    fix: (facts) =>
      facts.pull?.head
        ? `Run: gh run list --workflow ci.yml --commit ${facts.pull.head}`
        : MERGE_FIX,
  }),
  row({
    id: "LEFT_QUEUE",
    section: "6",
    says: "The PR must stay in the queue until it merges.",
    at: ["queue"],
    needs: ["queue"],
    check: queueKind(
      "LEFT_QUEUE",
      (queue) =>
        `PR #${queue.n} left the merge queue${queue.at ? ` at ${queue.at}` : ""}, reason ${queue.reason}.`
    ),
    fix: (facts) =>
      `Run: gh run list --branch 'gh-readonly-queue/main/pr-${facts.queue?.n ?? "<pr#>"}-*' --limit 1`,
  }),
  row({
    id: "QUEUE_TIMEOUT",
    section: "6",
    says: "The queue must merge the PR within 45 minutes.",
    at: ["queue"],
    needs: ["queue"],
    check: queueKind(
      "QUEUE_TIMEOUT",
      (queue) =>
        `PR #${queue.n} is still not merged after ${queue.limitMinutes} minutes${queue.queueState ? ` (${queue.queueState})` : ""}.`
    ),
    fix: waitAgain,
  }),
  row({
    id: "HEAD_MOVED",
    section: "6",
    says: "The PR head must stay the commit ci passed.",
    at: ["queue"],
    needs: ["queue"],
    check: queueKind(
      "HEAD_MOVED",
      (queue) => `PR #${queue.n} head moved from ${queue.from} to ${queue.to}.`
    ),
    fix: waitAgain,
  }),
  row({
    id: "CI_FAILED",
    section: "6",
    says: "The newest ci check on the PR head must succeed.",
    at: ["queue"],
    needs: ["queue", "snapshot"],
    check: queueKind(
      "CI_FAILED",
      (queue, facts) =>
        `The ci check on ${facts.snapshot.head} is ${queue.conclusion}.${failedRun(queue)}${failedNotes(queue)}`
    ),
    fix: (facts) =>
      `Run: gh pr checks ${facts.queue?.n ?? "<pr#>"}, fix what it names, then gh run rerun <id> --failed`,
  }),
]
