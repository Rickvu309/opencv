import { issueOfBranch } from "./pull-ref.mjs"

const FINISH_TITLE = /^(feat|fix|hotfix|refactor|chore|docs): [^ ].* \(#\d+\)$/
const SECTIONS = ["Summary", "Evidence", "Merge Danger"]
const FIX_TITLE = /^(?:fix|hotfix)(?:\([^)]*\))?!?: /
const LOCAL_PATH = /\/home\/|~\/tmp/
const COMMAND_HEAD =
  /^(?:cd\s+\S+\s*&&\s*)?(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*(?:(?:pnpm|npm|npx|node|git|gh|curl|vitest|tsc|bash|docker|make|python3?)\s+(?:\S*[^\s:])|(?:\.?\/?scripts\/\S*[\w])|\.\/\S*[\w])/
const COUNTED_RESULT =
  /\bexit(?:s|ed)?(?: code| status)?\s*[:=]?\s*\d+|(?<![\w/.-])\d+\/\d+(?![\w/.-])|\b\d+\s+(?:(?:tests?|checks?|assertions?|specs?)\s+)?(?:pass(?:ed|es)?|fail(?:ed|s|ures?)?|ok)\b|\b0\s+(?:mismatch(?:es)?|errors?|failures?|warnings?|violations?|findings?|offenders?|diffs?|differences|issues?)\b|\bno\s+(?:errors?|output|failures?|mismatch(?:es)?|warnings?|violations?|findings?|offenders?|diffs?|differences)\b|\bHTTP \d{3}\b/i
const VERDICT_WORD =
  "(?:pass(?:ed|es)?|fail(?:ed|s)?|success(?:ful)?|clean|ok)\\b(?!\\?)"
const SEPARATED_VERDICT = new RegExp(
  `(?:[:=(]|(?:^|\\s)(?:[-\u2013\u2014]|->|=>|\u2192)\\s)\\s*${VERDICT_WORD}`,
  "i"
)
const OUTPUT_VERDICT = new RegExp(`\\b${VERDICT_WORD}`, "i")
const NOT_A_RESULT = /\bnot run\b|\bnever ran\b|\bwould\b|\bshould\b|\bwill\b/i
const PICTURE = /!\[[^\]]*\]\([^)]+\)|<img\b/i
const PROOF_URL =
  /https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:actions\/runs\/\d+|pull\/\d+\/checks)|https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|mp4|webm)\b|https?:\/\/github\.com\/user-attachments\//i
const ANY_URL = /https?:\/\/\S+/i
const LIST_MARKER = /^(?:[-*+]|\d+[.)]|>|\$)\s+/
const CAUGHT_BY =
  /^\**Caught by:\**\s*(?:user|ci|review|verify-skill|test|agent-self)\s*$/m
