const CODE_SPAN = /`([^`\n]+)`/g
const REPO_ROOTS =
  /^(apps|packages|scripts|docs|\.agents|\.github|\.githooks)\//
const PATTERN_MARK = /[<>*{}$\[\]|]/

export function namedRepoPaths(doc) {
  const named = new Set()
  for (const [, span] of doc.matchAll(CODE_SPAN)) {
    for (const token of span.split(/\s+/)) {
      if (!REPO_ROOTS.test(token) || PATTERN_MARK.test(token)) continue
      named.add(token.replace(/[:#].*$/, "").replace(/[/.,;)]+$/, ""))
    }
  }
  return [...named]
}

export function filesAndFolders(files) {
  const known = new Set()
  for (const file of files) {
    const parts = file.split("/")
    for (let end = 1; end <= parts.length; end++)
      known.add(parts.slice(0, end).join("/"))
  }
  return known
}

export function missingRepoPaths(doc, known) {
  return namedRepoPaths(doc).filter((named) => !known.has(named))
}
