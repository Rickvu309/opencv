// help, status and doctor: where things stand, with one next step or one fix per problem.
import { holderLine } from "./claim-marker.mjs"
import { approvalValid, riskOf } from "./facts.mjs"
import { RISK_LABELS, TYPES } from "./fields.mjs"
import { EXIT, exitText } from "./result.mjs"
import { decide, refusalError, RULES } from "./rules/index.mjs"

export { approvalValid, riskOf }

// The one list of commands. The dispatcher and `help` read it, so a command cannot exist
// without a line saying when to use it.
export const COMMANDS = [
  {
    name: "finish",
    usage: "finish --body-file <file> [-d <description>] [--draft] [--dry-run]",
    when: "Run the pull request rules early, push through the hooks and open the PR (--draft opens a draft).",
  },
  {
    name: "merge",
    usage: "merge <pr#> [--wait]",
    when: "Require ci success on the head and enqueue a squash merge. With --wait it stays until the PR merges (or leaves the queue, or 45 minutes pass), then closes linked issues and removes the worktree and branch. Run it in the background after queuing. Run again later to confirm closure.",
  },
  {
    name: "policy",
    usage: "policy <pr#>",
    when: "Evaluate the server-held PR rules against a live pull request and print one line per refusal, each with its fix. Exit 2 when a rule refuses.",
  },
  {
    name: "hook",
    usage: "hook <commit-msg <file> | pre-commit | pre-push>",
    when: "What the git hooks in .githooks run: the commit and push rows of the rule table. Not for hand use.",
  },
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
    when: "See where one issue stands: state, risk, admin approval (needed only for risk:high), branch, worktree, pull request, and the next step.",
  },
  {
    name: "take",
    usage:
      "take <n | title> [-d <words>] [--type <t>] [--resume] [--no-install] [--no-assign] [--take]",
    when: "Take an issue: makes its worktree itself (branch, port, .env, hooks, install), assigns the issue, records your claim on the issue, prints the path, branch and port. Given a title it files the issue first (same flags as `file`, including --body-file). -d sets the branch words, --type sets the type, --resume checks out a branch an idle holder already pushed (fast-forwards a local branch that is behind origin, refuses one that diverged), --take overrides another assignee. Refused when the issue is closed, ready-for-human, assigned to someone else, held by a live claim (saved in the last 180 minutes), risk:high without an admin /approve, or already has a worktree.",
  },
  {
    name: "save",
    usage: "save -m <message>",
    when: "From inside the task worktree: commit everything, refresh the claim, push through the pre-push checks and refresh again. Save at least every 180 minutes or someone else can take the issue. Exit 3 LOST if someone did: uncommitted work goes to a patch under ~/tmp/ocv-tools/lost. A push that already reached origin is reported as lost and the old claim comment is left alone.",
  },
  {
    name: "release",
    usage: "release --reason <why> [<n>]",
    when: "Give the issue back so others can take it. Only the holder can.",
  },
  {
    name: "cleanup",
    usage: "cleanup [<n>] [--all] [--dry-run] [--force]",
    when: "After the merge: remove the worktree and branch and list what was removed. Refused while there is unsaved work or the pull request is not merged. Without <n> it uses the current worktree; --all handles every finished worktree, --dry-run only lists, --force also removes unsaved work.",
  },
  {
    name: "approve",
    usage: "approve <n>",
    when: 'Post /approve on a risk:high issue only after an admin said "approved" in this chat. The comment says this agent relayed it. Refused for any other risk (NOT_HIGH_RISK: no approval is needed), a closed issue (CLOSED), a number that is not an issue (NOT_AN_ISSUE), or when the signed-in account does not have admin rights (NOT_OWNER). A second valid approve does nothing and exits 0.',
  },
  {
    name: "board",
    usage: "board [--json]",
    when: "List every open issue with its risk, claim holder, idle minutes, pull request and checks. Groups: waiting for approval (risk:high without a valid /approve), open and free, taken (live), idle (past 180 minutes) and in review (pull request open). Checks are the latest ci run on the open pull request. --json prints those groups.",
  },
  {
    name: "shot",
    usage:
      "shot <file...> [--pr <n> | --issue <n>] [--name <what>] [--no-comment]",
    when: "Upload png, jpg, gif and webp pictures (checked by their bytes) to the screenshots release and post them. The release is created as a prerelease when it is missing. Pictures are never committed, and staging copies are removed after the upload. Defaults to this task's issue. --pr or --issue picks the target, --name names the files, --no-comment only uploads. At most 20 pictures, each at most 10 MB. A long comment is split under 60000 characters. Refused: MISSING_FILE, BAD_PICTURE, TOO_BIG, TOO_MANY.",
  },
  {
    name: "brief",
    usage: "brief <issue> --role <build|mechanical|review|plan>",
    when: "Print the rules block from docs/agents/brief-rules.md, the model for the role, the worktree, port, tool budget and fenced paths. Paste it into an agent's brief instead of retyping the rules.",
  },
  {
    name: "done",
    usage: "done",
    when: "List this agent's open pull requests, held issues and worktrees. Exit 1 while any has no recorded blocker. Run it before saying you are finished. A Stop hook can call it.",
  },
  {
    name: "block",
    usage: 'block <n> "<reason>"',
    when: "Record on issue <n> why you cannot continue, so done stops listing it. A new take of the issue clears the blocker.",
  },
  {
    name: "doctor",
    usage: "doctor",
    when: "Check this machine is set up: node, gh sign-in, the hooks path and the risk labels. One Fix line per problem.",
  },
  {
    name: "rules",
    usage: "rules [--write|--check|--list]",
    when: "Show the workflow rules. --check fails when the guide is stale, --write refreshes it, --list prints each rule.",
  },
]

