import { join, resolve } from "node:path"
import { validateAuthoring } from "../authoring.mjs"
import { diskProblem } from "../disk.mjs"
import { decide, refusalError } from "../rules/index.mjs"
import { recordedProtectedFacts } from "./protected-facts.mjs"
import { throwPushFailure } from "../push-failure.mjs"
import { Refused } from "../result.mjs"
import { closesIssue } from "../rules/pull-ref.mjs"
import { migrationFacts } from "./migration-facts.mjs"
import { changedFiles, commitReachability } from "./pull-facts.mjs"
import { retiredLines } from "../rules/protected.mjs"
import { autoMergeWhenGreen } from "./merge.mjs"
import {
  recorded,
  task,
  stateHeldDuringPush,
  run,
  git,
  gh,
  json,
} from "./common.mjs"

export function bodyOf(ctx, flag) {
  if (!flag || flag === true) return { file: null, text: "" }
  const file = resolve(ctx.cwd, flag)
  try {
    return { file, text: ctx.readFile(file) }
  } catch {
    return { file, text: "", unreadable: true }
  }
}

export function withClosingLine(text, n) {
  if (closesIssue(text, n)) return text
  return `Closes #${n}\n\n${text}`
}

function branchDiffFacts(ctx) {
  const base = git(ctx, "merge-base", "origin/main", "HEAD")
  const files = changedFiles(ctx, [], base, "HEAD")
  return { diff: { files }, migrations: migrationFacts(ctx, files, "HEAD") }
}

function autoMerge(ctx, n) {
  const head = git(ctx, "rev-parse", "HEAD")
  let asked
  try {
    asked = autoMergeWhenGreen(ctx, n, head, { allowMigrations: [] })
  } catch (error) {
    if (!(error instanceof Refused)) throw error
    return {
      status: "pending",
      lines: [`Auto-merge is off: ${error.code} ${error.message}`],
      next: error.fix ?? `scripts/ocv-tools.mjs policy ${n}`,
    }
  }
  if (asked.auto)
    return {
      lines: [
        `Auto-merge is on: GitHub merges ${head} when ci is green. Hand back now; do not wait for ci.`,
      ],
      next: `If ci turns red: scripts/ocv-tools.mjs why ${n}`,
    }
  return {
    lines: [
      `Auto-merge was refused (${asked.reason}), so this PR merges the old way: the coordinator runs merge ${n}.`,
    ],
    next: `scripts/ocv-tools.mjs merge ${n}`,
  }
}

export function finish(ctx, { flags }) {
  return recorded(ctx, "open-pr", () => {
    const t = task(ctx)
    const existing = json(
      ctx,
      "pr",
      "list",
      "--head",
      t.branch,
      "--state",
      "open",
      "--json",
      "number,url,title,body"
    )
    const issue = json(
      ctx,
      "issue",
      "view",
      String(t.n),
      "--json",
      "title,state,labels"
    )
    validateAuthoring({ n: t.n, issue, pull: existing[0] })
    if (existing.length)
      return {
        id: existing[0].number,
        lines: [`A PR is already open: ${existing[0].url}`],
        next: `scripts/ocv-tools.mjs merge ${existing[0].number}`,
      }
    const written = bodyOf(ctx, flags["--body-file"])
    const desc = String(
      flags["-d"] ||
        flags["--desc"] ||
        issue.title.replace(/^[a-zA-Z]+(?:\([^)]*\))?!?:\s*/, "") ||
        t.slug.replaceAll("-", " ")
    )
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\.$/, "")
    const title = `${t.type}: ${desc.charAt(0).toLowerCase()}${desc.slice(1)} (#${t.n})`
    const body = withClosingLine(written.text, t.n)
    const bodyFileFacts = {
      ...written,
      text: body,
      isCommitReachable: commitReachability(ctx, "HEAD"),
    }
    if (flags["--dry-run"]) {
      const checked = decide("body", {
        body: bodyFileFacts,
        pull: { title, issue: t.n, body },
        ...branchDiffFacts(ctx),
      })
      if (!checked.ok) throw refusalError(checked.refusals[0])
      return {
        lines: [
          "DRY RUN: the body passes. Nothing was pushed or opened, and the other finish rules did not run.",
          `Title: ${title}`,
          body,
        ],
        next: "scripts/ocv-tools.mjs finish --body-file <file>",
      }
    }
    const problem = diskProblem(ctx.ports.fs, ctx.env, t)
    const main = {
      path: t.main,
      branch: git(ctx, "-C", t.main, "branch", "--show-current"),
      dirty: git(
        ctx,
        "-C",
        t.main,
        "status",
        "--porcelain",
        "--untracked-files=no"
      ),
    }
    const assigned = join(t.gitDir, "assigned-port"),
      env = join(t.top, ".env")
    let port = null
    if (ctx.ports.fs.exists(assigned) && ctx.ports.fs.exists(env)) {
      const values = [
        ...ctx.readFile(env).matchAll(/^\s*(?:export\s+)?PORT=(.*)$/gm),
      ]
      const value = values
        .at(-1)?.[1]
        .replace(/\s+#.*$/, "")
        .trim()
        .replace(/^["'](.*)["']$/, "$1")
      port = {
        assigned: ctx.readFile(assigned).trim(),
        env: value,
        worktree: t.top,
      }
    }
    git(ctx, "fetch", "--quiet", "origin", "main")
    const current = stateHeldDuringPush(ctx, t)
    const facts = {
      pull: { issue: t.n, title, body, issueState: issue.state },
      issue: {
        n: t.n,
        state: issue.state,
        labels: issue.labels.map((l) => l.name),
      },
      commits: {
        count: Number(git(ctx, "rev-list", "--count", "origin/main..HEAD")),
      },
      here: { ok: true },
      body: bodyFileFacts,
      ...branchDiffFacts(ctx),
      disk: problem ?? {},
      work: { path: t.top, dirty: current.dirty, force: false, finish: true },
      main,
      port,
    }
    const verdict = decide("finish", facts)
    if (!verdict.ok) throw refusalError(verdict.refusals[0])
    const retiredNote = retiredLines(
      recordedProtectedFacts(ctx, "origin/main", "HEAD")
    )
    const bodyFile = ctx.writeScratch(
      `finish/${t.n}-body.md`,
      retiredNote.length
        ? `${body.trimEnd()}\n\n<details><summary>Retired checks</summary>\n\n${retiredNote.join("\n\n")}\n\n</details>\n`
        : body
    )
    const upload = run(ctx, "git", ["push", "-u", "origin", t.branch])
    if (!upload.ok) throwPushFailure(ctx, upload)
    const pushed = decide("finish-pushed", {
      snapshot: { before: current, after: stateHeldDuringPush(ctx, t) },
    })
    if (!pushed.ok) throw refusalError(pushed.refusals[0])
    const url = gh(
      ctx,
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      t.branch,
      "--title",
      title,
      "--body-file",
      bodyFile,
      ...(flags["--draft"] ? ["--draft"] : [])
    )
    const n = Number(url.split("/").at(-1))
    const opened = [...retiredNote, `Opened ${url}`]
    if (flags["--draft"])
      return {
        lines: [...opened, "A draft is not put on auto-merge."],
        next: `gh pr ready ${n}, then scripts/ocv-tools.mjs merge ${n}`,
      }
    const auto = autoMerge(ctx, n)
    return { ...auto, lines: [...opened, ...auto.lines] }
  })
}
