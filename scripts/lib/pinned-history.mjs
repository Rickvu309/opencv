const commitPattern = /\b[0-9a-f]{7,40}\b/g

export function pinnedCommits(source) {
  if (!/["']show["']/.test(source)) return []
  return [...new Set(source.match(commitPattern) ?? [])]
}

export function commitsMissingFromMain(source, isCommit, isOnMain) {
  return pinnedCommits(source).filter(
    (candidate) => isCommit(candidate) && !isOnMain(candidate)
  )
}
