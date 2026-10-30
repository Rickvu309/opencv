// merge <pr#> [--wait]: enqueue the squash merge, then with --wait watch the
// queue through one GraphQL snapshot per step until classify() settles it.
import { PR_FIELDS, pullFacts } from "./pull-facts.mjs"
import { recorded, json, gh, refuse } from "./common.mjs"
import { decide, refusalError } from "../rules/index.mjs"
import { cleanup } from "../work.mjs"

const WAIT_STEP_SECONDS = 15
const WAIT_LIMIT_SECONDS = 45 * 60

function closeIssues(ctx, pull, n) {
  const issues = new Set([
    n,
    ...(pull.closingIssuesReferences ?? []).map((i) => i.number),
  ])
  for (const issue of issues) {
    let state = json(
      ctx,
      "issue",
      "view",
      String(issue),
      "--json",
      "state"
    ).state
    if (state !== "CLOSED") {
      gh(ctx, "issue", "close", String(issue))
      state = json(ctx, "issue", "view", String(issue), "--json", "state").state
    }
    if (state !== "CLOSED")
      throw new Error(
        `PR #${pull.number} merged, but issue #${issue} is still open. Run merge again.`
      )
  }
}

const SNAPSHOT_QUERY = `query ($owner: String!, $name: String!, $n: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $n) {
      state
      headRefOid
      mergeCommit { oid }
      isInMergeQueue
      mergeQueueEntry { state position }
      headRef {
        target {
          ... on Commit {
            statusCheckRollup {
              contexts(first: 50) {
                nodes {
                  ... on CheckRun { name status conclusion completedAt }
                }
              }
            }
          }
        }
      }
      timelineItems(last: 5, itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT]) {
        nodes {
          __typename
          ... on RemovedFromMergeQueueEvent { reason createdAt }
        }
      }
    }
  }
}`

// One read per wait step: queue state, head, the newest ci check and the last
// removal event.
function queueSnapshot(ctx, repo, n, waited) {
  const [owner, name] = repo.split("/")
  const data = json(
    ctx,
    "api",
    "graphql",
    "-f",
    `query=${SNAPSHOT_QUERY}`,
    "-F",
    `owner=${owner}`,
    "-F",
    `name=${name}`,
    "-F",
    `n=${n}`
  )
  const pr = data?.data?.repository?.pullRequest
  if (!pr) throw new Error(`no pull request #${n} in the queue snapshot`)
  const contexts = pr.headRef?.target?.statusCheckRollup?.contexts?.nodes ?? []
  const ci = contexts
    .filter((c) => c?.name === "ci" && c?.status)
    .sort((a, b) =>
      String(b.completedAt ?? "").localeCompare(String(a.completedAt ?? ""))
    )[0]
  const removed = (pr.timelineItems?.nodes ?? [])
    .filter((e) => e?.__typename === "RemovedFromMergeQueueEvent")
    .at(-1)
  return {
    state: pr.state,
    head: pr.headRefOid,
    inQueue: Boolean(pr.isInMergeQueue),
    queueState: pr.mergeQueueEntry?.state ?? null,
    ci: ci ? { status: ci.status, conclusion: ci.conclusion } : null,
    removed: removed ? { reason: removed.reason, at: removed.createdAt } : null,
    waited,
  }
}

// Pure: one snapshot plus what this process did settles into one outcome, or
// null to keep waiting.
export function classify(s, enqueued, startHead) {
  if (s.state === "MERGED") return { kind: "MERGED" }
  if (s.head && startHead && s.head !== startHead)
    return { kind: "HEAD_MOVED", from: startHead, to: s.head }
  if (s.state === "CLOSED")
    return {
      kind: "LEFT_QUEUE",
      reason: s.removed?.reason ?? "CLOSED",
      at: s.removed?.at,
    }
  if (!s.inQueue) {
    if (
      s.ci?.status === "completed" &&
      s.ci.conclusion &&
      s.ci.conclusion !== "success"
    )
      return { kind: "CI_FAILED", conclusion: s.ci.conclusion }
    if (s.removed)
      return { kind: "LEFT_QUEUE", reason: s.removed.reason, at: s.removed.at }
  }
  if (s.waited >= WAIT_LIMIT_SECONDS)
    return { kind: "QUEUE_TIMEOUT", queueState: s.queueState }
  return null
}

// The failed check run's own annotations, so the agent reads what ci saw
// instead of a recompute against today's facts.
function failedCheck(ctx, repo, head) {
  const runs =
    json(
      ctx,
      "api",
      `repos/${repo}/commits/${head}/check-runs?check_name=ci&per_page=100`
    ).check_runs ?? []
  const failed = runs
    .filter(
      (c) =>
        c.name === "ci" &&
        c.status === "completed" &&
        c.conclusion &&
        c.conclusion !== "success"
    )
    .sort((a, b) => b.id - a.id)[0]
  if (!failed) return null
  let notes = []
  try {
    notes = json(
      ctx,
      "api",
      `repos/${repo}/check-runs/${failed.id}/annotations?per_page=10`
    )
  } catch {
    notes = []
  }
  return { run: failed, notes }
}

