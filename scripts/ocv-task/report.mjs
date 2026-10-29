// help, status and doctor: where things stand, with one next step or one fix per problem.
import { EXIT, Refused, gh } from "./core.mjs"
import { RISK_LABELS, RISKS, TYPES } from "./fields.mjs"
import { parseRisk } from "./lint.mjs"

// The one list of commands. The dispatcher and `help` read it, so a command cannot exist
// without a line saying when to use it.
export const COMMANDS = [
  {
    name: "help",
    usage: "help",
    when: "See every job and when to use it.",
  },
  {
    name: "file",
    usage: "file --title <t> --what <t> --done <t> --risk <low|normal|high>",
    when: 'Write a new issue from answers and label it risk:*. The only place plain words are checked. Optional: --type, --could-go-wrong (required when risk is high), --questions, --out-of-scope, --details. --dry-run shows the writing guide and model issues and creates nothing. --body-file <f> replaces the field flags. Refused if the plain sections use jargon, backticks, file names, sentences over 20 words, more than 6 "Done when" lines, vague "Done when" lines, or read above grade 8.',
  },
  {
    name: "status",
    usage: "status <n>",
    when: "See where one issue stands: state, risk, owner approval (needed only for risk:high), branch, worktree, pull request, and the next step.",
  },
  {
    name: "doctor",
    usage: "doctor",
    when: "Check this machine is set up: node, gh sign-in, the hooks path and the risk labels. One Fix line per problem.",
  },
]

export function renderHelp() {
  const rows = COMMANDS.map((c) => `  ${c.usage}\n      ${c.when}`).join("\n")
  return [
    "ocv-task: file, check and track opencv tasks.",
    "",
    "Usage: scripts/ocv-task.mjs <command> [flags]",
    "",
    rows,
    "",
    "Exit codes: 0 ok, 1 error, 2 refused with a named code (UNKNOWN_COMMAND, UNREADABLE,",
    "NOT_AN_ISSUE, NEEDS_APPROVAL, CLOSED, MISSING_FIELDS), 3 LOST (reserved: another agent",
    "took the claim; later slices use it).",
    "Every result ends with a Next: or Fix: line.",
    "",
    "Later slices add take, save, release, cleanup, check, finish, shot and board.",
  ].join("\n")
}

const loginOf = (author) =>
  String(
    typeof author === "string" ? author : (author?.login ?? "")
  ).toLowerCase()

// The newest owner comment starting with /approve must follow the last body edit
// (or the creation, if the body was never edited).
export function approvalValid({ comments, owner, lastEditedAt, createdAt }) {
  const since = Date.parse(lastEditedAt || createdAt)
  if (Number.isNaN(since)) return false
  let newest = null
  for (const c of comments ?? []) {
    if (loginOf(c.author) !== String(owner ?? "").toLowerCase()) continue
    if (!/^\/approve\b/.test(String(c.body ?? "").trimStart())) continue
    const at = Date.parse(c.createdAt)
    if (Number.isNaN(at)) continue
    if (newest === null || at > newest) newest = at
  }
  return newest !== null && newest > since
}

// Approval must never fail open: a conflicting label set counts as high, and a
// missing label falls back to the Risk answer in the issue body.
export function riskOf(labels, body = "") {
  const found = RISKS.filter((r) => labels.includes(`risk:${r}`))
  if (found.length > 1) return "high"
  if (found.length === 1) return found[0]
  return parseRisk(body)
}

// Pure: picks the one next step from what status found.
export function nextStep({ n, type, risk, approved, worktree, branch, pr }) {
  if (pr?.state === "MERGED") return `scripts/cleanup-worktree.sh ${n}`
  if (pr?.state === "OPEN")
    return pr.isDraft
      ? `heavy -- scripts/review-pr.sh ${pr.number}, then gh pr ready ${pr.number}`
      : `heavy -- scripts/review-pr.sh ${pr.number}`
  if (risk === "high" && !approved)
    return "Ask the owner to comment /approve on the issue (high risk needs it after the last edit)."
  if (worktree)
    return `Work in ${worktree}, then heavy -- scripts/open-pr.sh --draft`
  if (branch)
    return `git worktree add ../opencv.worktrees/${n}-work ${branch} (from the main checkout)`
  return `scripts/new-task.sh ${type ?? "<type>"} ${n} -d "short description"`
}

const QUERY = `query($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){owner{login} issue(number:$n){number title state body createdAt lastEditedAt labels(first:50){nodes{name}} comments(last:100){nodes{author{login} body createdAt}}}}}`

