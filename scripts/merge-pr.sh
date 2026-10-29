#!/usr/bin/env bash
# merge-pr.sh: squash-merge a PR once ci is green. The owner's own PRs only.
#
# Usage (from the main checkout):
#   scripts/merge-pr.sh <pr#>
#
# Refuses when the author is not the authenticated gh user, the PR is a draft, the PR has the
# needs-human-review label, the ci check-run on the head is not success, the PR deletes ci.yml, or the PR
# changes ci.yml, scripts/check.sh or .github/rulesets/main.json and the issue is not labeled risk:high.
# Then: gh pr merge <pr#> --squash --match-head-commit <head>
#
# Exit code:
#   0  merged
#   1  refused or failed
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/lib/result.sh
. "$here/lib/result.sh"
# shellcheck source=scripts/lib/rules.sh
. "$here/lib/rules.sh"
result_begin merge-pr

die() { result_fail "${DIE_CAUSE:-hygiene}" "$*"; echo "merge-pr: $*" >&2; exit 1; }

[[ $# -ge 1 && "$1" =~ ^#?([0-9]+)$ ]] || { awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 1; }
pr=${BASH_REMATCH[1]}; shift
result_id "$pr"
[[ $# -eq 0 ]] || die "unknown option: $1"

echo "==> PR #$pr: author"
author=$(gh pr view "$pr" --json author --jq .author.login)
me=$(gh api user --jq .login)
[[ "$author" == "$me" ]] || die "PR #$pr is by $author, not $me. A contributor's PR is never merged here."

draft=$(gh pr view "$pr" --json isDraft --jq .isDraft)
if [[ "$draft" == "true" ]]; then
  die "PR #$pr is a draft. Mark it ready first: gh pr ready $pr"
fi

pr_labels=$(gh pr view "$pr" --json labels --jq '.labels[].name')
if grep -qx 'needs-human-review' <<<"$pr_labels"; then
  die "PR #$pr has the needs-human-review label. An agent never merges it."
fi

head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
branch=$(gh pr view "$pr" --json headRefName --jq .headRefName)
RULE_BRANCH=$branch
wt=$(rule_wt_of "$branch")
git cat-file -e "$head^{commit}" 2>/dev/null || git fetch --quiet origin "pull/$pr/head" 2>/dev/null || true
git cat-file -e "$head^{commit}" 2>/dev/null || DIE_CAUSE=env die "cannot read commit ${head:0:9} of PR #$pr (git fetch origin pull/$pr/head)"
changed=$(gh pr diff "$pr" --name-only) || die "could not list the files PR #$pr changes"
rule_ci_workflow_kept "$changed" "$head" "$wt"
if grep -qxE '\.github/workflows/ci\.yml|\.github/actions/.*|scripts/check\.sh|\.github/rulesets/main\.json' <<<"$changed"; then
  [[ "$branch" =~ ^[a-z]+/([0-9]+)- ]] || die "branch $branch names no issue, so its risk label cannot be read"
  rule_risk_high_for_ci "$changed" "$(gh issue view "${BASH_REMATCH[1]}" --json labels --jq '.labels[].name')" "$wt"
fi

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
echo "==> PR #$pr: ci check"
state=$(gh api "repos/$repo/commits/$head/check-runs?check_name=ci" --jq \
  '[.check_runs[] | select(.name == "ci")] | sort_by(.id) | last | if . == null then "missing" else (.conclusion // "pending") end') ||
  die "could not read the ci check of ${head:0:9}"
if [[ "$state" != success ]]; then
  result_next "gh run list --workflow ci.yml --commit $head"
  die "the ci check on head ${head:0:9} is $state, not success. Fix: wait for the run to finish, or gh run rerun <run id> (gh run list --workflow ci.yml --commit $head)"
fi
echo "  ok    ci check passed on ${head:0:9}"

echo "==> PR #$pr: merge"
gh pr merge "$pr" --squash --match-head-commit "$head" ||
  die "GitHub refused the merge of PR #$pr. Run node scripts/pr.mjs doctor; if the ruleset drifted, apply it: gh api -X PUT repos/$repo/rulesets/25725442 --input .github/rulesets/main.json. Never add --admin."

merge_sha=$(gh pr view "$pr" --json mergeCommit --jq .mergeCommit.oid)
echo "==> merged PR #$pr as $merge_sha"
result_ok "merged PR #$pr as $merge_sha" "node scripts/pr.mjs release $merge_sha --wait 600"
echo "Next: node scripts/pr.mjs release $merge_sha --wait 600"