const INTRODUCED_BY =
  /^\**Introduced by:\**\s*(?:[0-9a-f]{7,40}|#\d+|unknown)\s*$/m
const FINISH_FIX = "Fix the cause, then run scripts/ocv-tools.mjs finish again."
const REBASE =
  "git fetch origin && git rebase origin/main && git push --force-with-lease"
const MERGE_FIX =
  "Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>."

function sectionBody(text, heading) {
  const start = new RegExp(`^## ${heading}\\r?$`, "m").exec(text)
  if (!start) return null
  const rest = text.slice(start.index + start[0].length)
  const next = /^## /m.exec(rest)
  return (next ? rest.slice(0, next.index) : rest).trim()
}

const hasResult = (rest) =>
  COUNTED_RESULT.test(rest) || SEPARATED_VERDICT.test(rest)

function bareLine(line) {
  let text = line.trim()
  for (let i = 0; i < 2; i += 1) text = text.replace(LIST_MARKER, "")
  return text
}

function commandsIn(line) {
  const found = []
  for (const m of line.matchAll(/`([^`\n]+)`/g)) {
    const head = COMMAND_HEAD.exec(m[1].trim())
    if (head) found.push(line.slice(m.index + m[0].length))
  }
  const head = COMMAND_HEAD.exec(line)
  if (head) found.push(line.slice(head[0].length))
  return found
}

function lineProves(line) {
  if (NOT_A_RESULT.test(line)) return { proves: false, pending: false }
  const rests = commandsIn(line)
  const proves = rests.some(hasResult)
  const urlProof =
    PROOF_URL.test(line) || (ANY_URL.test(line) && hasResult(line))
  return { proves: proves || urlProof, pending: rests.length > 0 }
}

function hasRealEvidence(evidence) {
  if (PICTURE.test(evidence)) return true
  let inFence = false
  let pendingOutside = false
  let pendingInside = false
  for (const raw of evidence.split(/\r?\n/)) {
    const line = bareLine(raw)
    if (/^(?:```|~~~)/.test(line)) {
      pendingInside = !inFence && pendingOutside
      pendingOutside = false
      inFence = !inFence
      continue
    }
    if (inFence) {
      const { proves, pending } = lineProves(line)
      if (proves) return true
      if (pending) pendingInside = true
      else if (pendingInside && OUTPUT_VERDICT.test(line)) return true
      else if (pendingInside && COUNTED_RESULT.test(line)) return true
      continue
    }
    if (line === "") continue
    const { proves, pending } = lineProves(line)
    if (proves) return true
    pendingOutside = pending
  }
  return false
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
  if (LOCAL_PATH.test(text))
    return "The PR body names a path on your machine (/home/ or ~/tmp). Show the command and its result, or link a picture."
  if (!hasRealEvidence(sectionBody(text, "Evidence")))
    return "Evidence needs a command with its result on the same line or in the output block under it (exit 0, N passed, 0 mismatches), an image, or a link to a CI run."
  if (FIX_TITLE.test(facts.pull?.title ?? "")) {
    if (!CAUGHT_BY.test(text))
      return "A fix needs a line: Caught by: user|ci|review|verify-skill|test|agent-self"
    if (!INTRODUCED_BY.test(text))
      return "A fix needs a line: Introduced by: <sha>|#<pr>|unknown"
  }
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

const prNo = (facts) => facts.pull?.n ?? facts.queue?.n ?? "<pr#>"

const draft = (facts) =>
  facts.pull.isDraft ? `PR #${prNo(facts)} is a draft.` : null

const badBranch = (facts) =>
  issueOfBranch(facts.pull.branch) == null
    ? `PR #${prNo(facts)} has no linked issue in its branch name.`
    : null

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

const billingOf = (facts) =>
  facts.billing ??
  (facts.queue?.kind === "BILLING_BLOCKED" ? facts.queue : null)

const billingBlocked = (facts) => {
  const found = billingOf(facts)
  if (!found) return null
  return `CI cannot run on PR #${prNo(facts)}: GitHub did not start run ${found.runId} because the account's payments failed or its Actions spending limit is used up. A rerun or a new merge will not help.`
}

const billingFix = (facts) =>
  `Stop and tell the owner: open Billing & plans in the Rickvu309 organization settings, fix the failed payment or raise the Actions spending limit. After that, run scripts/ocv-tools.mjs merge ${prNo(facts)} --wait once`

const queueKind = (kind, message) => (facts) =>
  facts.queue.kind === kind ? message(facts.queue, facts) : null

const failedRun = (queue) =>
  queue.run?.html_url ? ` Failing run: ${queue.run.html_url}.` : ""

const failedNotes = (queue) =>
  queue.notes?.length ? `\n${queue.notes.join("\n")}` : ""

const FILES_SHOWN = 8

const fileList = (files) =>
  files.length > FILES_SHOWN
    ? `${files.slice(0, FILES_SHOWN).join(", ")} and ${files.length - FILES_SHOWN} more`
    : files.join(", ")

const mergeConflict = ({ mergeResult }) =>
  mergeResult.conflicts?.length
    ? `PR #${mergeResult.n} conflicts with origin/main in ${fileList(mergeResult.conflicts)}.`
    : null

const mergedTreeFails = ({ mergeResult }) =>
  mergeResult.failed?.length
    ? `PR #${mergeResult.n} merged with origin/main fails the quick guards: ${fileList(mergeResult.failed)}.`
    : null

const rebaseThenMerge = ({ mergeResult }) =>
  `From the PR worktree run: ${REBASE}; then fix what is named and run scripts/ocv-tools.mjs merge ${mergeResult?.n ?? "<pr#>"}`

const leftQueueMessage = (queue) => {
  const where = `PR #${queue.n} left the merge queue${queue.at ? ` at ${queue.at}` : ""}, reason ${queue.reason}.`
  if (queue.conflicts?.length)
    return `${where} It conflicts with origin/main in ${fileList(queue.conflicts)}.`
  if (queue.infra)
    return `${where} Infra: run ${queue.infra} ran no step in any job.`
  return where
}

