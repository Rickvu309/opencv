import { deployLines, liveCheckLine } from "./migration-facts.mjs"
import { PR_FIELDS, pullFacts, pullOf } from "./pull-facts.mjs"
import { recorded, json, gh, run } from "./common.mjs"
import { decide, refusalError } from "../rules/index.mjs"
import { LABELS, allowMigrationLabel } from "../rules/merge-gate.mjs"
import { cleanup } from "../work.mjs"
import { billingOfPullRun } from "./billing-block.mjs"
import { ciRunOf } from "./why.mjs"

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

export function admit(facts, { allowMigrations = [] } = {}) {
  const allowed = [
    ...new Set([...(facts.migrations?.allowed ?? []), ...allowMigrations]),
  ]
  const wanted = allowMigrations.map(allowMigrationLabel)
  const have = facts.pull?.labels ?? []
  const add = [...new Set(wanted.filter((label) => !have.includes(label)))]
  const admitted = {
    ...facts,
    pull: { ...facts.pull, labels: [...have, ...add] },
    migrations: { ...facts.migrations, allowed },
  }
  const live = decide("pr", admitted)
  if (!live.ok) throw refusalError(live.refusals[0])
  return { facts: admitted, add }
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

function requestAutoMerge(ctx, n, head) {
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
      auto: false,
      reason:
        `${asked.err || asked.out}`
          .split("\n")
          .map((line) => line.trim())
          .find(Boolean) ?? "gh gave no reason",
    }
  return { auto: true }
}

export function autoMergeWhenGreen(ctx, n, head, opts = {}) {
  const { add } = admit(pullFacts(ctx, n), opts)
  applyLabels(ctx, n, add)
  return requestAutoMerge(ctx, n, head)
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

function mergedResult(ctx, n, pull, issue, migrations, lines) {
  closeIssues(ctx, pull, Number(issue))
  const said = [
    ...lines,
    `Merged PR #${n} as ${pull.mergeCommit?.oid}. Linked issues are closed.`,
    liveCheckLine(pull.mergeCommit?.oid, migrations),
  ]
  try {
    const result = cleanup(ctx, { n: Number(issue), flags: {} })
    return { id: n, lines: [...said, ...result.lines], next: result.next }
  } catch (error) {
    return {
      id: n,
      lines: [
        ...said,
        `Merged, but cleanup needs a hand: ${String(error.message).split("\n")[0]}`,
      ],
      next: `scripts/ocv-tools.mjs cleanup ${issue}`,
    }
  }
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
      asked.auto
        ? `Auto-merge is on: GitHub merges ${head} when ci is green.`
        : `Auto-merge could not be turned on (${asked.reason}); run merge ${n} again when ci is green.`,
    ],
    next: `When ci is green and the PR has merged: scripts/ocv-tools.mjs merge ${n}`,
  }
}

export function merge(ctx, n, { allowMigrations = [] } = {}) {
  return recorded(ctx, "merge-pr", () => {
    let pull = json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
    const me = gh(ctx, "api", "user", "--jq", ".login")
    const issue = /^(?:feat|fix|hotfix|refactor|chore|docs)\/(\d+)-/.exec(
      pull.headRefName
    )?.[1]
    const head = pull.headRefOid
    if (pull.state === "MERGED")
      return mergedResult(
        ctx,
        n,
        pull,
        issue,
        { files: [], allowed: allowMigrations },
        []
      )
    if (pull.state !== "OPEN") {
      const closed = decide("merge", {
        pull: pullOf(pull),
        me,
        ci: null,
        migrations: { files: [], allowed: allowMigrations },
      })
      if (!closed.ok) throw refusalError(closed.refusals[0])
    }
    const admitted = admit({ ...pullFacts(ctx, n), me }, { allowMigrations })
    const facts = admitted.facts
    applyLabels(ctx, n, admitted.add)
    const repo = repoName(ctx)
    facts.ci = newestCi(ctx, repo, head)
    const ciDone = facts.ci?.status === "completed"
    const failedCi =
      ciDone && facts.ci.conclusion && facts.ci.conclusion !== "success"
    facts.billing = failedCi ? billingOfPullRun(ctx, repo, head) : null
    if (admitted.add.length && failedCi && !facts.billing)
      return rerunForLabels(ctx, n, head, repo, admitted.add)
    if (!ciDone && pull.autoMergeRequest)
      return {
        id: n,
        status: "pending",
        lines: [
          `PR #${n} is on auto-merge: GitHub merges ${head} when ci is green.`,
        ],
        next: `When it has merged: scripts/ocv-tools.mjs merge ${n}`,
      }
    const ready = decide("merge", facts)
    if (!ready.ok) throw refusalError(ready.refusals[0])
    const lines = deployLines(facts.migrations)
    gh(ctx, "pr", "merge", String(n), "--squash", "--match-head-commit", head)
    pull = json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
    if (pull.state === "MERGED" && pull.headRefOid === head)
      return mergedResult(ctx, n, pull, issue, facts.migrations, lines)
    return {
      id: n,
      status: "pending",
      lines: [
        ...lines,
        pull.state === "MERGED"
          ? `PR #${n} merged at ${pull.headRefOid}, not at ${head}, the head this command checked. Check those commits by hand; the issue stays open.`
          : `Asked GitHub to merge PR #${n} at ${head}; it has not merged yet. Issue closure waits for the merge.`,
      ],
      next:
        pull.state === "MERGED"
          ? `gh pr view ${n} --json commits`
          : `scripts/ocv-tools.mjs merge ${n}`,
    }
  })
}
