import { holderLine } from "./claim-marker.mjs"
import { riskOf } from "./facts.mjs"
import { RISK_LABELS, TYPES } from "./fields.mjs"
import { EXIT, exitText } from "./result.mjs"
import { decide, refusalError, RULES } from "./rules/index.mjs"

export { riskOf }

export const COMMANDS = [
  {
    name: "friction",
    usage: "friction --since <iso> [--until <iso>] [--json]",
    when: "Measure weekly friction from origin/main committer dates, merged PRs and ci.yml runs in an inclusive window. Fetches origin/main and reads GitHub; never changes product state. With --until the report uses no wall clock; without it the end is now. JSON has metric rows, targets, evidence and explicit reasons for metrics that cannot be measured from these sources. Requires git and authenticated gh; use smaller windows if a GitHub search reaches 1000 results.",
  },
  {
    name: "finish",
    usage: "finish --body-file <file> [-d <description>] [--draft] [--dry-run]",
    when: "Run the pull request rules early, push through the hooks and open the PR (--draft opens a draft). Every problem in the body is named in one message. Unless the PR is a draft or blocked by the migration allow-label or production-red rules, it turns on auto-merge, so the PR merges by itself when ci is green; if GitHub refuses auto-merge, it says so in one line and the coordinator merges with merge <pr#>. --dry-run checks only the body, not the title, pushes nothing and opens nothing, so it works with unsaved changes.",
  },
  {
    name: "check",
    usage: "check [--all] [--list [--base <rev>] [--head <rev>]]",
    when: "Run the tests this branch's change reaches: changed tests, tests that scan a changed folder (the covers-every-X tests), tests that name a changed command, and tests that import a changed file directly or through other files. Over 40 in a package it runs only the changed tests, the scanners and the 25 nearest, records a partial pass that says how many ran, and leaves the rest to CI; a broad change (config, setup, package file) records a broad pass naming the suite CI runs. Only --all runs a whole suite. Tests run one local check at a time per machine (a lock under ~/.local/state/ocv-tools). A pass is recorded for the head commit; pre-push runs the same set and finish refuses a head with no recorded pass. --list prints the selection and why, and runs nothing.",
  },
  {
    name: "body",
    usage: "body <pr> --body-file <file>",
    when: "Replace a pull request body and keep its Closes #<issue> line. The issue comes from the branch name, type/<issue>-words, the same way the policy rule reads it. The same body rules as finish run first, including Caught by and Introduced by on a fix. Use this instead of gh pr edit --body-file.",
  },
  {
    name: "merge",
    usage: "merge <pr#> [--wait] [--allow-migration <tag,...>]",
    when: "Require ci success on the head and enqueue a squash merge; --allow-migration adds the allow-migration:<tag> label. On a PR already on auto-merge it queues nothing: --wait only waits. With --wait it stays until the PR merges (or leaves the queue, or 45 minutes pass), then closes linked issues and removes the worktree and branch. If the PR is already queued or already merged, --wait skips the merged-tree check and reports what the queue did. Run it in the background after queuing. Run again later to confirm closure. Before it queues it says the merge deploys to production and names each migration, and it refuses a migration that does more than add unless --allow-migration names it. After the merge it prints the command that shows the live commit and schema version.",
  },
  {
    name: "why",
    usage: "why <pr#>",
    when: "Print the first failing cases of the newest ci run on the PR head, each with a repro command, in at most 30 lines. On a run still in progress it prints the failures so far and says the run is not finished; on a green run it says green.",
  },
  {
    name: "retire",
    usage: 'retire "<subject>" --because "<why>" [--replaced-by <test file>]',
    when: 'The one way to remove or weaken a protected check on purpose; the subject is what PROTECTED_WEAKENED printed, its file, or a case title prefix. With --replaced-by, retire runs that test under the machine lock with the changed source files put back to the fork point (it must fail on an assertion) and on the head (it must pass), and records the proof in scripts/retired/<issue>.json. Such a retirement is self-serve: the pull request still merges itself when the replacement covers the same module, command or route, and finish and the body say "Retired N checks with replacements". Without a replacement, or for a ratchet or known-failures entry, a limit bound, a guard or ledger row, a checker setting or a skip mark, the retirement is recorded without self-serve replacement proof and the pull request still merges on green ci. An expected-failure mark is PIN_ISSUE_OPEN\'s rule, not this one.',
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
    when: 'Write a new issue from answers and label it risk:*. The only place plain words are checked. Optional: --type, --could-go-wrong (required when risk is high), --questions, --out-of-scope, --details. --dry-run shows the writing guide and model issues and creates nothing. --body-file <f> replaces the field flags. Refused if a required part is missing or the plain sections use backticks, file names, more than 6 "Done when" lines or vague "Done when" lines. Every missing flag is named in one message with a command to copy. Jargon, sentences over 20 words and a reading grade above 8 print a warning and the issue is still filed. A title may use CI, PR and API.',
  },
  {
    name: "status",
    usage: "status <n>",
    when: "See where one issue stands: state, risk, branch, worktree, pull request, and the next step.",
  },
  {
    name: "take",
    usage:
      "take <n | title> [-d <words>] [--type <t>] [--resume] [--no-install] [--no-assign] [--take]",
    when: "Take an issue: makes its worktree itself (branch, port, .env, hooks, install), assigns the issue, records your claim on the issue, prints the path, branch and port. Given a title it files the issue first (same flags as `file`, including --body-file). -d sets the branch words, --type sets the type, --resume checks out a branch an idle holder already pushed (fast-forwards a local branch that is behind origin, refuses one that diverged), --take overrides another assignee. Refused when the issue is closed, ready-for-human, assigned to someone else, held by a live claim (saved in the last 180 minutes), or already has a worktree.",
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
    name: "board",
    usage: "board [--json]",
    when: "List every open issue with its risk, claim holder, idle minutes, pull request and checks. Groups: open and free, taken (live), idle (past 180 minutes) and in review (pull request open). Checks are the latest ci run on the open pull request. --json prints those groups.",
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
    when: "Print the rules from AGENTS.md, the model for the role, the worktree, port, tool budget and fenced paths. Paste it into an agent's brief instead of retyping the rules.",
  },
  {
    name: "done",
    usage: "done",
    when: "List this agent's open pull requests, held issues and worktrees. Exit 1 if any is unblocked, 4 if all remaining work is blocked, and 0 only if none remains. This checks agent ownership, not completion of the full user request. Run it before saying you are finished.",
  },
  {
    name: "block",
    usage: 'block <n> "<reason>"',
    when: "Record on issue <n> why you cannot continue. Blocked work stays listed and incomplete; it never makes done succeed. Continue independent authorized work. A new take of the issue clears the blocker.",
  },
  {
    name: "doctor",
    usage: "doctor",
    when: "Check this machine is set up: node, gh sign-in, the hooks path and the risk labels. One Fix line per problem.",
  },
  {
    name: "rules",
    usage: "rules [--list]",
    when: "Show each current workflow rule. The retired --check and --write flags fail with replacement commands; generated workflow guides are no longer maintained.",
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

export function nextStep({ n, worktree, branch, pr }) {
  if (pr?.state === "MERGED") return `scripts/ocv-tools.mjs cleanup ${n}`
  if (pr?.state === "OPEN")
    return pr.isDraft
      ? `gh pr ready ${pr.number}, then scripts/ocv-tools.mjs merge ${pr.number} once ci is green`
      : `scripts/ocv-tools.mjs merge ${pr.number} once ci is green`
  if (worktree)
    return `Work in ${worktree}, then scripts/ocv-tools.mjs finish --body-file <file>`
  if (branch)
    return `git worktree add ../opencv.worktrees/${n}-work ${branch} (from the main checkout)`
  return `scripts/ocv-tools.mjs take ${n}`
}

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
  const { risk } = issue
  const lines = [
    `#${n} ${issue.title}`,
    `State: ${issue.state.toLowerCase()}`,
    `Risk: ${risk ?? "none (no risk label)"}`,
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
    next: nextStep({ n, worktree, branch, pr }),
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
