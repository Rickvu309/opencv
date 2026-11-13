import { dirname, join } from "node:path"
import { deployLines, liveCheckLine } from "./migration-facts.mjs"
import { PR_FIELDS, pullFacts, pullOf } from "./pull-facts.mjs"
import { recorded, json, gh, git, run } from "./common.mjs"
import { decide, refusalError } from "../rules/index.mjs"
import {
  LABELS,
  allowMigrationLabel,
  ownerBecause,
} from "../rules/merge-gate.mjs"
import { cleanup } from "../work.mjs"
import { conflictsOf, mergeResultFacts } from "./merged-tree.mjs"
import { billingOfPullRun, rerunFailed, steplessRun } from "./infra-rerun.mjs"
import { ciRunOf } from "./why.mjs"

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
      mergeQueueEntry { state position headCommit { oid } }
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
      timelineItems(last: 10, itemTypes: [ADDED_TO_MERGE_QUEUE_EVENT, REMOVED_FROM_MERGE_QUEUE_EVENT]) {
        nodes {
          __typename
          ... on AddedToMergeQueueEvent { createdAt }
          ... on RemovedFromMergeQueueEvent { reason createdAt }
        }
      }
    }
  }
}`

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
  const removed = removalAfterEnqueue(
    pr.timelineItems?.nodes ?? [],
    readQueuedRecord(ctx, n)?.at ?? null
  )
  return {
    state: pr.state,
    head: pr.headRefOid,
    inQueue: Boolean(pr.isInMergeQueue),
    queueState: pr.mergeQueueEntry?.state ?? null,
    queuedHead: pr.mergeQueueEntry?.headCommit?.oid ?? null,
    ci: ci
      ? {
          status: String(ci.status).toLowerCase(),
          conclusion: ci.conclusion
            ? String(ci.conclusion).toLowerCase()
            : null,
        }
      : null,
    removed,
    waited,
  }
}

export function classify(s, enqueued, startHead) {
  if (s.head && startHead && s.head !== startHead)
    return { kind: "HEAD_MOVED", from: startHead, to: s.head }
  if (s.state === "MERGED") return { kind: "MERGED" }
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

function failedCiRunWithItsAnnotations(ctx, repo, head) {
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

function failWait(ctx, repo, n, verdict, snapshot, extra = {}) {
  const failed =
    verdict.kind === "CI_FAILED"
      ? failedCiRunWithItsAnnotations(ctx, repo, snapshot.head)
      : null
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

function parsedTime(value) {
  const t = Date.parse(value ?? "")
  return Number.isNaN(t) ? null : t
}

function latestTime(times) {
  let max = null
  for (const time of times) {
    if (time == null) continue
    if (max == null || time > max) max = time
  }
  return max
}

function removalAfterEnqueue(nodes, recordedAt) {
  const list = nodes ?? []
  const floor = latestTime([
    latestTime(
      list
        .filter((e) => e?.__typename === "AddedToMergeQueueEvent")
        .map((e) => parsedTime(e.createdAt))
    ),
    parsedTime(recordedAt),
  ])
  const removed = list
    .filter((e) => e?.__typename === "RemovedFromMergeQueueEvent")
    .filter((e) => {
      if (floor == null) return true
      const at = parsedTime(e.createdAt)
      return at == null || at > floor
    })
    .sort(
      (a, b) => (parsedTime(a.createdAt) ?? 0) - (parsedTime(b.createdAt) ?? 0)
    )
    .at(-1)
  return removed ? { reason: removed.reason, at: removed.createdAt } : null
}

function queuedHeadFile(ctx, n) {
  const common = git(
    ctx,
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir"
  )
  return join(common, "ocv-merge-wait", String(n))
}

function readQueuedRecord(ctx, n) {
  const path = queuedHeadFile(ctx, n)
  if (!ctx.ports.fs.exists(path)) return null
  const [head, at] = ctx.ports.fs.read(path).trim().split("\n")
  if (!head) return null
  return { head, at: at || null }
}

function readQueuedHead(ctx, n) {
  return readQueuedRecord(ctx, n)?.head ?? null
}

function writeQueuedHead(ctx, n, head) {
  const path = queuedHeadFile(ctx, n)
  ctx.ports.fs.mkdir(dirname(path))
  const at = new Date(ctx.now()).toISOString()
  ctx.ports.fs.write(path, `${head}\n${at}\n`)
}

function pullSnapshot(pull, extra = {}) {
  return {
    state: pull.state,
    head: pull.headRefOid,
    inQueue: false,
    queueState: null,
    ci: null,
    removed: null,
    waited: 0,
    ...extra,
  }
}

function githubQueueHead(ctx, n) {
  const repo = gh(
    ctx,
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner"
  )
  const snapshot = queueSnapshot(ctx, repo, n, 0)
  return { inQueue: snapshot.inQueue, queuedByGitHub: snapshot.queuedHead }
}

export function admit(facts, { allowMigrations = [], ownerYes = false } = {}) {
  const allowed = [
    ...new Set([...(facts.migrations?.allowed ?? []), ...allowMigrations]),
  ]
  const wanted = allowMigrations.map(allowMigrationLabel)
  const owner = ownerBecause({
    ...facts,
    migrations: { ...facts.migrations, allowed },
  })
  if (ownerYes && owner.length) wanted.push(LABELS.ownerApproved)
  const have = facts.pull?.labels ?? []
  const add = [...new Set(wanted.filter((label) => !have.includes(label)))]
  const admitted = {
    ...facts,
    pull: { ...facts.pull, labels: [...have, ...add] },
    migrations: { ...facts.migrations, allowed },
  }
  const live = decide("pr", admitted)
  if (!live.ok) throw refusalError(live.refusals[0])
  return { facts: admitted, add, owner }
}

function applyLabels(ctx, n, add) {
  if (!add.length) return
  for (const label of add)
    if (label.startsWith(`${LABELS.allowMigration}:`))
      gh(
        ctx,
        "label",
        "create",
        label,
        "--force",
        "--color",
        "B60205",
        "--description",
        "The owner allowed this migration to change existing things"
      )
  gh(ctx, "pr", "edit", String(n), "--add-label", add.join(","))
}

export function requestAutoMerge(ctx, n, head) {
  const asked = run(ctx, "gh", [
    "pr",
    "merge",
    String(n),
    "--squash",
    "--auto",
    "--match-head-commit",
    head,
  ])
  if (!asked.ok)
    return {
      queued: "off",
      reason:
        `${asked.err || asked.out}`
          .split("\n")
          .map((line) => line.trim())
          .find(Boolean) ?? "gh gave no reason",
    }
  writeQueuedHead(ctx, n, head)
  return { queued: "auto" }
}

export function enqueue(ctx, n, head, opts = {}) {
  const { add } = admit(pullFacts(ctx, n), opts)
  applyLabels(ctx, n, add)
  return requestAutoMerge(ctx, n, head)
}

function queueNow(ctx, n, head) {
  gh(ctx, "pr", "merge", String(n), "--squash", "--match-head-commit", head)
  writeQueuedHead(ctx, n, head)
}

function requeueAfterRerun(ctx, n, startHead, snapshot, state) {
  if (state.auto || !state.reran || state.requeued || snapshot.inQueue) return
  if (snapshot.ci?.status !== "completed") return
  if (snapshot.ci.conclusion !== "success") return
  state.requeued = true
  queueNow(ctx, n, startHead)
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

function repoName(ctx) {
  return gh(
    ctx,
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner"
  )
}

function mergedResult(ctx, n, pull, issue, migrations, state, wait) {
  closeIssues(ctx, pull, Number(issue))
  const lines = [
    ...state.lines,
    `Merged PR #${n} as ${pull.mergeCommit?.oid}. Linked issues are closed.`,
    liveCheckLine(pull.mergeCommit?.oid, migrations),
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
}

