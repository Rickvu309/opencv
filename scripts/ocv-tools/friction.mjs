import { countedSourceFiles } from "./rules/diff.mjs"

export const isFix = (title) => /^(fix|hotfix)\b/i.test(title)

export function frictionWindow(since, until) {
  const iso =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
  for (const [name, value] of Object.entries({ since, until })) {
    if (
      typeof value !== "string" ||
      !iso.test(value) ||
      !Number.isFinite(Date.parse(value))
    )
      throw new Error(`--${name} needs an ISO timestamp with a timezone`)
  }
  if (Date.parse(since) > Date.parse(until))
    throw new Error("--since must be at or before --until")
  return {
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
  }
}

export function inWindow(date, window) {
  const time = Date.parse(date)
  return time >= Date.parse(window.since) && time <= Date.parse(window.until)
}

export function caughtBy(body) {
  const line = String(body ?? "")
    .match(/^\s*(?:[-*]\s*)?(?:\*\*)?Caught by(?:\*\*)?:\s*(.*)$/im)?.[1]
    ?.replaceAll("**", "")
    .trim()
  if (!line) return "unknown"
  if (/^(owner|user)\b/i.test(line)) return "owner"
  if (/^review\b/i.test(line)) return "review"
  if (/^ci\b/i.test(line)) return "ci"
  if (/^(verify[- ]skill|verify\b|verification\b)/i.test(line))
    return "verify-skill"
  if (/^(agent[- ]self|agent|self)\b/i.test(line)) return "agent-self"
  if (/^tests?\b/i.test(line)) return "test"
  return "unknown"
}

export const queuePrNumber = (branch) =>
  Number(String(branch).match(/^gh-readonly-queue\/main\/pr-(\d+)-/)?.[1]) ||
  null

const unique = (items, key) => [
  ...new Map(items.map((item) => [item[key], item])).values(),
]
const percent = (count, total) =>
  total ? Number(((count * 100) / total).toFixed(4)) : null

