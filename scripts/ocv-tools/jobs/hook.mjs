// ocv-tools hook <commit-msg|pre-commit|pre-push>: what the git hooks in
// .githooks run. Each hook gathers its facts and fires the commit or push rows
// of the rule table with decide(); a refusal blocks the git command. Keep
// imports to node: builtins and scripts/ocv-tools/.
import { join, resolve } from "node:path"
import { EXIT } from "../result.mjs"
import { badInput } from "../input.mjs"
import { decide } from "../rules/index.mjs"
import { run } from "./common.mjs"

const LIMIT_BYTES = 20000
const BATCH = 200

const split = (out) => out.split("\0").filter(Boolean)

function batches(list) {
  const out = []
  for (let i = 0; i < list.length; i += BATCH)
    out.push(list.slice(i, i + BATCH))
  return out
}

function report(verdict, lines = []) {
  if (verdict.ok) return { lines }
  return {
    exit: EXIT.refused,
    lines: [
      ...lines,
      ...verdict.refusals.flatMap((refusal) => [
        `REFUSED ${refusal.id}: ${refusal.message}`,
        `Fix: ${refusal.fix}`,
      ]),
    ],
  }
}

function branchOf(ctx) {
  const r = run(ctx, "git", ["symbolic-ref", "--quiet", "--short", "HEAD"])
  return r.ok ? r.out : ""
}

function commitMsg(ctx, file) {
  if (!file) throw new Error("usage: ocv-tools hook commit-msg <message file>")
  const lines = ctx
    .readFile(resolve(ctx.cwd, file))
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("#"))
  const first = lines.find((line) => line.trim() !== "") ?? ""
  const trailer = lines.some((line) =>
    /^(co-authored-by|generated-with):/i.test(line.trim())
  )
  const verdict = decide("commit", {
    commit: { branch: branchOf(ctx), first },
    commits: { trailers: trailer ? "this message" : "", oversize: "" },
  })
  const warnings =
    first.length > 72
      ? [
          `commit-msg: warning: first line is ${first.length} characters; keep it under 72.`,
        ]
      : []
  return report(verdict, warnings)
}

// `git commit <path>` hands the hook a throwaway index; a rewrite there would
// leave the real index stale, so the hook only checks.
function temporaryIndex(ctx) {
  const file = ctx.env.GIT_INDEX_FILE
  if (!file) return false
  const gitDir = run(ctx, "git", ["rev-parse", "--absolute-git-dir"]).out
  const index = resolve(ctx.cwd, file)
  return index !== join(gitDir, "index") && index !== join(gitDir, "index.lock")
}

// Format a fully staged file and stage the result. A partly staged file that
// prettier would change is refused: the hook never touches unstaged hunks.
function formatStaged(ctx, prettier) {
  const only = temporaryIndex(ctx)
  const unstaged = new Set(
    split(
      run(ctx, "git", ["diff", "--name-only", "--no-renames", "-z"], {
        raw: true,
      }).out
    )
  )
  const staged = split(
    run(
      ctx,
      "git",
      [
        "diff",
        "--cached",
        "--name-only",
        "--no-renames",
        "--diff-filter=ACMR",
        "-z",
      ],
      { raw: true }
    ).out
  )
  const full = staged.filter((path) => !only && !unstaged.has(path))
  const partial = staged.filter((path) => only || unstaged.has(path))
  const lines = []

  for (const paths of batches(full)) {
    const r = run(ctx, prettier, [
      "--write",
      "--ignore-unknown",
      "--log-level",
      "warn",
      "--",
      ...paths,
    ])
    // A parse error is for lint to report; a commit is not blocked by it.
    if (!r.ok)
      lines.push(
        "pre-commit: prettier could not format every staged file; committing them as they are."
      )
    if (r.err) lines.push(r.err)
    run(ctx, "git", ["add", "--", ...paths])
  }

  // Judge the staged blob, not the working tree: only the staged content is committed.
  const unformatted = []
  for (const path of partial) {
    const blob = run(ctx, "git", ["show", `:${path}`], { raw: true })
    if (!blob.ok) continue
    const formatted = run(ctx, prettier, ["--stdin-filepath", path], {
      input: blob.out,
      raw: true,
    })
    if (formatted.ok && formatted.out !== blob.out)
      unformatted.push(`  ${path}: pnpm exec prettier --write '${path}'`)
  }
  if (!unformatted.length) return { lines }
  return {
    refused: true,
    lines: [
      ...lines,
      only
        ? "pre-commit: file(s) named in 'git commit <path>' that prettier would change; the hook cannot rewrite them in this mode."
        : "pre-commit: staged file(s) that prettier would change, with unstaged edits too, so the hook leaves them alone.",
      only
        ? "Format each one, then run the same git commit again:"
        : "Format each one, then 'git add -p <file>' to stage only the hunks you mean to commit, then commit again:",
      ...unformatted,
    ],
  }
}

