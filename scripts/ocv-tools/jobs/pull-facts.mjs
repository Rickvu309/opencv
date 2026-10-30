// Facts the pr-moment rules read. pullFacts(pr) is the one reader of GitHub
// PR and issue JSON; planPull builds the same shape locally at finish from
// the branch, the body text and the local commits. Rows read these domain
// facts only.
import { run, git, gh, json, diffFacts } from "./common.mjs"

export const PR_FIELDS =
  "number,url,state,title,body,author,isDraft,labels,headRefOid,headRefName,mergeCommit,closingIssuesReferences"

const generated = (out) =>
  out
    .split("\n")
    .filter((line) => /: linguist-generated: (set|true)$/.test(line))
    .map((line) => line.replace(/: linguist-generated: .*$/, ""))

// Generated files are read from the base tree's attributes, so a PR cannot exempt itself.
function authored(ctx, base, paths) {
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

const split = (out) => out.split("\0").filter(Boolean)

// Every name the PR touches, renames split into old and new: gh pr diff alone hides the old name.
export function changedFiles(ctx, listed, base, head) {
  const raw = git(ctx, "diff", "--no-renames", "--name-only", "-z", base, head)
  return [...new Set([...listed, ...split(raw)])]
}

export function deletedFacts(ctx, base, head) {
  const gone = authored(
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
  return { files: gone.length, lines, total: authored(ctx, base, all).length }
}

// The commit facts FILE_SIZE and NO_AI_ATTRIBUTION read: attribution trailers
// in the branch messages and authored files over the 20000-byte limit.
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
    if (size <= 20000) continue
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

// The pull fact of a pull request as GitHub reports it: state, author, labels,
// head and branch. The merge rows read these without the diff.
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
    mergeOid: pull.mergeCommit?.oid,
    closing: (pull.closingIssuesReferences ?? []).map((i) => i.number),
    ...extra,
  }
}

// The domain facts of a live pull request: its metadata and linked issue, the
// diff against origin/main, and the branch commits.
export function pullFacts(ctx, n) {
  const pull = json(ctx, "pr", "view", String(n), "--json", PR_FIELDS)
  const head = pull.headRefOid
  if (!run(ctx, "git", ["cat-file", "-e", `${head}^{commit}`]).ok)
    git(ctx, "fetch", "--quiet", "origin", `pull/${n}/head`)
  const base = git(ctx, "merge-base", "origin/main", head)
  const files = changedFiles(
    ctx,
    gh(ctx, "pr", "diff", String(n), "--name-only").split("\n"),
    base,
    head
  )
  const issue = Number(
    /^(?:feat|fix|hotfix|refactor|chore|docs)\/(\d+)-/.exec(
      pull.headRefName
    )?.[1]
  )
  const linked = issue
    ? json(ctx, "issue", "view", String(issue), "--json", "state,labels")
    : null
  const labels = (linked?.labels ?? []).map((l) => l.name)
  const facts = diffFacts(ctx, files, head, labels)
  facts.diff.deleted = deletedFacts(ctx, base, head)
  return {
    pull: pullOf(pull, { issue: issue || null, issueState: linked?.state }),
    issue: { n: issue, labels },
    diff: facts.diff,
    commits: commitFacts(ctx, base, head),
  }
}

// The same shape, built locally at finish from the branch, the body text and
// the local commits, so the pr rows can run before the PR exists. commits.count
// is how many commits the branch has beyond origin/main.
export function planPull(ctx, { n, title, body, issue }) {
  const files = git(ctx, "diff", "--name-only", "origin/main...HEAD").split(
    "\n"
  )
  const facts = diffFacts(ctx, files, "HEAD", issue.labels ?? [])
  facts.diff.deleted = deletedFacts(
    ctx,
    git(ctx, "merge-base", "origin/main", "HEAD"),
    "HEAD"
  )
  return {
    pull: { issue: n, title, body, issueState: issue.state },
    issue: { n, state: issue.state, labels: issue.labels ?? [] },
    diff: facts.diff,
    commits: {
      ...commitFacts(ctx, "origin/main", "HEAD"),
      count: Number(git(ctx, "rev-list", "--count", "origin/main..HEAD")),
    },
  }
}