export function computeFriction({ window, commits, pullRequests, runs }) {
  window = frictionWindow(window.since, window.until)
  commits = unique(commits, "sha")
    .filter((item) => inWindow(item.committerDate, window))
    .sort((a, b) => a.sha.localeCompare(b.sha))
  pullRequests = unique(pullRequests, "number")
    .filter((item) => inWindow(item.mergedAt, window))
    .sort((a, b) => a.number - b.number)
  runs = unique(runs, "id").sort((a, b) => a.id - b.id)
  const fixes = commits.filter((item) => isFix(item.subject))
  const fixPrs = pullRequests.filter((item) => isFix(item.title))
  const shas = new Set(commits.map((item) => item.sha))
  const repairs = fixes.filter((item) =>
    item.origins.some((origin) => shas.has(origin.sha))
  )
  const prRuns = runs.filter(
    (item) => item.event === "pull_request" && inWindow(item.createdAt, window)
  )
  const queueRuns = runs.filter(
    (item) => item.event === "merge_group" && inWindow(item.createdAt, window)
  )
  const failed = (items) =>
    items.filter((item) => item.conclusion === "failure")
  const queueAfterGreen = failed(queueRuns).filter((queue) => {
    const number = queuePrNumber(queue.headBranch)
    return (
      number &&
      runs.some(
        (run) =>
          run.event === "pull_request" &&
          run.conclusion === "success" &&
          run.pullRequestNumbers.includes(number) &&
          Date.parse(run.createdAt) < Date.parse(queue.createdAt)
      )
    )
  })
  const rows = []
  const share = (id, label, count, total, target, limit, inclusive = false) => {
    const value = percent(count, total)
    rows.push({
      id,
      label,
      count,
      total,
      value,
      target,
      met:
        value == null
          ? null
          : inclusive
            ? count * 100 <= limit * total
            : count * 100 < limit * total,
    })
  }
  const missing = (id, label, target, reason) =>
    rows.push({
      id,
      label,
      count: null,
      total: null,
      value: null,
      target,
      met: null,
      reason,
    })
  share(
    "fix_commits",
    "Fix share of commits (%)",
    fixes.length,
    commits.length,
    "under 25%",
    25
  )
  share(
    "fix_prs",
    "Fix or hotfix share of merged PRs (%)",
    fixPrs.length,
    pullRequests.length,
    "under 25%",
    25
  )
  share(
    "same_week_repairs",
    "Fixes repairing in-window code (%)",
    repairs.length,
    fixes.length,
    "under 50%",
    50
  )
  missing(
    "repair_count_decrease",
    "In-window repair count decreased",
    "smaller than the preceding baseline",
    "A comparison window is not supplied; same_week_repairs reports the current count."
  )
  const oversized = pullRequests.filter(
    (pr) => countedSourceFiles(pr.files).length > 25
  )
  rows.push({
    id: "oversized_prs",
    label: "PRs over 25 authored source files",
    count: oversized.length,
    total: pullRequests.length,
    value: oversized.length,
    target: "0",
    met: oversized.length === 0,
  })
  share(
    "pr_ci_failures",
    "Pull-request CI failures (%)",
    failed(prRuns).length,
    prRuns.length,
    "under 5%",
    5
  )
  share(
    "queue_ci_failures",
    "Merge-queue CI failures (%)",
    failed(queueRuns).length,
    queueRuns.length,
    "under 2%",
    2
  )
  share(
    "queue_failures_after_green",
    "Queue failures after green PR (per 100 queue runs)",
    queueAfterGreen.length,
    queueRuns.length,
    "2 or fewer per 100",
    2,
    true
  )
  const catchers = [
    "owner",
    "review",
    "ci",
    "verify-skill",
    "agent-self",
    "test",
    "unknown",
  ]
  for (const catcher of catchers) {
    const count = fixPrs.filter((pr) => caughtBy(pr.body) === catcher).length
    share(
      `caught_${catcher.replaceAll("-", "_")}`,
      `Fixes caught by ${catcher} (%)`,
      count,
      fixPrs.length,
      catcher === "owner"
        ? "10% or less"
        : catcher === "unknown"
          ? "0"
          : "reported",
      catcher === "owner" ? 10 : catcher === "unknown" ? 0 : 100,
      true
    )
    if (!["owner", "unknown"].includes(catcher)) rows.at(-1).met = null
  }
  for (const [id, label, target, reason] of [
    [
      "large_change_repairs",
      "Repairs attributed to large versus small PRs",
      "reported",
      "Line blame indicates touched origins, not causal attribution to a PR; the hand count requires review.",
    ],
    [
      "design_parity_fixes",
      "Design-parity fixes",
      "5 or fewer per week",
      "Requires a reviewed root-cause classification; titles and Caught by lines do not establish design parity.",
    ],
    [
      "pending_frames",
      "Pending design frames",
      "only falls",
      "Requires historical design-frame inventories and a comparison baseline.",
    ],
    [
      "owner_nudges",
      "Owner nudges per session",
      "1 or fewer per session",
      "Session transcripts are not repository or GitHub inputs.",
    ],
    [
      "comments",
      "Comment baseline",
      "0",
      "The current comment scanner does not measure the historical window.",
    ],
    [
      "guard_proofs",
      "Guards with historic proof",
      "every in-window guard",
      "Requires historical guard-ledger validation, beyond commits, PRs and workflow runs.",
    ],
    [
      "formal_mutants",
      "Formal checks with a mutant that bites",
      "9",
      "Requires formal model execution evidence, not a workflow conclusion alone.",
    ],
  ])
    missing(id, label, target, reason)
  return {
    window,
    notes: [
      "Inclusive bounds: committerDate on origin/main, mergedAt for PRs, createdAt for ci.yml runs.",
      "Fix titles match /^(fix|hotfix)\\b/i. Repairs use any blamed replaced/deleted parent line, not a causal claim.",
      "Authored-file counting uses the delivery size rule, including generated attributes at the merge commit.",
      "CI denominators include cancelled runs; only conclusion=failure counts as failure. Reruns use GitHub's currently stored conclusion.",
      "Queue refs supply the PR number; a green PR run may precede the window and must have been created before the queue run.",
      "Caught by uses the leading category in the PR body's Caught by line; missing or unrecognized categories remain unknown.",
    ],
    rows,
    evidence: {
      fixCommits: fixes.map((item) => item.sha),
      sameWeekRepairs: repairs.map((item) => item.sha),
      oversizedPrs: oversized.map((pr) => ({
        number: pr.number,
        countedSourceFiles: countedSourceFiles(pr.files).length,
      })),
      queueFailuresAfterGreen: queueAfterGreen.map((item) => item.id),
      unknownCaughtBy: fixPrs
        .filter((pr) => caughtBy(pr.body) === "unknown")
        .map((pr) => pr.number),
    },
  }
}

export function renderFriction(report) {
  return [
    `Friction: ${report.window.since} through ${report.window.until} (inclusive)`,
    ...report.notes,
    "",
    "Metric | Count | Total | Value | Target | Met",
    ...report.rows.map((row) =>
      row.reason
        ? `${row.label} | not measured: ${row.reason} | — | — | ${row.target} | —`
        : `${row.label} | ${row.count} | ${row.total} | ${row.value ?? "not measured (empty denominator)"} | ${row.target} | ${row.met == null ? "—" : row.met ? "yes" : "no"}`
    ),
  ].join("\n")
}