export function renderHelp() {
  const rows = COMMANDS.map((c) => `  ${c.usage}\n      ${c.when}`).join("\n")
  return [
    "ocv-tools: file, check and track opencv tasks.",
    "",
    "Usage: scripts/ocv-tools.mjs <command> [flags]",
    "",
    rows,
    "",
    exitText(),
    "",
  ].join("\n")
}

// Pure: picks the one next step from what status found.
export function nextStep({ n, type, risk, approved, worktree, branch, pr }) {
  if (pr?.state === "MERGED") return `scripts/ocv-tools.mjs cleanup ${n}`
  if (pr?.state === "OPEN")
    return pr.isDraft
      ? `gh pr ready ${pr.number}, then scripts/ocv-tools.mjs merge ${pr.number} once ci is green`
      : `scripts/ocv-tools.mjs merge ${pr.number} once ci is green`
  if (risk === "high" && !approved)
    return "Ask a project admin to comment /approve on the issue (high risk needs it after the last edit)."
  if (worktree)
    return `Work in ${worktree}, then scripts/ocv-tools.mjs finish --body-file <file>`
  if (branch)
    return `git worktree add ../opencv.worktrees/${n}-work ${branch} (from the main checkout)`
  return `scripts/ocv-tools.mjs take ${n}`
}

// The local worktree of an issue's task branch, if any (`type/<n>-...`).
// Remote-only branches stay in the facts loader so this list is parsed once.
export function worktreeFor(ctx, n) {
  const prefix = new RegExp(`^(?:${TYPES.join("|")})/${n}-`)
  const hit = ctx.ports.git
    .worktrees(ctx.cwd)
    .find((w) => prefix.test(w.branch))
  return {
    worktree: hit?.path ?? null,
    branch: hit?.branch ?? null,
    prefix,
  }
}

export function status(ctx, n) {
  const loaded = ctx.facts.load(Number(n), ["issue", "claim", "local", "pr"])
  const { issue, claim } = loaded
  const { worktree, branch } = loaded.local
  const pr = loaded.pr.current
  const { risk, type, approved } = issue
  const approval =
    risk === "high"
      ? approved
        ? "admin approved after the last edit"
        : "NOT approved (a project admin must comment /approve after the last edit)"
      : "not needed"
  const lines = [
    `#${n} ${issue.title}`,
    `State: ${issue.state.toLowerCase()}`,
    `Risk: ${risk ?? "none (no risk label)"}`,
    `Approval: ${approval}`,
    `Branch: ${branch ?? "none"}${worktree ? ` (worktree ${worktree})` : ""}`,
    holderLine(claim),
    `Pull request: ${pr ? `#${pr.number} ${pr.state.toLowerCase()}${pr.isDraft ? " (draft)" : ""}` : "none"}`,
  ]
  const verdict = decide("status", {
    issue,
    pr: loaded.pr,
    report: lines.join("\n"),
  })
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
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
  check("gh signed in", ctx.ports.gh.authed(), "Run: gh auth login")
  const hooks = ctx.ports.git.config(ctx.cwd, "core.hooksPath")
  check(
    "git hooks path is .githooks",
    hooks === ".githooks",
    "Run: git config core.hooksPath .githooks"
  )
  const names = ctx.ports.gh.labels()
  const have = new Set(names.names)
  for (const label of RISK_LABELS)
    check(
      `label ${label} exists`,
      have.has(label),
      names.ok
        ? `Run: node scripts/pr.mjs doctor, then run the gh label create line it prints for ${label}`
        : "Fix gh sign-in first, then run: node scripts/pr.mjs doctor"
    )
  const listed = [
    "",
    "Rules:",
    ...RULES.map((row) => `  ${row.id}: ${row.says}`),
  ]
  if (problems.length)
    return {
      exit: EXIT.error,
      lines: [
        ...lines,
        "",
        `${problems.length} problem(s).`,
        ...problems.map((p) => `Fix: ${p}`),
        ...listed,
      ],
    }
  return {
    lines: [...lines, "", "All checks pass.", ...listed],
    next: "scripts/ocv-tools.mjs help",
  }
}