function waitOnAutoMerge(ctx, n, pull, issue, wait) {
  const head = pull.headRefOid
  const said = `PR #${n} is on auto-merge: GitHub queues ${head} when ci is green, so merge queues nothing and runs no merged-tree check.`
  if (!wait)
    return {
      id: n,
      status: "pending",
      lines: [said],
      next: `Run in the background and end the turn until it exits: scripts/ocv-tools.mjs merge ${n} --wait`,
    }
  const facts = pullFacts(ctx, n)
  writeQueuedHead(ctx, n, head)
  const state = {
    lines: [...deployLines(facts.migrations), said],
    reran: null,
    requeued: false,
    auto: true,
  }
  const merged = waitForMerge(ctx, n, head, repoName(ctx), state)
  return mergedResult(ctx, n, merged, issue, facts.migrations, state, wait)
}

function rerunForLabels(ctx, n, head, repo, add) {
  const ciRun = ciRunOf(ctx, repo, head)
  if (ciRun) gh(ctx, "run", "rerun", String(ciRun.id), "--failed")
  const asked = requestAutoMerge(ctx, n, head)
  return {
    id: n,
    status: "pending",
    lines: [
      `Added ${add.join(", ")} to PR #${n}. The policy check read the labels before, so ${ciRun ? `the failed jobs of run ${ciRun.id} run again` : "ci must run again"}.`,
      asked.queued === "auto"
        ? `Auto-merge is on: GitHub queues ${head} when ci is green.`
        : `Auto-merge could not be turned on (${asked.reason}); run merge ${n} again when ci is green.`,
    ],
    next: `Run in the background and end the turn until it exits: scripts/ocv-tools.mjs merge ${n} --wait`,
  }
}