// Staged blobs over the limit: not a submodule, not binary (a NUL in the
// first 8000 bytes), not marked linguist-generated. Size is the staged blob.
function oversizeStaged(ctx) {
  const raw = split(
    run(
      ctx,
      "git",
      [
        "diff",
        "--cached",
        "--no-renames",
        "--raw",
        "--no-abbrev",
        "-z",
        "--diff-filter=ACMR",
      ],
      { raw: true }
    ).out
  )
  const over = []
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const [, mode, , sha] = raw[i].slice(1).split(/\s+/)
    const path = raw[i + 1]
    if (mode === "160000") continue
    const bytes = Number(run(ctx, "git", ["cat-file", "-s", sha]).out)
    if (bytes > LIMIT_BYTES) over.push({ path, sha, bytes })
  }
  if (!over.length) return ""

  // --cached reads the staged .gitattributes, so adding a pattern and the file in one commit works.
  const attrs = run(
    ctx,
    "git",
    ["check-attr", "--cached", "-z", "--stdin", "linguist-generated"],
    { input: over.map((item) => `${item.path}\0`).join(""), raw: true }
  )
  const generated = new Set()
  if (attrs.ok) {
    const parts = split(attrs.out)
    for (let i = 0; i + 2 < parts.length; i += 3)
      if (parts[i + 2] === "set" || parts[i + 2] === "true")
        generated.add(parts[i])
  }
  let list = ""
  for (const item of over) {
    if (generated.has(item.path)) continue
    const blob = run(ctx, "git", ["cat-file", "blob", item.sha], { raw: true })
    if (blob.out.slice(0, 8000).includes("\0")) continue
    list += `${item.path} (${item.bytes} bytes) `
  }
  return list
}

function preCommit(ctx) {
  const top = run(ctx, "git", ["rev-parse", "--show-toplevel"]).out || ctx.cwd
  const prettier = join(top, "node_modules/.bin/prettier")
  let lines = []
  if (ctx.ports.fs.exists(prettier)) {
    const formatted = formatStaged(ctx, prettier)
    if (formatted.refused) return { exit: EXIT.refused, lines: formatted.lines }
    lines = formatted.lines
  } else
    lines = [
      "pre-commit: node_modules/.bin/prettier is missing (run pnpm install); skipping the format step.",
    ]
  const verdict = decide("commit", {
    commit: { branch: branchOf(ctx), first: null },
    commits: { trailers: "", oversize: oversizeStaged(ctx) },
  })
  return report(verdict, lines)
}

// Each stdin line: <local ref> <local sha> <remote ref> <remote sha>.
function pushedRefs(text) {
  const refs = []
  for (const line of text.split("\n")) {
    const [, localSha, remoteRef] = line.trim().split(/\s+/)
    if (!remoteRef?.startsWith("refs/heads/")) continue
    refs.push({
      branch: remoteRef.slice("refs/heads/".length),
      deleting: /^0+$/.test(localSha),
    })
  }
  return refs
}

function prePush(ctx) {
  const refs = pushedRefs(ctx.readStdin())
  const pushing = refs.some((ref) => !ref.deleting)
  const verdict = decide("push", {
    push: { refs },
    env: pushing ? ctx.env : {},
  })
  if (!verdict.ok) return report(verdict)
  if (!pushing) return { lines: [] }
  if (ctx.env.SKIP_CHECKS === "1")
    return {
      lines: [
        "pre-push: WARNING: SKIP_CHECKS=1, the quick check is skipped. Emergencies only; say so in the PR.",
      ],
    }
  const top = run(ctx, "git", ["rev-parse", "--show-toplevel"]).out || ctx.cwd
  const checked = run(ctx, "pnpm", ["check"], {
    cwd: top,
    env: { CHECK_DRY_RUN: "" },
    inherit: true,
  })
  if (checked.ok) return { lines: [] }
  return {
    exit: EXIT.refused,
    lines: [
      "pre-push: pnpm check did not pass.",
      ...(checked.err ? [checked.err] : []),
    ],
    fix: "Fix what pnpm check reported, save, and push again. Install pnpm with corepack enable if it is missing.",
  }
}

export function hook(ctx, name, args = []) {
  switch (name) {
    case "commit-msg":
      return commitMsg(ctx, args[0])
    case "pre-commit":
      return preCommit(ctx)
    case "pre-push":
      return prePush(ctx)
    default:
      return badInput({
        command: {
          known: false,
          noun: "hook",
          name,
          names: "commit-msg, pre-commit, pre-push",
        },
      })
  }
}
