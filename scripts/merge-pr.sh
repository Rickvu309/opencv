#!/usr/bin/env bash
# merge-pr.sh: the owner's merge command. Reruns the review gate, checks the evidence for the exact patch, posts the
# gates/review-pr status on the head and squash-merges with --admin. For an agent under the owner's account and the
# owner's own PRs only; a contributor's PR is refused.
#
# Usage (from the main checkout, through heavy like review-pr.sh):
#   heavy -- scripts/merge-pr.sh <pr#> [--dry-run]
#
# Steps, stopping at the first failure:
#   1. the PR author is the authenticated gh user
#   2. scripts/review-pr.sh <pr#> exits 0 (override the command with MERGE_PR_REVIEW_CMD)
#   3. a PR comment or review body names the current patch id and says "Independent review"; a PR that changes
#      anything under apps/ also needs a body with that patch id that says "verify"
#   4. main is still the commit the review tested, then gh api posts state=success for context gates/review-pr on the head the review tested
#   5. gh pr merge --squash --admin --match-head-commit <that head>
#   6. prints the merge commit and the deploy check to run next
# --dry-run does 1-3, prints what 4 and 5 would run and changes nothing.
#
# Evidence comment, one body is enough:
#   review-pr.sh: OK (patch id <id>, main <sha>). Independent review: <who>, approved. verify-<skill>: <result>
#
# Exit code:
#   0  merged (or dry run passed)
#   1  refused or failed
#   2  HUMAN REQUIRED: do not merge
set -euo pipefail

die() { echo "merge-pr: $*" >&2; exit 1; }

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
review_cmd=${MERGE_PR_REVIEW_CMD:-$here/review-pr.sh}

[[ $# -ge 1 && "$1" =~ ^#?([0-9]+)$ ]] || { awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 1; }
pr=${BASH_REMATCH[1]}; shift
dry_run=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) dry_run=1 ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

# The review's last RESULT line is the one record every later step reads.
rec_result=""; rec_patch=""; rec_main=""; rec_head=""
parse_review() {
  local line
  line=$(grep -E '^RESULT:' "$1" | tail -1 || true)
  case "$line" in
    "RESULT: OK "*)
      [[ "$line" =~ patch\ id\ ([0-9a-f]+|none),\ main\ ([0-9a-f]+).*--match-head-commit\ ([0-9a-f]+) ]] ||
        die "cannot read the patch id, main and head from: $line"
      rec_result=OK; rec_patch=${BASH_REMATCH[1]}; rec_main=${BASH_REMATCH[2]}; rec_head=${BASH_REMATCH[3]} ;;
    "RESULT: HUMAN"*) rec_result=HUMAN ;;
    *) rec_result=FAIL ;;
  esac
}

echo "==> PR #$pr: author"
author=$(gh pr view "$pr" --json author --jq .author.login)
me=$(gh api user --jq .login)
[[ "$author" == "$me" ]] || die "PR #$pr is by $author, not $me. A contributor's PR is never merged with --admin."

echo "==> PR #$pr: review gate"
review_out=$(mktemp)
trap 'rm -f "$review_out"' EXIT
set +e
"$review_cmd" "$pr" 2>&1 | tee "$review_out"
review_rc=${PIPESTATUS[0]}
set -e
parse_review "$review_out"
case "$review_rc" in
  0) [[ "$rec_result" == OK ]] || die "review-pr.sh exited 0 without a RESULT: OK line" ;;
  2) echo "merge-pr: HUMAN REQUIRED, do not merge PR #$pr." >&2; exit 2 ;;
  *) die "review-pr.sh did not pass (exit $review_rc). Not merging." ;;
esac

echo "==> PR #$pr: evidence for patch id $rec_patch"
# The id must stand alone, so a longer hex string that contains it does not count.
bodies_with() {
  gh pr view "$pr" --json comments,reviews --jq \
    "[.comments[].body, .reviews[].body] | map(select(test(\"(^|[^0-9a-f])$rec_patch(\$|[^0-9a-f])\") and test(\"$1\"; \"i\"))) | length"
}
stale() {
  die "no PR comment or review names the current patch id $rec_patch with '$1'. Evidence for an older patch does not count; post a new comment: review-pr.sh: OK (patch id $rec_patch, main $rec_main). Independent review: <who>, approved. verify-<skill>: <result>"
}
(( $(bodies_with 'independent review') > 0 )) || stale "Independent review"
changed=$(gh pr diff "$pr" --name-only) || die "could not list the files PR #$pr changes"
if grep -q '^apps/' <<<"$changed"; then
  (( $(bodies_with 'verify') > 0 )) || stale "verify"
fi
echo "  ok    evidence names patch id $rec_patch"

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
status_cmd=(gh api "repos/$repo/statuses/$rec_head" -f state=success -f context=gates/review-pr
  -f "description=OK patch ${rec_patch:0:12} main ${rec_main:0:12}")
merge_cmd=(gh pr merge "$pr" --squash --admin --match-head-commit "$rec_head")

if (( dry_run )); then
  echo "==> dry run, nothing changed. Would run:"
  printf '  %s\n' "${status_cmd[*]}" "${merge_cmd[*]}"
  exit 0
fi

echo "==> PR #$pr: status and merge"
main_now=$(gh api "repos/$repo/branches/main" --jq .commit.sha) || die "could not read the current main"
[[ "$main_now" == "$rec_main"* ]] ||
  die "main moved from $rec_main to ${main_now:0:12} during the review. Rerun: heavy -- scripts/merge-pr.sh $pr"
"${status_cmd[@]}" >/dev/null
"${merge_cmd[@]}"

merge_sha=$(gh pr view "$pr" --json mergeCommit --jq .mergeCommit.oid)
echo "==> merged PR #$pr as $merge_sha"
echo "Next: node scripts/verify-deploy.mjs --commit $merge_sha"
