import { join, resolve } from "node:path"
import { diskProblem } from "../disk.mjs"
import { decide, refusalError } from "../rules/index.mjs"
import { planPull } from "./pull-facts.mjs"
import { recorded, task, snapshot, git, gh, json, refuse } from "./common.mjs"

function bodyText(text) {
  for (const heading of ["Summary", "Evidence", "Merge Danger"])
    if (!new RegExp(`^## ${heading}\r?$`, "m").test(text))
      refuse("BAD_BODY", `The PR body needs ## ${heading}.`)
  if (
    !/^\*\*Door:\*\* (one-way|two-way)/m.test(text) ||
    !/^\*\*Blast Radius:\*\* [^<\s]/m.test(text) ||
    /<(diagram|screenshot|one-way|optional)[^>]*>/.test(text)
  )
    refuse(
      "BAD_BODY",
      "Fill in Door, Blast Radius and all template placeholders."
    )
  return text
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
      "number,url"
    )
    if (existing.length)
      return {
        id: existing[0].number,
        lines: [`A PR is already open: ${existing[0].url}`],
        next: `scripts/ocv-tools.mjs merge ${existing[0].number}`,
      }
    const issue = json(
      ctx,
      "issue",
      "view",
      String(t.n),
      "--json",
      "title,state,labels"
    )
    if (issue.state !== "OPEN")
      refuse("CLOSED", `Issue #${t.n} is ${issue.state}.`)
    if (!flags["--body-file"] || flags["--body-file"] === true)
      refuse("BAD_BODY", "Pass --body-file <file>.")
    const written = bodyText(
      ctx.readFile(resolve(ctx.cwd, flags["--body-file"]))
    )
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
    if (!/^(feat|fix|hotfix|refactor|chore|docs): [^ ].* \(#\d+\)$/.test(title))
      refuse("BAD_TITLE", "The PR title is invalid.")
    if (flags["--dry-run"])
      return {
        lines: [`Title: ${title}`, `Closes #${t.n}\n\n${written}`],
        next: "scripts/ocv-tools.mjs finish --body-file <file>",
      }
    const disk = diskProblem(ctx.ports.fs, ctx.env, t)
    if (disk) refuse("DISK", disk.text)
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
    const current = snapshot(ctx, t)
    if (!Number(git(ctx, "rev-list", "--count", "origin/main..HEAD")))
      refuse("NO_COMMITS", "No commits beyond origin/main.")
    // One fact set, one decision: the rows at finish, which include the pr
    // rows, run here early on the branch, the body text and the local commits.
    const body = `Closes #${t.n}\n\n${written}`
    const facts = {
      ...planPull(ctx, {
        n: t.n,
        title,
        body,
        issue: { state: issue.state, labels: issue.labels.map((l) => l.name) },
      }),
      main,
      port,
      env: ctx.env,
    }
    const verdict = decide("finish", facts)
    if (!verdict.ok) throw refusalError(verdict.refusals[0])
    const bodyFile = ctx.writeScratch(`finish/${t.n}-body.md`, body)
    git(ctx, "push", "-u", "origin", t.branch)
    if (JSON.stringify(snapshot(ctx, t)) !== JSON.stringify(current))
      refuse("STALE_CHECK", "The saved work changed during push. Finish again.")
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
    return {
      lines: [`Opened ${url}`],
      next: `scripts/ocv-tools.mjs merge ${url.split("/").at(-1)}`,
    }
  })
}
