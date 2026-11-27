import { riskOf } from "./facts.mjs"
import { TYPES } from "./fields.mjs"
import { exitText } from "./result.mjs"

export { riskOf }

export const COMMANDS = [
  {
    name: "finish",
    usage: "finish --body-file <file> [-d <description>] [--draft] [--dry-run]",
    when: "Run the pull request rules early, push through the hooks and open the PR (--draft opens a draft). The body opens with **Now:** and **Proof:**, or a bold answer followed by a <details> block. Show a command and its result, an image, or a CI run. Use at most 25 non-empty lines outside details, including fenced code. A migration needs a **Risk:** line. Every problem in the body is named in one message. Unless the PR is a draft or blocked by the migration allow-label or production-red rules, it turns on auto-merge, so the PR merges by itself when ci is green; if GitHub refuses auto-merge, it says so in one line and the coordinator merges with merge <pr#>. --dry-run checks only the body, not the title, pushes nothing and opens nothing, so it works with unsaved changes.",
  },
  {
    name: "body",
    usage: "body <pr> --body-file <file>",
    when: "Replace a pull request body and keep its Closes #<issue> line. The issue comes from the branch name, type/<issue>-words, the same way the policy rule reads it. The same body rules as finish run first, including Caught by and Introduced by on a fix. Use this instead of gh pr edit --body-file.",
  },
  {
    name: "merge",
    usage: "merge <pr#> [--allow-migration <tag,...>]",
    when: "Require ci success on the head and squash merge the PR, then close linked issues and remove the worktree and branch; --allow-migration adds the allow-migration:<tag> label. There is no merge queue: a PR on auto-merge merges by itself when ci is green, and on such a PR merge only says so until ci finishes. Run it again after an auto-merge to close the issue and clean up. Before it merges it says the merge deploys to production and names each migration, and it refuses a migration that does more than add unless --allow-migration names it. After the merge it prints the command that shows the live commit and schema version.",
  },
  {
    name: "why",
    usage: "why <pr#>",
    when: "Print the first failing cases of the newest ci run on the PR head, each with a repro command, in at most 30 lines. On a run still in progress it prints the failures so far and says the run is not finished; on a green run it says green.",
  },
  {
    name: "retire",
    usage: 'retire "<subject>" --because "<why>" [--replaced-by <test file>]',
    when: 'The one way to remove or weaken a protected check on purpose; the subject is what PROTECTED_WEAKENED printed, its file, or a case title prefix. With --replaced-by, retire runs that test with the changed source files put back to the fork point (it must fail on an assertion) and on the head (it must pass), and records the proof in scripts/retired/<issue>.json. Such a retirement is self-serve: the pull request still merges itself when the replacement covers the same module, command or route, and finish and the body say "Retired N checks with replacements". Without a replacement, or for a ratchet or known-failures entry, a limit bound, a guard or ledger row, a checker setting or a skip mark, the retirement is recorded without self-serve replacement proof and the pull request still merges on green ci. An expected-failure mark is PIN_ISSUE_OPEN\'s rule, not this one.',
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
    name: "take",
    usage:
      "take <n | title> [-d <words>] [--type <t>] [--resume] [--no-install] [--no-assign] [--take]",
    when: "Take an issue: makes its worktree itself (branch, port, .env, hooks, install), assigns the issue, writes one owner note on the issue, prints the path, branch and port. Given a title it files the issue first (same flags as `file`, including --body-file). -d sets the branch words, --type sets the type, --resume checks out a branch that was already pushed (fast-forwards a local branch that is behind origin, refuses one that diverged), --take overrides another assignee. Refused when the issue is closed, ready-for-human, assigned to someone else, or already has a worktree.",
  },
  {
    name: "save",
    usage: "save -m <message>",
    when: "From inside the task worktree: commit everything and push through the pre-push checks.",
  },
  {
    name: "cleanup",
    usage: "cleanup [<n>] [--all] [--dry-run] [--force]",
    when: "After the merge: remove the worktree and branch and list what was removed. Refused while there is unsaved work or the pull request is not merged. Without <n> it uses the current worktree; --all handles every finished worktree, --dry-run only lists, --force also removes unsaved work.",
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
