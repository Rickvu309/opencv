const EXPECTED_FAILURE = /\b(?:it|test|describe)\.fails\b/
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/
const ISSUE_NUMBER = /#(\d+)\b/g
const TITLE_WINDOW_LINES = 4

export const VITEST_TREES = ["apps", "packages"]

export const TEST_SOURCE =
  /\.(?:test|spec)\.[cm]?[jt]sx?$|\/test\/.*\.[cm]?[jt]sx?$/

const NAMED_ISSUE = /\$\{\s*([A-Za-z_$][\w$]*)\.issue\s*\}/g

function definedIssue(name, definitions) {
  const found = new RegExp(
    `\\b${name.replace(/\$/g, "\\$")}\\s*=\\s*\\{[^}]*?\\bissue:\\s*["'\`]#(\\d+)`
  ).exec(definitions)
  return found ? Number(found[1]) : null
}

function citedIssues(lines, index, definitions) {
  const title = lines.slice(index, index + TITLE_WINDOW_LINES).join("\n")
  const literal = [...title.matchAll(ISSUE_NUMBER)].map((m) => Number(m[1]))
  const named = [...title.matchAll(NAMED_ISSUE)]
    .map((m) => definedIssue(m[1], definitions))
    .filter((issue) => issue !== null)
  return [...new Set([...literal, ...named])]
}

export function citations(text, path, definitions = text) {
  const lines = text.split("\n")
  const found = []
  lines.forEach((line, index) => {
    if (COMMENT_LINE.test(line) || !EXPECTED_FAILURE.test(line)) return
    found.push({
      at: `${path}:${index + 1}`,
      issues: citedIssues(lines, index, definitions),
    })
  })
  return found
}

export function detect(text, path, openIssues = new Set(), definitions = text) {
  const hits = []
  for (const { at, issues } of citations(text, path, definitions)) {
    if (!issues.length) {
      hits.push({
        at,
        issue: null,
        message: `${at}: an expected failure names no issue in its title. Write the open issue number into the title, like "#758: ...", or cite a constant defined with issue: "#758"`,
      })
      continue
    }
    for (const issue of issues)
      if (!openIssues.has(issue))
        hits.push({
          at,
          issue,
          message: `${at}: an expected failure cites #${issue}, which is not open. Fix the bug and turn it back into a passing test, or reopen #${issue}`,
        })
  }
  return hits
}
