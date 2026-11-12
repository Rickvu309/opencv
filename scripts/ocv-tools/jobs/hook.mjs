import { join, resolve } from "node:path"
import { EXIT } from "../result.mjs"
import { badInput } from "../input.mjs"
import { decide } from "../rules/index.mjs"
import { run } from "./common.mjs"
import { runQuickChecks } from "./push-checks.mjs"
import { testsForPush } from "./affected-tests.mjs"

const LIMIT_BYTES = 20000
const SUBMODULE_MODE = "160000"
const BINARY_SNIFF_BYTES = 8000
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

function readList(ctx, args) {
  const r = run(ctx, "git", args, { raw: true })
  if (!r.ok)
    throw new Error(
      `git ${args.join(" ")} failed (${r.err || "no output"}), so the staged files cannot be checked; fix git and commit again`
    )
  return r.out
}

function temporaryIndex(ctx) {
  const file = ctx.env.GIT_INDEX_FILE
  if (!file) return false
  const gitDir = run(ctx, "git", ["rev-parse", "--absolute-git-dir"]).out
  const index = resolve(ctx.cwd, file)
  return index !== join(gitDir, "index") && index !== join(gitDir, "index.lock")
}

function formatStaged(ctx, prettier) {
  const only = temporaryIndex(ctx)
  const unstaged = new Set(
    split(readList(ctx, ["diff", "--name-only", "--no-renames", "-z"]))
  )
  const staged = split(
    readList(ctx, [
      "diff",
      "--cached",
      "--name-only",
      "--no-renames",
      "--diff-filter=ACMR",
      "-z",
    ])
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
    if (!r.ok)
      lines.push(
        "pre-commit: prettier could not format every staged file; committing them as they are."
      )
    if (r.err) lines.push(r.err)
    run(ctx, "git", ["add", "--", ...paths])
  }

  const unformatted = []
  for (const path of partial) {
    const stagedBlob = run(ctx, "git", ["show", `:${path}`], { raw: true })
    if (!stagedBlob.ok) continue
    const formatted = run(ctx, prettier, ["--stdin-filepath", path], {
      input: stagedBlob.out,
      raw: true,
    })
    if (formatted.ok && formatted.out !== stagedBlob.out)
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

function oversizeStaged(ctx) {
  const raw = split(
    readList(ctx, [
      "diff",
      "--cached",
      "--no-renames",
      "--raw",
      "--no-abbrev",
      "-z",
      "--diff-filter=ACMR",
    ])
  )
  const over = []
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const [, mode, , sha] = raw[i].slice(1).split(/\s+/)
    const path = raw[i + 1]
    if (mode === SUBMODULE_MODE) continue
    const size = run(ctx, "git", ["cat-file", "-s", sha])
    if (!size.ok || !/^\d+$/.test(size.out))
      throw new Error(
        `the staged size of ${path} could not be read (${size.err || size.out || "no output"}); run git cat-file -s ${sha} and commit again`
      )
    const bytes = Number(size.out)
    if (bytes > LIMIT_BYTES) over.push({ path, sha, bytes })
  }
  if (!over.length) return ""

  const stagedAttributes = run(
    ctx,
    "git",
    ["check-attr", "--cached", "-z", "--stdin", "linguist-generated"],
    { input: over.map((item) => `${item.path}\0`).join(""), raw: true }
  )
  const generated = new Set()
  if (stagedAttributes.ok) {
    const parts = split(stagedAttributes.out)
    for (let i = 0; i + 2 < parts.length; i += 3)
      if (parts[i + 2] === "set" || parts[i + 2] === "true")
        generated.add(parts[i])
  }
  let list = ""
  for (const item of over) {
    if (generated.has(item.path)) continue
    const blob = run(ctx, "git", ["cat-file", "blob", item.sha], { raw: true })
    if (blob.out.slice(0, BINARY_SNIFF_BYTES).includes("\0")) continue
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

function pushedRefs(text) {
  const refs = []
  for (const line of text.split("\n")) {
    const [, localSha, remoteRef] = line.trim().split(/\s+/)
    if (!remoteRef?.startsWith("refs/heads/")) continue
    refs.push({
      sha: localSha,
      branch: remoteRef.slice("refs/heads/".length),
      deleting: /^0+$/.test(localSha),
    })
  }
  return refs
}

function prePush(ctx) {
  const refs = pushedRefs(ctx.readStdin())
  const pushing = refs.some((ref) => !ref.deleting)
  const facts = { push: { refs }, env: pushing ? ctx.env : {} }
  const early = decide("push", {
    ...facts,
    quick: { failed: [] },
    affected: { failed: [] },
  })
  if (!early.ok) return report(early)
  if (!pushing) return { lines: [] }
  if (ctx.env.SKIP_CHECKS === "1")
    return {
      lines: [
        "pre-push: WARNING: SKIP_CHECKS=1, the quick checks are skipped. Emergencies only; say so in the PR.",
      ],
    }
  const top = run(ctx, "git", ["rev-parse", "--show-toplevel"]).out || ctx.cwd
  const started = ctx.now()
  const quick = runQuickChecks(ctx, top)
  const affected = quick.failed.length
    ? { failed: [], lines: [] }
    : testsForPush(
        ctx,
        top,
        refs.filter((ref) => !ref.deleting).map((ref) => ref.sha)
      )
  const seconds = Math.round((ctx.now() - started) / 1000)
  const verdict = decide("push", { ...facts, quick, affected })
  return report(verdict, [
    ...quick.lines,
    ...affected.lines,
    ...(verdict.ok
      ? [
          `pre-push: quick checks passed in ${seconds}s, with the tests the change reaches.`,
        ]
      : []),
  ])
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
