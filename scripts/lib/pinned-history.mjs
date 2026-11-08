const commitPattern = /\b[0-9a-f]{7,40}\b/g

export function pinnedCommits(source) {
  return [...new Set(source.match(commitPattern) ?? [])]
}

export function commitsMissingFromMain(source, isCommit, isRetained) {
  return pinnedCommits(source).filter(
    (candidate) => isCommit(candidate) && !isRetained(candidate)
  )
}