const leftQueueFix = (facts) => {
  const n = facts.queue?.n ?? "<pr#>"
  if (facts.queue?.conflicts?.length)
    return `From the PR worktree run: ${REBASE}; resolve ${fileList(facts.queue.conflicts)}, then run scripts/ocv-tools.mjs merge ${n} --wait`
  if (facts.queue?.infra)
    return `Run scripts/ocv-tools.mjs merge ${n} --wait once to enqueue it again; the failure was the runner, not the change. If it fails the same way again, stop and tell the owner`
  return `Run: gh run list --branch 'gh-readonly-queue/main/pr-${n}-*' --limit 1`
}

const waitAgain = (facts) =>
  `Run: scripts/ocv-tools.mjs merge ${facts.queue?.n ?? "<pr#>"} --wait`

const headMovedFix = (facts) => {
  const n = facts.queue?.n ?? "<pr#>"
  if (!facts.queue?.handoff) return waitAgain(facts)
  const from = facts.queue.from ?? "<from>"
  const to = facts.queue.to ?? "<to>"
  if (facts.queue.merged)
    return `PR #${n} already merged at ${to}. This clone recorded ${from}. Check that merge by hand. Do not run merge --wait again.`
  return `Check the commits from ${from} to ${to}. If they are yours, run scripts/ocv-tools.mjs merge ${n} to queue and record the new head, then scripts/ocv-tools.mjs merge ${n} --wait.`
}

const githubHeadNote = (queue) =>
  queue.queuedByGitHub
    ? ` GitHub's queue entry is ${queue.queuedByGitHub}.`
    : " GitHub's queue entry has no head for this clone to compare."

const unrecordedHead = (facts) => {
  const queue = facts.queue
  if (queue?.kind !== "UNRECORDED_HEAD") return null
  const note = githubHeadNote(queue)
  if (queue.merged)
    return `PR #${queue.n} merged at ${queue.head}.${note} This clone did not record that head.`
  return `PR #${queue.n} is in the merge queue at ${queue.head}.${note} This clone did not record that head, so it is not reported merged.`
}

const unrecordedHeadFix = (facts) => {
  const n = facts.queue?.n ?? "<pr#>"
  if (facts.queue?.merged)
    return `PR #${n} merged at ${facts.queue.head}. This clone did not record that head. Check the merge by hand. Do not close the issue from this result.`
  return `Check the commits by hand. If they are yours, run scripts/ocv-tools.mjs merge ${n} to record the head, then scripts/ocv-tools.mjs merge ${n} --wait. This result does not close the issue.`
}

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
    says: "The PR body needs a Summary, Evidence and Merge Danger section with content, and no template placeholders. Evidence holds a command with its result on its line or in the output block under it, an image, or a link to a CI run. The body names no path under /home/ or ~/tmp. A fix or hotfix PR adds Caught by and Introduced by lines.",
    at: ["finish", "body"],
    needs: ["body", "pull"],
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
    id: "BILLING_BLOCKED",
    section: "6",
    says: "CI must have been able to start; a billing block needs the owner.",
    at: ["merge", "queue"],
    check: billingBlocked,
    fix: billingFix,
    exit: "HUMAN",
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
    id: "MERGE_CONFLICT",
    section: "6",
    says: "The PR head must merge into origin/main without a conflict.",
    at: ["merge-result"],
    needs: ["mergeResult"],
    check: mergeConflict,
    fix: rebaseThenMerge,
  }),
  row({
    id: "MERGED_TREE_FAILS",
    section: "6",
    says: "The PR merged with origin/main must pass the quick guards.",
    at: ["merge-result"],
    needs: ["mergeResult"],
    check: mergedTreeFails,
    fix: rebaseThenMerge,
  }),
  row({
    id: "LEFT_QUEUE",
    section: "6",
    says: "The PR must stay in the queue until it merges.",
    at: ["queue"],
    needs: ["queue"],
    check: queueKind("LEFT_QUEUE", leftQueueMessage),
    fix: leftQueueFix,
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
    fix: headMovedFix,
  }),
  row({
    id: "UNRECORDED_HEAD",
    section: "6",
    says: "A merge wait with no recorded head must not report a merged pull request it cannot vouch for.",
    at: ["queue"],
    needs: ["queue"],
    check: unrecordedHead,
    fix: unrecordedHeadFix,
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