export function merge(ctx, n, { wait = false, allowMigrations = [] } = {}) {
  return recorded(ctx, "merge-pr", () => {
    let pull = json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
    const me = gh(ctx, "api", "user", "--jq", ".login")
    const issue = /^(?:feat|fix|hotfix|refactor|chore|docs)\/(\d+)-/.exec(
      pull.headRefName
    )?.[1]
    const head = pull.headRefOid
    if (
      pull.state === "OPEN" &&
      pull.autoMergeRequest &&
      !allowMigrations.length
    )
      return waitOnAutoMerge(ctx, n, pull, issue, wait)
    const queued = readQueuedHead(ctx, n)
    if (wait && queued && queued !== head) {
      failWait(
        ctx,
        null,
        n,
        { kind: "HEAD_MOVED", from: queued, to: head },
        pullSnapshot(pull),
        { handoff: true, merged: pull.state === "MERGED" }
      )
    }
    if (wait && !queued) {
      const github = githubQueueHead(ctx, n)
      if (pull.state === "MERGED" || github.inQueue) {
        failWait(
          ctx,
          null,
          n,
          {
            kind: "UNRECORDED_HEAD",
            head,
            merged: pull.state === "MERGED",
            queuedByGitHub: github.queuedByGitHub,
          },
          pullSnapshot(pull, { inQueue: github.inQueue })
        )
      }
    }
    let repo = null
    const open = pull.state === "OPEN"
    let facts = open
      ? { ...pullFacts(ctx, n), me }
      : {
          pull: pullOf(pull),
          me,
          ci: null,
          migrations: { files: [], allowed: allowMigrations },
        }
    if (open) {
      const admitted = admit(facts, { allowMigrations, ownerYes: true })
      facts = admitted.facts
      applyLabels(ctx, n, admitted.add)
      repo = repoName(ctx)
      facts.ci = newestCi(ctx, repo, head)
      const failedCi =
        facts.ci?.status === "completed" &&
        facts.ci.conclusion &&
        facts.ci.conclusion !== "success"
      facts.billing = failedCi ? billingOfPullRun(ctx, repo, head) : null
      if (admitted.add.length && failedCi && !facts.billing)
        return rerunForLabels(ctx, n, head, repo, admitted.add)
    }
    const ready = decide("merge", facts)
    if (!ready.ok) throw refusalError(ready.refusals[0])
    const state = {
      lines: open ? deployLines(facts.migrations) : [],
      reran: null,
      requeued: false,
    }
    const alreadyQueued = open && wait && queueSnapshot(ctx, repo, n, 0).inQueue
    if (alreadyQueued)
      state.lines.push(
        `PR #${n} is already in the merge queue, so the merged-tree check was not run again.`
      )
    if (wait && pull.state === "MERGED")
      state.lines.push(
        `PR #${n} is already merged, so the merged-tree check was not run again.`
      )
    if (open && !alreadyQueued) {
      const mergeResult = mergeResultFacts(ctx, n, head)
      state.lines.push(...mergeResult.lines)
      const joined = decide("merge-result", { mergeResult })
      if (!joined.ok) throw refusalError(joined.refusals[0])
    }
    if (pull.state !== "MERGED") {
      if (!alreadyQueued) {
        queueNow(ctx, n, head)
        pull = json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
      }
      const mergedAtHead =
        pull.state === "MERGED" &&
        Boolean(pull.mergeCommit?.oid) &&
        pull.headRefOid === head
      if (!mergedAtHead) {
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
    return mergedResult(ctx, n, pull, issue, facts.migrations, state, wait)
  })
}