function failWait(ctx, repo, n, verdict, snapshot) {
  if (verdict.kind === "HEAD_MOVED")
    refuse(
      "HEAD_MOVED",
      `PR #${n} head moved from ${verdict.from} to ${verdict.to}.`,
      `Run: scripts/ocv-tools.mjs merge ${n} --wait`
    )
  if (verdict.kind === "CI_FAILED") {
    const failed = failedCheck(ctx, repo, snapshot.head)
    const notes = (failed?.notes ?? [])
      .slice(0, 5)
      .map((a) => `${a.path}:${a.start_line ?? 1} ${a.message}`)
    refuse(
      "CI_FAILED",
      `The ci check on ${snapshot.head} is ${verdict.conclusion}.${failed?.run?.html_url ? ` Failing run: ${failed.run.html_url}.` : ""}${notes.length ? `\n${notes.join("\n")}` : ""}`,
      `Run: gh pr checks ${n}, fix what it names, then gh run rerun <id> --failed`
    )
  }
  if (verdict.kind === "LEFT_QUEUE")
    refuse(
      "LEFT_QUEUE",
      `PR #${n} left the merge queue${verdict.at ? ` at ${verdict.at}` : ""}, reason ${verdict.reason}.`,
      `Run: gh run list --branch 'gh-readonly-queue/main/pr-${n}-*' --limit 1`
    )
  refuse(
    "QUEUE_TIMEOUT",
    `PR #${n} is still not merged after ${WAIT_LIMIT_SECONDS / 60} minutes${verdict.queueState ? ` (${verdict.queueState})` : ""}.`,
    `Run: scripts/ocv-tools.mjs merge ${n} --wait`
  )
}

function waitForMerge(ctx, n, startHead, repo) {
  for (let waited = 0; ; waited += WAIT_STEP_SECONDS) {
    const snapshot = queueSnapshot(ctx, repo, n, waited)
    const verdict = classify(snapshot, true, startHead)
    if (verdict?.kind === "MERGED")
      return json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
    if (verdict) failWait(ctx, repo, n, verdict, snapshot)
    ctx.pause(WAIT_STEP_SECONDS)
  }
}

export function merge(ctx, n, { wait = false } = {}) {
  return recorded(ctx, "merge-pr", () => {
    let pull = json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
    const me = gh(ctx, "api", "user", "--jq", ".login")
    if (pull.author.login.toLowerCase() !== me.toLowerCase())
      refuse("NOT_OWNER", `PR #${n} is by ${pull.author.login}, not ${me}.`)
    if (pull.isDraft)
      refuse("DRAFT", `PR #${n} is a draft.`, `Run: gh pr ready ${n}`)
    if (pull.labels.some((l) => l.name === "needs-human-review"))
      refuse(
        "NEEDS_HUMAN_REVIEW",
        `PR #${n} needs human review; an agent never merges it.`
      )
    const issue = /^(?:feat|fix|hotfix|refactor|chore|docs)\/(\d+)-/.exec(
      pull.headRefName
    )?.[1]
    if (!issue)
      refuse("BAD_BRANCH", `PR #${n} has no linked issue in its branch name.`)
    const head = pull.headRefOid
    if (pull.state !== "MERGED") {
      if (pull.state !== "OPEN")
        refuse("CLOSED_PR", `PR #${n} is ${pull.state}.`)
      // The pr rows run against the live pull request so a refusal is learned
      // here, not after the queue's policy job.
      const verdict = decide("pr", pullFacts(ctx, n))
      if (!verdict.ok) throw refusalError(verdict.refusals[0])
      const repo = gh(
        ctx,
        "repo",
        "view",
        "--json",
        "nameWithOwner",
        "--jq",
        ".nameWithOwner"
      )
      const checks = json(
        ctx,
        "api",
        `repos/${repo}/commits/${head}/check-runs?check_name=ci&per_page=100`
      )
      const ci = checks.check_runs
        .filter((c) => c.name === "ci")
        .sort((a, b) => b.id - a.id)[0]
      if (
        !ci ||
        ci.status !== "completed" ||
        ci.conclusion !== "success" ||
        ci.head_sha !== head
      )
        refuse(
          "CI_REQUIRED",
          `The ci check on head ${head} is ${ci?.conclusion ?? "pending or missing"}, not success.`,
          `Run: gh run list --workflow ci.yml --commit ${head}`
        )
      gh(ctx, "pr", "merge", String(n), "--squash", "--match-head-commit", head)
      pull = json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
      if (pull.state !== "MERGED" || !pull.mergeCommit?.oid) {
        if (!wait)
          return {
            id: n,
            status: "pending",
            lines: [
              `Queued PR #${n} at ${head}. Issue closure waits for the merge.`,
            ],
            next: `Run in the background and end the turn until it exits: scripts/ocv-tools.mjs merge ${n} --wait`,
          }
        pull = waitForMerge(ctx, n, head, repo)
      }
    }
    closeIssues(ctx, pull, Number(issue))
    const lines = [
      `Merged PR #${n} as ${pull.mergeCommit?.oid}. Linked issues are closed.`,
    ]
    if (wait) {
      try {
        const result = cleanup(ctx, { n: Number(issue), flags: {} })
        return { id: n, lines: [...lines, ...result.lines], next: result.next }
      } catch (error) {
        lines.push(
          `Merged, but cleanup needs a hand: ${String(error.message).split("\n")[0]}`
        )
      }
    }
    return {
      id: n,
      lines,
      next: `scripts/ocv-tools.mjs cleanup ${issue}`,
    }
  })
}
