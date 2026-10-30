// Merge-time rules of issue #618: a mass deletion and the pull request details.
// The shell checks are rule_mass_delete and rule_pr_metadata in scripts/lib/rules.sh;
// merge-pr.sh calls them. The limits below are the owner's defaults and match that file.
export const MASS_DELETE_LIMITS = Object.freeze({
  files: 25,
  lines: 2000,
  percent: 10,
})

const TITLE =
  /^(feat|fix|hotfix|refactor|chore|docs)(\([a-z0-9-]+\))?!?: [^ ].* \(#(\d+)\)$/

function massDelete(facts) {
  const d = facts.diff?.deleted
  if (!d) return null
  const { files, lines, percent } = MASS_DELETE_LIMITS
  const over = []
  if (d.files > files) over.push(`${d.files} files (limit ${files})`)
  if (d.lines > lines) over.push(`${d.lines} lines (limit ${lines})`)
  if (d.total > 0 && d.files * 100 > percent * d.total)
    over.push(`${d.files} of ${d.total} authored files (limit ${percent}%)`)
  if (!over.length) return null
  return `the change deletes a lot of authored source: ${over.join(", ")}; a human must review it first`
}

function prMetadata(facts) {
  const p = facts.pull
  if (!p || p.issue == null) return null
  const problems = []
  const title = TITLE.exec(p.title ?? "")
  if (!title || Number(title[3]) !== Number(p.issue))
    problems.push(`the title is not "type: description (#${p.issue})"`)
  const closes = new RegExp(`(^|\\s)Closes #${p.issue}(\\D|$)`)
  if (!closes.test(p.body ?? ""))
    problems.push(`the body has no "Closes #${p.issue}" line`)
  if (p.issueState && p.issueState !== "OPEN")
    problems.push(`issue #${p.issue} is ${String(p.issueState).toLowerCase()}`)
  if (!problems.length) return null
  return `the pull request details are wrong: ${problems.join("; ")}`
}

export const mergeSpecs = [
  {
    id: "MASS_DELETE",
    section: "5",
    says: "More than 25 authored files, 2000 lines or 10% of authored files deleted needs a human.",
    jobs: ["merge"],
    needs: ["diff"],
    check: massDelete,
    fix: () => "gh pr edit <pr> --add-label needs-human-review",
    impl: "bash:rule_mass_delete",
  },
  {
    id: "PR_METADATA",
    section: "4",
    says: "The title is type: description (#n), the body says Closes #n, and issue n is open.",
    jobs: ["merge"],
    needs: ["pull"],
    check: prMetadata,
    fix: () =>
      "gh pr edit <pr> --title 'type: text (#<n>)' --body 'Closes #<n>'",
    impl: "bash:rule_pr_metadata",
  },
]
