const EXPECTED_FAILURE = /\b(?:it|test|describe)\.fails\b/
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/
const ISSUE_NUMBER = /#(\d+)\b/g
const TITLE_WINDOW_LINES = 4

export const TEST_SOURCE =
  /\.(?:test|spec)\.[cm]?[jt]sx?$|\/test\/.*\.[cm]?[jt]sx?$/

function citedIssues(lines, index) {
  const title = lines.slice(index, index + TITLE_WINDOW_LINES).join("\n")
  return [
    ...new Set([...title.matchAll(ISSUE_NUMBER)].map((m) => Number(m[1]))),
  ]
}

export function detect(text, path, openIssues = new Set()) {
  const lines = text.split("\n")
  const hits = []
  lines.forEach((line, index) => {
    if (COMMENT_LINE.test(line) || !EXPECTED_FAILURE.test(line)) return
    const issues = citedIssues(lines, index)
    const at = `${path}:${index + 1}`
    if (!issues.length) {
      hits.push({
        at,
        issue: null,
        message: `${at}: an expected failure names no issue in its title. Write the open issue number into the title literally, like "#758: ..."`,
      })
      return
    }
    for (const issue of issues)
      if (!openIssues.has(issue))
        hits.push({
          at,
          issue,
          message: `${at}: an expected failure cites #${issue}, which is not open. Fix the bug and turn it back into a passing test, or reopen #${issue}`,
        })
  })
  return hits
}
