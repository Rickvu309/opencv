import { FIXES } from "../result.mjs"

function catalogStale(facts) {
  const catalog = facts.catalog ?? {}
  if (catalog.error)
    return `the generated contract catalog could not be checked: ${catalog.error}`
  if (catalog.stale?.length)
    return `the generated contract catalog is stale: ${catalog.stale.join(", ")}`
  return null
}

function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    fix: () => FIXES[spec.id],
    ...spec,
  }
}

function onMain(facts) {
  if (facts.commit?.branch !== "main") return null
  return "committing on main is not allowed; work on a task branch in your own worktree"
}

function hookReadTheMessage(commit) {
  return commit?.first != null
}

function emptyMessage(facts) {
  if (!hookReadTheMessage(facts.commit) || facts.commit.first !== "")
    return null
  return "the commit message has no first line"
}

function noAiAttribution(facts) {
  const commits = facts.commits
  if (!commits?.trailers) return null
  if (commits.trailers === "this message")
    return "the commit message carries an attribution trailer"
  return `commit(s) ${String(commits.trailers).trim()} carry an attribution trailer, which the commit-msg hook refuses: they were made without that hook (the hook-skip flag, a cherry-pick or a rebase)`
}

function fileSize(facts) {
  const commits = facts.commits
  if (!commits?.oversize) return null
  return `file(s) over the 20000-byte limit (5000 tokens): ${String(commits.oversize).trim()}`
}

const SPLIT_GUIDE =
  "Split each file by responsibility (code into sibling modules, tests by describe block, docs by section), never by minifying; then re-stage and commit again"

export const commitRows = [
  rule({
    id: "ON_MAIN",
    section: "2",
    says: "No commit is made on main; work on a task branch in your own worktree.",
    at: ["commit"],
    needs: ["commit"],
    check: onMain,
    fix: () => "scripts/ocv-tools.mjs take <issue#>",
  }),
  rule({
    id: "EMPTY_MESSAGE",
    section: "4",
    says: "A commit message needs a first line.",
    at: ["commit"],
    needs: ["commit"],
    check: emptyMessage,
    fix: () => 'git commit -m "type: what changed"',
  }),
  rule({
    id: "NO_AI_ATTRIBUTION",
    section: "5",
    says: "No commit carries a Co-Authored-By or Generated-With attribution trailer.",
    at: ["commit", "finish", "pr"],
    needs: ["commits"],
    check: noAiAttribution,
    fix: (facts) =>
      facts?.commits?.trailers === "this message"
        ? "Delete the attribution trailer line from the commit message and commit again"
        : 'git reset --soft "$(git merge-base origin/main HEAD)" && git commit -m "$(git log -1 --format=%s ORIG_HEAD)" && git push --force-with-lease',
  }),
  rule({
    id: "FILE_SIZE",
    section: "5",
    says: "No authored file in the change is over the 20000-byte pre-commit limit.",
    at: ["commit", "finish", "pr"],
    needs: ["commits"],
    check: fileSize,
    fix: () => SPLIT_GUIDE,
  }),
  rule({
    id: "CATALOG_STALE",
    section: "4",
    says: "A commit that stages an operation, its server or a generated catalog file stages a catalog that node scripts/catalog.mjs generate would not change. The push does not repeat it; CI checks the pushed tree.",
    at: ["commit"],
    needs: ["catalog"],
    check: catalogStale,
    fix: () =>
      "Run node scripts/catalog.mjs generate, then git add packages/domain/src/generated apps/api/src/registry/generated and commit again. If the catalog cannot be read, fix the contract error it names; a missing package means pnpm install in this worktree, and a missing dist means pnpm --filter @workspace/domain build first.",
  }),
]
