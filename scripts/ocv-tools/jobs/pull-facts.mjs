import { issueOfBranch } from "../rules/pull-ref.mjs"
import { run, git, json, diffFacts } from "./common.mjs"
import { pinFacts } from "./pin-facts.mjs"
import { migrationFacts } from "./migration-facts.mjs"
import { LABELS, allowedMigrationTags } from "../rules/merge-gate.mjs"
import { recordedProtectedFacts } from "./protected-facts.mjs"

export const PR_FIELDS =
  "number,url,state,title,body,author,isDraft,labels,headRefOid,headRefName,baseRefName,mergeCommit,closingIssuesReferences,autoMergeRequest"

export function redIssues(ctx) {
  const found = new Map()
  for (const label of [LABELS.productionRed, LABELS.mainRed])
    for (const issue of json(
      ctx,
      "issue",
      "list",
      "--label",
      label,
      "--state",
      "open",
      "--json",
      "number,state,labels",
      "--limit",
      "20"
    ))
      found.set(issue.number, {
        number: issue.number,
        state: issue.state,
        labels: (issue.labels ?? []).map((item) => item.name),
      })
  return [...found.values()]
}

const generated = (out) =>
  out
    .split("\n")
    .filter((line) => /: linguist-generated: (set|true)$/.test(line))
    .map((line) => line.replace(/: linguist-generated: .*$/, ""))

function authoredPerBaseAttributes(ctx, base, paths) {
  const skip = new Set()
  for (let i = 0; i < paths.length; i += 400) {
    const r = run(ctx, "git", [
      "check-attr",
      `--source=${base}`,
      "linguist-generated",
      "--",
      ...paths.slice(i, i + 400),
    ])
    if (r.ok) for (const p of generated(r.out)) skip.add(p)
  }
  return paths.filter((p) => !skip.has(p))
}

const FILE_SIZE_LIMIT_BYTES = 20000

const split = (out) => out.split("\0").filter(Boolean)

export function commitReachability(ctx, head) {
  const seen = new Map()
  return (hash) => {
    if (!seen.has(hash))
      seen.set(
        hash,
        [head, "origin/main"].some(
          (ref) =>
            run(ctx, "git", ["merge-base", "--is-ancestor", hash, ref]).ok
        )
      )
    return seen.get(hash)
  }
}

export function changedFiles(ctx, listed, base, head) {
  const bothSidesOfEachRename = git(
    ctx,
    "diff",
    "--no-renames",
    "--name-only",
    "-z",
    base,
    head
  )
  return [...new Set([...listed, ...split(bothSidesOfEachRename)])]
}

export function deletedFacts(ctx, base, head) {
  const gone = authoredPerBaseAttributes(
    ctx,
    base,
    split(
      git(
        ctx,
        "diff",
        "--no-renames",
        "--name-only",
        "-z",
        "--diff-filter=D",
        base,
        head
      )
    )
  )
  let lines = 0
  const rows = git(
    ctx,
    "diff",
    "--no-renames",
    "--numstat",
    "-z",
    "--diff-filter=D",
    base,
    head
  )
  for (const row of split(rows)) {
    const [, del, path] = row.split("\t")
    if (gone.includes(path) && /^\d+$/.test(del)) lines += Number(del)
  }
  const all = split(git(ctx, "ls-tree", "-r", "--name-only", "-z", base))
  return {
    files: gone.length,
    lines,
    total: authoredPerBaseAttributes(ctx, base, all).length,
  }
}

export function changeFacts(ctx, base, head) {
  const tokens = git(ctx, "diff", "-M", "--numstat", "-z", base, head).split(
    "\0"
  )
  const changes = []
  for (let i = 0; i < tokens.length; i++) {
    const [added, deleted, path] = tokens[i].split("\t")
    if (deleted === undefined) continue
    const renamed = path === ""
    if (renamed) i += 2
    changes.push({
      path: renamed ? tokens[i] : path,
      added: /^\d+$/.test(added) ? Number(added) : 0,
      deleted: /^\d+$/.test(deleted) ? Number(deleted) : 0,
    })
  }
  const generatedPaths = new Set(changes.map((c) => c.path).filter(Boolean))
  const kept = new Set(
    authoredPerBaseAttributes(ctx, base, [...generatedPaths])
  )
  return changes.map((c) => ({ ...c, generated: !kept.has(c.path) }))
}

export function commitFacts(ctx, base, head) {
  const messages = git(ctx, "log", "--format=%B", `${base}..${head}`)
  let oversize = ""
  const touched = git(
    ctx,
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    "-z",
    `${base}...${head}`
  )
  for (const file of split(touched)) {
    const meta = git(ctx, "ls-tree", head, "--", file)
    if (meta.startsWith("160000")) continue
    const size = Number(git(ctx, "cat-file", "-s", `${head}:${file}`))
    if (size <= FILE_SIZE_LIMIT_BYTES) continue
    const blob = git(ctx, "cat-file", "blob", `${head}:${file}`)
    if (blob.slice(0, 8000).includes("\0")) continue
    const attr = git(
      ctx,
      "check-attr",
      `--source=${head}`,
      "linguist-generated",
      "--",
      file
    )
    if (!/: (set|true)$/.test(attr)) oversize += `${file} (${size} bytes) `
  }
  return {
    trailers: /^\s*(co-authored-by|generated-with):/im.test(messages)
      ? "on branch"
      : "",
    oversize,
  }
}

export function pullOf(pull, extra = {}) {
  return {
    n: pull.number,
    title: pull.title,
    body: pull.body,
    state: pull.state,
    isDraft: pull.isDraft,
    author: pull.author?.login,
    labels: (pull.labels ?? []).map((l) => l.name),
    head: pull.headRefOid,
    branch: pull.headRefName,
    base: pull.baseRefName,
    mergeOid: pull.mergeCommit?.oid,
    closing: (pull.closingIssuesReferences ?? []).map((i) => i.number),
    auto: Boolean(pull.autoMergeRequest),
    ...extra,
  }
}

export function pullFacts(ctx, n) {
  const pull = json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
  const head = pull.headRefOid
  if (!run(ctx, "git", ["cat-file", "-e", `${head}^{commit}`]).ok)
    git(ctx, "fetch", "--quiet", "origin", `pull/${n}/head`)
  const base = git(ctx, "merge-base", "origin/main", head)
  const files = changedFiles(ctx, [], base, head)
  const issue = issueOfBranch(pull.headRefName)
  const linked = issue
    ? json(ctx, "issue", "view", String(issue), "--json", "state,labels")
    : null
  const labels = (linked?.labels ?? []).map((l) => l.name)
  const facts = diffFacts(ctx, files, head, labels)
  facts.diff.deleted = deletedFacts(ctx, base, head)
  facts.diff.changes = changeFacts(ctx, base, head)
  const shaped = pullOf(pull, {
    issue: issue || null,
    issueState: linked?.state,
  })
  return {
    pull: shaped,
    issue: { n: issue, labels },
    diff: facts.diff,
    commits: commitFacts(ctx, base, head),
    pins: pinFacts(ctx, head),
    migrations: migrationFacts(
      ctx,
      files,
      head,
      allowedMigrationTags(shaped.labels)
    ),
    issues: redIssues(ctx),
    protected: recordedProtectedFacts(ctx, "origin/main", head),
  }
}
