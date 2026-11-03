// merge <pr#> [--wait]: enqueue the squash merge, then with --wait watch the
// queue through one GraphQL snapshot per step until classify() settles it.
import { PR_FIELDS, pullFacts, pullOf } from "./pull-facts.mjs"
import { recorded, json, gh } from "./common.mjs"
import { decide, refusalError } from "../rules/index.mjs"
import { cleanup } from "../work.mjs"
import { conflictsOf, mergeResultFacts } from "./merged-tree.mjs"
import { billingOfPullRun, rerunFailed, steplessRun } from "./infra-rerun.mjs"

const WAIT_STEP_SECONDS = 15
const WAIT_LIMIT_SECONDS = 45 * 60
const RERUN_HOLD_SECONDS = 60

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

// The wait ended without a merge: the queue rows name why. The failed check's
// annotations are read only for a ci failure, so the agent sees what ci saw.
function failWait(ctx, repo, n, verdict, snapshot, extra = {}) {
  const failed =
    verdict.kind === "CI_FAILED" ? failedCheck(ctx, repo, snapshot.head) : null
  const notes = (failed?.notes ?? [])
    .slice(0, 5)
    .map((a) => `${a.path}:${a.start_line ?? 1} ${a.message}`)
  const found = decide("queue", {
    queue: {
      ...verdict,
      n,
      notes,
      run: failed?.run,
      ...extra,
      limitMinutes: WAIT_LIMIT_SECONDS / 60,
    },
    snapshot,
  })
  throw refusalError(found.refusals[0])
}

// The newest ci check run on the head, as the CI_REQUIRED row reads it.
function newestCi(ctx, repo, head) {
  const checks = json(
    ctx,
    "api",
    `repos/${repo}/commits/${head}/check-runs?check_name=ci&per_page=100`
  )
  const ci = checks.check_runs
    .filter((c) => c.name === "ci")
    .sort((a, b) => b.id - a.id)[0]
  return ci
    ? { status: ci.status, conclusion: ci.conclusion, head: ci.head_sha }
    : null
}

function leftQueueExtras(ctx, repo, n, verdict, snapshot) {
  if (verdict.kind !== "LEFT_QUEUE") return {}
  if (/^merge_conflict$/i.test(String(verdict.reason)))
    return { conflicts: conflictsOf(ctx, n, snapshot.head) }
  return {}
}

function settleInfra(ctx, repo, n, verdict, snapshot, state) {
  const failedChecks =
    verdict.kind === "LEFT_QUEUE" && /^failed_checks$/i.test(verdict.reason)
  if (verdict.kind !== "CI_FAILED" && !failedChecks) return { verdict }
  const run = steplessRun(ctx, repo, verdict, n, snapshot.head)
  if (!run) return { verdict }
  if (run.billing)
    return {
      verdict: { kind: "BILLING_BLOCKED", runId: run.id, message: run.billing },
    }
  if (verdict.kind === "CI_FAILED" && !state.reran) {
    state.reran = run.id
    state.lines.push(rerunFailed(ctx, run))
    return { verdict: null, hold: true }
  }
  return { verdict, extra: { infra: run.id } }
}

function enqueue(ctx, n, head) {
  gh(ctx, "pr", "merge", String(n), "--squash", "--match-head-commit", head)
}

function requeueAfterRerun(ctx, n, startHead, snapshot, state) {
  if (!state.reran || state.requeued || snapshot.inQueue) return
  if (snapshot.ci?.status !== "completed") return
  if (snapshot.ci.conclusion !== "success") return
  state.requeued = true
  enqueue(ctx, n, startHead)
  state.lines.push(
    `The rerun of run ${state.reran} passed, so PR #${n} was queued again at ${startHead}.`
  )
}

function waitForMerge(ctx, n, startHead, repo, state) {
  let holdUntil = 0
  for (let waited = 0; ; waited += WAIT_STEP_SECONDS) {
    const snapshot = queueSnapshot(ctx, repo, n, waited)
    let verdict = classify(snapshot, true, startHead)
    if (verdict?.kind === "MERGED")
      return json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
    if (verdict?.kind === "CI_FAILED" && waited < holdUntil) verdict = null
    if (!verdict && waited >= holdUntil)
      requeueAfterRerun(ctx, n, startHead, snapshot, state)
    if (verdict) {
      const settled = settleInfra(ctx, repo, n, verdict, snapshot, state)
      if (settled.hold) holdUntil = waited + RERUN_HOLD_SECONDS
      if (settled.verdict)
        failWait(ctx, repo, n, settled.verdict, snapshot, {
          ...leftQueueExtras(ctx, repo, n, settled.verdict, snapshot),
          ...settled.extra,
        })
    }
    ctx.pause(WAIT_STEP_SECONDS)
  }
}

export function merge(ctx, n, { wait = false } = {}) {
  return recorded(ctx, "merge-pr", () => {
    let pull = json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
    const me = gh(ctx, "api", "user", "--jq", ".login")
    const issue = /^(?:feat|fix|hotfix|refactor|chore|docs)\/(\d+)-/.exec(
      pull.headRefName
    )?.[1]
    const head = pull.headRefOid
    let repo = null
    // An open PR is read in full: the pr rows (the same ones policy runs) first,
    // then the merge rows with the newest ci check. A merged or closed PR needs
    // only the merge rows, which read its state.
    const open = pull.state === "OPEN"
    const facts = open
      ? { ...pullFacts(ctx, n), me }
      : { pull: pullOf(pull), me, ci: null }
    if (open) {
      const live = decide("pr", facts)
      if (!live.ok) throw refusalError(live.refusals[0])
      repo = gh(
        ctx,
        "repo",
        "view",
        "--json",
        "nameWithOwner",
        "--jq",
        ".nameWithOwner"
      )
      facts.ci = newestCi(ctx, repo, head)
      const failedCi =
        facts.ci?.status === "completed" &&
        facts.ci.conclusion &&
        facts.ci.conclusion !== "success"
      facts.billing = failedCi ? billingOfPullRun(ctx, repo, head) : null
    }
    const ready = decide("merge", facts)
    if (!ready.ok) throw refusalError(ready.refusals[0])
    const state = { lines: [], reran: null, requeued: false }
    if (open) {
      const mergeResult = mergeResultFacts(ctx, n, head)
      state.lines.push(...mergeResult.lines)
      const joined = decide("merge-result", { mergeResult })
      if (!joined.ok) throw refusalError(joined.refusals[0])
    }
    if (pull.state !== "MERGED") {
      enqueue(ctx, n, head)
      pull = json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
      if (pull.state !== "MERGED" || !pull.mergeCommit?.oid) {
        if (!wait)
          return {
            id: n,
            status: "pending",
            lines: [
              ...state.lines,
              `Queued PR #${n} at ${head}. Issue closure waits for the merge.`,
            ],
            next: `Run in the background and end the turn until it exits: scripts/ocv-tools.mjs merge ${n} --wait`,
          }
        pull = waitForMerge(ctx, n, head, repo, state)
      }
    }
    closeIssues(ctx, pull, Number(issue))
    const lines = [
      ...state.lines,
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
