import {
  recorded,
  json,
  gh,
  git,
  run,
  gate,
  refuse,
  diffFacts,
} from "./common.mjs"

const FIELDS =
  "number,url,state,author,isDraft,labels,headRefOid,headRefName,mergeCommit,closingIssuesReferences"

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

export function merge(ctx, n) {
  return recorded(ctx, "merge-pr", () => {
    let pull = json(ctx, "pr", "view", String(n), "--json", FIELDS)
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
    if (pull.state !== "MERGED") {
      if (pull.state !== "OPEN")
        refuse("CLOSED_PR", `PR #${n} is ${pull.state}.`)
      const head = pull.headRefOid
      if (!run(ctx, "git", ["cat-file", "-e", `${head}^{commit}`]).ok)
        git(ctx, "fetch", "--quiet", "origin", `pull/${n}/head`)
      git(ctx, "cat-file", "-e", `${head}^{commit}`)
      const files = gh(ctx, "pr", "diff", String(n), "--name-only").split("\n")
      const labels = json(
        ctx,
        "issue",
        "view",
        issue,
        "--json",
        "labels"
      ).labels.map((l) => l.name)
      const facts = diffFacts(ctx, files, head, labels)
      gate("CI_WORKFLOW_KEPT", facts)
      gate("RISK_HIGH_FOR_CI", facts)
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
      pull = json(ctx, "pr", "view", String(n), "--json", FIELDS)
      if (pull.state !== "MERGED" || !pull.mergeCommit?.oid)
        return {
          id: n,
          lines: [
            `Queued PR #${n} at ${head}. Issue closure waits for the merge; run merge again after the queue completes.`,
          ],
          next: `scripts/ocv-tools.mjs merge ${n}`,
        }
    }
    closeIssues(ctx, pull, Number(issue))
    return {
      id: n,
      lines: [
        `Merged PR #${n} as ${pull.mergeCommit?.oid}. Linked issues are closed.`,
      ],
      next: `scripts/ocv-tools.mjs cleanup ${issue}`,
    }
  })
}