export function status(ctx, n) {
  const repo = JSON.parse(gh(ctx, "repo", "view", "--json", "owner,name"))
  const q = ctx.run("gh", [
    "api",
    "graphql",
    "-f",
    `query=${QUERY}`,
    "-f",
    `owner=${repo.owner.login}`,
    "-f",
    `name=${repo.name}`,
    "-F",
    `n=${n}`,
  ])
  let issue = null
  let owner = repo.owner.login
  if (q.ok) {
    const data = JSON.parse(q.out).data.repository
    issue = data.issue
    owner = data.owner.login
  }
  if (!issue) throw new Refused("NOT_AN_ISSUE", `#${n} is not an issue`)

  const labels = issue.labels.nodes.map((l) => l.name)
  const risk = riskOf(labels, issue.body)
  const type = TYPES.find(
    (t) => labels.includes(t) || issue.title.startsWith(`${t}:`)
  )
  const approved = approvalValid({
    comments: issue.comments.nodes,
    owner,
    lastEditedAt: issue.lastEditedAt,
    createdAt: issue.createdAt,
  })

  const prefix = new RegExp(`^(?:${TYPES.join("|")})/${n}-`)
  const prs = JSON.parse(
    gh(
      ctx,
      "pr",
      "list",
      "--state",
      "all",
      "--limit",
      "200",
      "--json",
      "number,state,isDraft,headRefName"
    )
  ).filter((p) => prefix.test(p.headRefName))
  const pr = prs.find((p) => p.state === "OPEN") ?? prs[0] ?? null

  const wt = ctx.run("git", ["worktree", "list", "--porcelain"])
  let worktree = null
  let branch = null
  let path = null
  for (const line of wt.out.split("\n")) {
    if (line.startsWith("worktree ")) path = line.slice(9)
    if (line.startsWith("branch ") && prefix.test(line.slice(18))) {
      branch = line.slice(18)
      worktree = path
    }
  }
  if (!branch) {
    const remote = ctx.run("git", ["ls-remote", "--heads", "origin"])
    for (const line of remote.out.split("\n")) {
      const name = line.split("\t")[1]?.replace("refs/heads/", "")
      if (name && prefix.test(name)) branch = name
    }
  }

  const approval =
    risk === "high"
      ? approved
        ? "owner approved after the last edit"
        : "NOT approved (owner must comment /approve after the last edit)"
      : "not needed"
  const lines = [
    `#${n} ${issue.title}`,
    `State: ${issue.state.toLowerCase()}`,
    `Risk: ${risk ?? "none (no risk label)"}`,
    `Approval: ${approval}`,
    `Branch: ${branch ?? "none"}${worktree ? ` (worktree ${worktree})` : ""}`,
    `Pull request: ${pr ? `#${pr.number} ${pr.state.toLowerCase()}${pr.isDraft ? " (draft)" : ""}` : "none"}`,
  ]
  if (issue.state === "CLOSED" && pr?.state !== "MERGED") {
    const e = new Refused("CLOSED", `#${n} is closed\n${lines.join("\n")}`)
    throw e
  }
  return {
    lines,
    next: nextStep({ n, type, risk, approved, worktree, branch, pr }),
  }
}

export function doctor(ctx) {
  const problems = []
  const lines = []
  const check = (name, ok, fix) => {
    lines.push(`${ok ? "ok  " : "FAIL"} ${name}`)
    if (!ok) problems.push(fix)
  }
  const major = Number(String(ctx.nodeVersion).replace(/^v/, "").split(".")[0])
  check(`node ${ctx.nodeVersion}`, major >= 20, "Install node 20 or newer.")
  check(
    "gh signed in",
    ctx.run("gh", ["auth", "status"]).ok,
    "Run: gh auth login"
  )
  const hooks = ctx.run("git", ["config", "core.hooksPath"]).out
  check(
    "git hooks path is .githooks",
    hooks === ".githooks",
    "Run: git config core.hooksPath .githooks"
  )
  const names = ctx.run("gh", [
    "label",
    "list",
    "--json",
    "name",
    "--limit",
    "200",
  ])
  const have = new Set(
    names.ok ? JSON.parse(names.out || "[]").map((l) => l.name) : []
  )
  for (const label of RISK_LABELS)
    check(
      `label ${label} exists`,
      have.has(label),
      names.ok
        ? `Run: node scripts/pr.mjs doctor, then run the gh label create line it prints for ${label}`
        : "Fix gh sign-in first, then run: node scripts/pr.mjs doctor"
    )
  if (problems.length)
    return {
      exit: EXIT.ERROR,
      lines: [
        ...lines,
        "",
        `${problems.length} problem(s).`,
        ...problems.map((p) => `Fix: ${p}`),
      ],
    }
  return {
    lines: [...lines, "", "All checks pass."],
    next: "scripts/ocv-task.mjs help",
  }
}
