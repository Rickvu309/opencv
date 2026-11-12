import { join, resolve } from "node:path"
import { validateAuthoring } from "../authoring.mjs"
import { diskProblem } from "../disk.mjs"
import { decide, refusalError } from "../rules/index.mjs"
import { planPull } from "./pull-facts.mjs"
import { hasReceipt } from "./affected-tests.mjs"
import { throwPushFailure } from "../push-failure.mjs"
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

function affectedReceipt(ctx, t) {
  const head = git(ctx, "rev-parse", "HEAD")
  return { head, receipt: hasReceipt(ctx, t.gitDir, head) }
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
    if (flags["--dry-run"]) {
      const checked = decide("body", { body: written, pull: { title } })
      if (!checked.ok) throw refusalError(checked.refusals[0])
      return {
        lines: [
          "DRY RUN: the body passes. Nothing was pushed or opened, and the other finish rules did not run.",
          `Title: ${title}`,
          `Closes #${t.n}\n\n${written.text}`,
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
    const body = `Closes #${t.n}\n\n${written.text}`
    const facts = {
      ...planPull(ctx, {
        n: t.n,
        title,
        body,
        issue: { state: issue.state, labels: issue.labels.map((l) => l.name) },
      }),
      here: { ok: true },
      body: written,
      disk: problem ?? {},
      work: { path: t.top, dirty: current.dirty, force: false, finish: true },
      main,
      port,
      env: ctx.env,
      affected: affectedReceipt(ctx, t),
    }
    const verdict = decide("finish", facts)
    if (!verdict.ok) throw refusalError(verdict.refusals[0])
    const bodyFile = ctx.writeScratch(`finish/${t.n}-body.md`, body)
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
    return {
      lines: [`Opened ${url}`],
      next: `scripts/ocv-tools.mjs merge ${url.split("/").at(-1)}`,
    }
  })
}
