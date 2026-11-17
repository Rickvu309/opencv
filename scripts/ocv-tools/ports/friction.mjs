import { inWindow, isFix, queuePrNumber } from "../friction.mjs"

export function parseCommits(text) {
  return text
    .split("\x1e")
    .filter((record) => record.trim())
    .map((record) => {
      const [sha, committerDate, subject] = record.trim().split("\x1f")
      return { sha, committerDate, subject, origins: [] }
    })
}

export function replacedRanges(diff) {
  const ranges = []
  let path
  for (const line of diff.split("\n")) {
    if (line.startsWith("--- ")) {
      const raw = line.slice(4)
      path = raw.startsWith('"') ? JSON.parse(raw).slice(2) : raw.slice(2)
    }
    const match = line.match(/^@@ -(\d+)(?:,(\d+))? /)
    if (match && Number(match[2] ?? 1) > 0)
      ranges.push({
        path,
        start: Number(match[1]),
        count: Number(match[2] ?? 1),
      })
  }
  return ranges
}

export function blameOrigins(text) {
  const counts = new Map()
  for (const match of text.matchAll(/^([0-9a-f]{40}) \d+ \d+(?: \d+)?$/gm))
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1)
  return [...counts]
    .map(([sha, lines]) => ({ sha, lines }))
    .sort((a, b) => b.lines - a.lines || a.sha.localeCompare(b.sha))
}

export function fetchFriction(ctx, window) {
  const run = (cmd, args, options = {}) => {
    const result = ctx.ports.proc.run(cmd, args, { cwd: ctx.cwd, ...options })
    if (!result.ok)
      throw new Error(
        `friction: ${cmd} ${args[0]} failed: ${result.err || result.out}`
      )
    return result.out
  }
  const git = (...args) => run("git", args)
  const gh = (...args) => JSON.parse(run("gh", args))
  const repo = ctx.ports.gh.repo().nameWithOwner
  const api = (route) => gh("api", `repos/${repo}/${route}`)
  const pages = (route, pick = (data) => data) => {
    const items = []
    for (let page = 1; ; page++) {
      const data = api(
        `${route}${route.includes("?") ? "&" : "?"}per_page=100&page=${page}`
      )
      if (data.total_count > 1000)
        throw new Error(
          "friction: GitHub limits this search to 1000 runs; use a smaller window"
        )
      const batch = pick(data)
      if (!Array.isArray(batch))
        throw new Error("friction: GitHub returned an unreadable page")
      items.push(...batch)
      if (batch.length < 100) return items
    }
  }
  git("fetch", "origin", "main")
  const tip = git("rev-parse", "origin/main")
  const commits = parseCommits(
    git(
      "log",
      tip,
      `--since-as-filter=${window.since}`,
      `--until=${window.until}`,
      "--format=%H%x1f%cI%x1f%s%x1e"
    )
  ).filter((commit) => inWindow(commit.committerDate, window))
  for (const commit of commits.filter((item) => isFix(item.subject))) {
    const parents = git("show", "-s", "--format=%P", commit.sha)
      .split(" ")
      .filter(Boolean)
    if (!parents.length) continue
    const diff = git(
      "-c",
      "core.quotePath=false",
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--no-renames",
      "--unified=0",
      parents[0],
      commit.sha,
      "--"
    )
    const blame = replacedRanges(diff).map(({ path, start, count }) =>
      git(
        "blame",
        "--porcelain",
        "-L",
        `${start},+${count}`,
        parents[0],
        "--",
        path
      )
    )
    commit.origins = blameOrigins(blame.join("\n"))
  }
  const prs = gh(
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "merged",
    "--base",
    "main",
    "--search",
    `merged:${window.since}..${window.until}`,
    "--limit",
    "1000",
    "--json",
    "number,title,body,mergedAt,mergeCommit,headRefName,changedFiles"
  )
  if (prs.length >= 1000)
    throw new Error(
      "friction: PR search reached GitHub's 1000 result limit; use a smaller window"
    )
  const pullRequests = prs
    .filter((pr) => inWindow(pr.mergedAt, window))
    .map((pr) => {
      if (pr.changedFiles > 3000)
        throw new Error(
          `friction: PR #${pr.number} exceeds GitHub's 3000-file limit`
        )
      const files = pages(`pulls/${pr.number}/files`)
      if (files.length !== pr.changedFiles)
        throw new Error(`friction: incomplete file list for PR #${pr.number}`)
      if (!pr.mergeCommit?.oid)
        throw new Error(`friction: missing merge commit for PR #${pr.number}`)
      const attrs = run(
        "git",
        [
          "check-attr",
          `--source=${pr.mergeCommit.oid}`,
          "-z",
          "--stdin",
          "linguist-generated",
        ],
        {
          input: files.map((file) => file.filename).join("\0") + "\0",
          raw: true,
        }
      ).split("\0")
      const generated = new Set()
      for (let index = 0; index + 2 < attrs.length; index += 3)
        if (["true", "set"].includes(attrs[index + 2]))
          generated.add(attrs[index])
      return {
        ...pr,
        files: files.map((file) => ({
          path: file.filename,
          added: file.additions,
          generated: generated.has(file.filename),
        })),
      }
    })
  const normalizeRun = (run, number) => ({
    id: run.id,
    event: run.event,
    createdAt: run.created_at,
    conclusion: run.conclusion,
    headBranch: run.head_branch,
    pullRequestNumbers: [
      ...new Set([
        ...(run.pull_requests ?? []).map((pr) => pr.number),
        ...(number ? [number] : []),
      ]),
    ].sort((a, b) => a - b),
  })
  const runs = ["pull_request", "merge_group"].flatMap((event) =>
    pages(
      `actions/workflows/ci.yml/runs?event=${event}&created=${encodeURIComponent(`${window.since}..${window.until}`)}`,
      (data) => data.workflow_runs
    ).map((run) => normalizeRun(run))
  )
  const queueNumbers = [
    ...new Set(
      runs
        .filter(
          (run) => run.event === "merge_group" && run.conclusion === "failure"
        )
        .map((run) => queuePrNumber(run.headBranch))
    ),
  ].sort((a, b) => a - b)
  for (const number of queueNumbers) {
    if (!number)
      throw new Error(
        "friction: cannot identify a failed merge-queue PR from its ref"
      )
    const pr =
      pullRequests.find((pr) => pr.number === number) ??
      gh("pr", "view", String(number), "--repo", repo, "--json", "headRefName")
    if (!pr.headRefName)
      throw new Error(`friction: missing branch for queue PR #${number}`)
    const earlier = pages(
      `actions/workflows/ci.yml/runs?event=pull_request&branch=${encodeURIComponent(pr.headRefName)}&created=${encodeURIComponent(`<=${window.until}`)}`,
      (data) => data.workflow_runs
    )
    for (const item of earlier) {
      const linked = (item.pull_requests ?? []).map((pr) => pr.number)
      if (!linked.length || linked.includes(number))
        runs.push(normalizeRun(item, number))
    }
  }
  return { window, commits, pullRequests, runs }
}
