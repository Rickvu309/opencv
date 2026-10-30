// Facts the merge job feeds the MASS_DELETE and PR_METADATA rules (the same checks merge-pr.sh runs).
import { run, git } from "./common.mjs"

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
