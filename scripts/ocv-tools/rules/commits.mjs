// Rules about the commits on the branch: no AI attribution trailers and no
// file over the pre-commit size limit. The commit-msg and pre-commit hooks
// hold these at commit; finish and the policy job re-read them from the
// gathered commit facts.
import { FIXES } from "../result.mjs"

function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    jobs: [],
    fix: () => FIXES[spec.id],
    ...spec,
  }
}

function noAiAttribution(facts) {
  const commits = facts.commits
  if (!commits?.trailers) return null
  return `commit(s) ${String(commits.trailers).trim()} carry an attribution trailer, which the commit-msg hook refuses: they were made without that hook (the hook-skip flag, a cherry-pick or a rebase)`
}

function fileSize(facts) {
  const commits = facts.commits
  if (!commits?.oversize) return null
  return `file(s) over the 20000-byte pre-commit limit: ${String(commits.oversize).trim()}; a commit this size passes only with the hook-skip flag. Split each file as .githooks/pre-commit says, then run the fix`
}

export const commitRows = [
  rule({
    id: "NO_AI_ATTRIBUTION",
    section: "5",
    says: "No commit carries a Co-Authored-By or Generated-With attribution trailer.",
    jobs: ["open"],
    at: ["commit", "finish", "pr"],
    needs: ["commits"],
    check: noAiAttribution,
    fix: () =>
      'git reset --soft "$(git merge-base origin/main HEAD)" && git commit -m "$(git log -1 --format=%s ORIG_HEAD)" && git push --force-with-lease',
  }),
  rule({
    id: "FILE_SIZE",
    section: "5",
    says: "No authored file in the change is over the 20000-byte pre-commit limit.",
    jobs: ["open"],
    at: ["commit", "finish", "pr"],
    needs: ["commits"],
    check: fileSize,
    fix: () =>
      'git add -A && git commit -m "fix: split oversize files under the 20000-byte limit"',
  }),
]
