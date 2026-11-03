const TITLE =
  /^(feat|fix|hotfix|refactor|chore|docs)(\([a-z0-9-]+\))?!?: [^ ].* \(#(\d+)\)$/
const BRANCH_ISSUE = /^(?:feat|fix|hotfix|refactor|chore|docs)\/(\d+)-/

export function issueOfBranch(name) {
  const found = BRANCH_ISSUE.exec(name ?? "")
  return found ? Number(found[1]) : null
}

export function issueInTitle(title) {
  const found = TITLE.exec(title ?? "")
  return found ? Number(found[3]) : null
}

export function closesIssue(text, n) {
  return new RegExp(`(^|\\s)Closes #${n}(\\D|$)`).test(text ?? "")
}
