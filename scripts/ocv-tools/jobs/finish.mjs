import { join, resolve } from "node:path"
import { diskProblem } from "../disk.mjs"
import {
  recorded,
  task,
  snapshot,
  proofPath,
  git,
  gh,
  json,
  gate,
  refuse,
  diffFacts,
} from "./common.mjs"

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

function hooked(ctx) {
  const messages = git(ctx, "log", "--format=%B", "origin/main..HEAD")
  let oversize = ""
  for (const file of git(
    ctx,
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    "-z",
    "origin/main...HEAD"
  )
    .split("\0")
    .filter(Boolean)) {
    const meta = git(ctx, "ls-tree", "HEAD", "--", file)
    if (meta.startsWith("160000")) continue
    const size = Number(git(ctx, "cat-file", "-s", `HEAD:${file}`))
    if (size <= 20000) continue
    const blob = git(ctx, "cat-file", "blob", `HEAD:${file}`)
    if (blob.slice(0, 8000).includes("\0")) continue
    const attr = git(
      ctx,
      "check-attr",
      "--source=HEAD",
      "linguist-generated",
      "--",
      file
    )
    if (!/: (set|true)$/.test(attr)) oversize += `${file} (${size} bytes) `
  }
  gate("COMMITS_HOOKED", {
    commits: {
      trailers: /^\s*(co-authored-by|generated-with):/im.test(messages)
        ? "on branch"
        : "",
      oversize,
    },
  })
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
    gate("READY_FOR_HUMAN", {
      issue: { n: t.n, labels: issue.labels.map((l) => l.name) },
    })
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
        next: "scripts/ocv-tools.mjs check",
      }
    const disk = diskProblem(ctx.ports.fs, ctx.env, t)
    if (disk) refuse("DISK", disk.text)
    gate("MAIN_CLEAN", {
      main: {
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
      },
    })
    const assigned = join(t.gitDir, "assigned-port"),
      env = join(t.top, ".env")
    if (ctx.ports.fs.exists(assigned) && ctx.ports.fs.exists(env)) {
      const values = [
        ...ctx.readFile(env).matchAll(/^\s*(?:export\s+)?PORT=(.*)$/gm),
      ]
      const value = values
        .at(-1)?.[1]
        .replace(/\s+#.*$/, "")
        .trim()
        .replace(/^["'](.*)["']$/, "$1")
      gate("PORT", {
        port: {
          assigned: ctx.readFile(assigned).trim(),
          env: value,
          worktree: t.top,
        },
      })
    }
    gate("SKIP_DECLARED", { env: ctx.env })
    git(ctx, "fetch", "--quiet", "origin", "main")
    const current = snapshot(ctx, t)
    if (!Number(git(ctx, "rev-list", "--count", "origin/main..HEAD")))
      refuse("NO_COMMITS", "No commits beyond origin/main.")
    const files = git(ctx, "diff", "--name-only", "origin/main...HEAD").split(
      "\n"
    )
    const facts = diffFacts(ctx, files, "HEAD")
    gate("NO_WORKFLOWS", facts)
    gate("CI_WORKFLOW_KEPT", facts)
    hooked(ctx)
    let proof
    try {
      proof = JSON.parse(ctx.readFile(proofPath(t)))
    } catch {
      /* Missing proof is refused below. */
    }
    if (
      !proof ||
      proof.schema !== 1 ||
      proof.status !== "ok" ||
      ["tree", "base", "branch"].some((key) => proof[key] !== current[key])
    )
      refuse(
        "CHECK_REQUIRED",
        "A passing check for this saved tree and origin/main is required.",
        "Run: scripts/ocv-tools.mjs check"
      )
    let body = `Closes #${t.n}\n\n${written}\n\nQuick check passed for tree \`${proof.tree}\` against \`${proof.base}\` at ${proof.checkedAt}.`
    if (proof.retried?.length)
      body += `\n\nPassed only on retry: ${proof.retried.join(", ")}.`
    const bodyFile = ctx.writeScratch(`finish/${t.n}-body.md`, body)
    git(ctx, "push", "-u", "origin", t.branch)
    if (JSON.stringify(snapshot(ctx, t)) !== JSON.stringify(current))
      refuse(
        "STALE_CHECK",
        "The saved work changed during push. Check and finish again."
      )
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
