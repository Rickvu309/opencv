#!/usr/bin/env bash
# merge-pr.sh: the owner's merge command. Reruns the review gate, checks the evidence for the exact patch, posts the
# gates/review-pr status on the head and squash-merges. For an agent under the owner's account and the
# owner's own PRs only; a contributor's PR is refused.
#
# Usage (from the main checkout, through heavy like review-pr.sh):
#   heavy -- scripts/merge-pr.sh <pr#> [--dry-run] [--regate]
#
# Steps, stopping at the first failure:
#   0. it runs through heavy and the main checkout is on main with no edited file (docs/git-workflow/rule-enforcement.md)
#   1. the PR author is the authenticated gh user, and the head passes the workflow rules (no workflow file, pushed
#      through the pre-push hook, commits that pass the commit hooks, SKIP_CHECKS named), before the gate spends a slot
#   2. scripts/review-pr.sh <pr#> exits 0 (override the command with MERGE_PR_REVIEW_CMD)
#   3. a PR comment or review body names the current patch id and says "Independent review"; a PR that changes
#      anything under apps/ also needs a body with that patch id that says "verify"
#   3b. the check-run named ci is success on the head the review tested (GitHub requires it too; read here as a second guard)
#   4. main is still the commit the review tested, then gh api posts state=success for context gates/review-pr on the head the review tested
#   5. gh pr merge --squash --match-head-commit <that head>
#   6. prints the merge commit and the deploy check to run next
# --dry-run does 1-3, prints what 4 and 5 would run and changes nothing.
# --regate: if main moved while the gate ran (step 4 fails), print whether the files that changed on main are disjoint
#   from the PR's files (information only), run steps 2-4 once more against the new main, and merge only if the
#   rerun returns OK for the new head and main. The turbo and review caches make the rerun cheap. Without the flag the
#   error names this command as the next one.
#
# Evidence comment, one body is enough:
#   review-pr.sh: OK (patch id <id>, main <sha>). Independent review: <who>, approved. verify-<skill>: <result>
#
# Exit code:
#   0  merged (or dry run passed)
#   1  refused or failed
#   2  HUMAN REQUIRED: do not merge
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/lib/result.sh
. "$here/lib/result.sh"
# shellcheck source=scripts/lib/rules.sh
. "$here/lib/rules.sh"
result_begin merge-pr

die() { result_fail "${DIE_CAUSE:-hygiene}" "$*"; echo "merge-pr: $*" >&2; exit 1; }
review_cmd=${MERGE_PR_REVIEW_CMD:-$here/review-pr.sh}

[[ $# -ge 1 && "$1" =~ ^#?([0-9]+)$ ]] || { awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 1; }
rule_args=; (( $# )) && rule_args=$(printf '%q ' "$@")
pr=${BASH_REMATCH[1]}; shift
result_id "$pr"
export PR_RESULT_ID=$pr
RULE_ARGS=$rule_args rule_heavy scripts/merge-pr.sh
rule_main_clean "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
dry_run=0; regate=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) dry_run=1 ;;
    --regate) regate=1 ;;
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
[[ "$author" == "$me" ]] || die "PR #$pr is by $author, not $me. A contributor's PR is never merged here."

review_out=$(mktemp)
result_cleanup() { rm -f "$review_out"; }

# The workflow rules about the head, checked before the gate takes a heavy slot, and again if the head moved during it.
# The fix commands run in the branch's worktree: this script runs in the main checkout, which nobody edits.
checked_head=""
head_rules() {
  local sha=$1 branch wt
  branch=$(gh pr view "$pr" --json headRefName --jq .headRefName)
  wt=$(rule_wt_of "$branch")
  RULE_BRANCH=$branch
  changed=$(gh pr diff "$pr" --name-only) || die "could not list the files PR #$pr changes"
  rule_no_workflows "$changed" "$wt" push
  rule_pushed_through_hook "$sha" "$wt"
  git cat-file -e "$sha^{commit}" 2>/dev/null || git fetch --quiet origin "pull/$pr/head" 2>/dev/null || true
  git cat-file -e "$sha^{commit}" 2>/dev/null || DIE_CAUSE=env die "cannot read commit ${sha:0:9} of PR #$pr to check its commits (git fetch origin pull/$pr/head)"
  git fetch --quiet origin main || DIE_CAUSE=env die "cannot fetch origin/main (git fetch origin main)"
  rule_commits_hooked origin/main "$sha" "$wt" push
  rule_ci_workflow_kept "$changed" "$sha" "$wt"
  if grep -qxE '\.github/workflows/ci\.yml|scripts/check\.sh|\.github/rulesets/main\.json' <<<"$changed"; then
    [[ "$branch" =~ ^[a-z]+/([0-9]+)- ]] || die "branch $branch names no issue, so its risk label cannot be read"
    rule_risk_high_for_ci "$changed" "$(gh issue view "${BASH_REMATCH[1]}" --json labels --jq '.labels[].name')" "$wt"
  fi
  rule_skip_said "$sha" "$pr" "$(gh pr view "$pr" --json body --jq .body)"
  checked_head=$sha
}
head_rules "$(gh pr view "$pr" --json headRefOid --jq .headRefOid)"

# Steps 2 and 3: the review gate, then the evidence for the patch id it printed.
gate() {
  echo "==> PR #$pr: review gate${1:+ ($1)}"
  set +e
  "$review_cmd" "$pr" 2>&1 | tee "$review_out"
  review_rc=${PIPESTATUS[0]}
  set -e
  parse_review "$review_out"
  case "$review_rc" in
    0) [[ "$rec_result" == OK ]] || die "review-pr.sh exited 0 without a RESULT: OK line" ;;
    2) result_human "HUMAN REQUIRED, do not merge PR #$pr"; echo "merge-pr: HUMAN REQUIRED, do not merge PR #$pr." >&2; exit 2 ;;
    *) result_adopt "$(result_path review-pr)" || true
       die "review-pr.sh did not pass (exit $review_rc). Not merging." ;;
  esac

  echo "==> PR #$pr: evidence for patch id $rec_patch"
  # The id must stand alone, so a longer hex string that contains it does not count.
  bodies_with() {
    gh pr view "$pr" --json comments,reviews --jq \
      "[.comments[].body, .reviews[].body] | map(select(test(\"(^|[^0-9a-f])$rec_patch(\$|[^0-9a-f])\") and test(\"$1\"; \"i\"))) | length"
  }
  stale() {
    result_next "gh pr comment $pr --body \"review-pr.sh: OK (patch id $rec_patch, main $rec_main). Independent review: <who>, approved. verify-<skill>: <result>\""
    die "no PR comment or review names the current patch id $rec_patch with '$1'. Evidence for an older patch does not count; post a new comment: review-pr.sh: OK (patch id $rec_patch, main $rec_main). Independent review: <who>, approved. verify-<skill>: <result>"
  }
  (( $(bodies_with 'independent review') > 0 )) || stale "Independent review"
  [[ "$rec_head" == "$checked_head" ]] || head_rules "$rec_head"
  if grep -q '^apps/' <<<"$changed"; then
    (( $(bodies_with 'verify') > 0 )) || stale "verify"
  fi
  echo "  ok    evidence names patch id $rec_patch"
}

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# Information for --regate: what changed on main since the gate tested it, and whether any of it is in the PR's files.
report_main_moved() {
  local moved overlap n_moved n_overlap
  if ! moved=$(gh api "repos/$repo/compare/$rec_main...$main_now" --jq '.files[].filename' 2>/dev/null); then
    echo "  main moved from $rec_main to ${main_now:0:12}; could not list the files that changed on main"
    return 0
  fi
  moved=$(sort -u <<<"$moved" | sed '/^$/d')
  overlap=$(comm -12 <(printf '%s\n' "$moved") <(sort -u <<<"$changed" | sed '/^$/d'))
  n_moved=$(grep -c . <<<"$moved" || true); n_overlap=$(grep -c . <<<"$overlap" || true)
  echo "  main moved from $rec_main to ${main_now:0:12}: $n_moved file(s) changed on main since the gate"
  if (( n_overlap == 0 )); then
    echo "  disjoint: none of them is one of the PR's $(grep -c . <<<"$changed" || true) file(s); the gate reruns anyway"
  else
    echo "  NOT disjoint: $n_overlap file(s) are in both: $(tr '\n' ' ' <<<"$overlap")"
  fi
}

# GitHub also requires ci on main; read here too, belt and braces: a green run on the exact head the review tested.
ci_gate() {
  local state
  state=$(gh api "repos/$repo/commits/$rec_head/check-runs?check_name=ci" --jq \
    '[.check_runs[] | select(.name == "ci")] | sort_by(.started_at) | last | if . == null then "missing" else (.conclusion // "pending") end') ||
    die "could not read the ci check of ${rec_head:0:9}"
  [[ "$state" == success ]] && { echo "  ok    ci check passed on ${rec_head:0:9}"; return 0; }
  result_next "gh run list --workflow ci.yml --commit $rec_head"
  die "the ci check on head ${rec_head:0:9} is $state, not success. Fix: wait for the run to finish, or gh run rerun <run id> (gh run list --workflow ci.yml --commit $rec_head); the runner service must be online"
}

attempt=1
while :; do
  gate "$([[ $attempt == 1 ]] || echo "regate: main moved")"
  ci_gate
  status_cmd=(gh api "repos/$repo/statuses/$rec_head" -f state=success -f context=gates/review-pr
    -f "description=OK patch ${rec_patch:0:12} main ${rec_main:0:12}")
  merge_cmd=(gh pr merge "$pr" --squash --match-head-commit "$rec_head")

  if (( dry_run )); then
    echo "==> dry run, nothing changed. Would run:"
    printf '  %s\n' "${status_cmd[*]}" "${merge_cmd[*]}"
    result_ok "dry run for patch id $rec_patch, nothing changed" "heavy -- scripts/merge-pr.sh $pr"
    exit 0
  fi

  echo "==> PR #$pr: status and merge"
  main_now=$(gh api "repos/$repo/branches/main" --jq .commit.sha) || die "could not read the current main"
  [[ "$main_now" == "$rec_main"* ]] && break
  if (( regate && attempt == 1 )); then
    report_main_moved
    attempt=2
    continue
  fi
  result_next "heavy -- scripts/merge-pr.sh $pr --regate"
  DIE_CAUSE=behind-main die "main moved from $rec_main to ${main_now:0:12} during the review. Rerun the gate against the new main: heavy -- scripts/merge-pr.sh $pr --regate"
done
"${status_cmd[@]}" >/dev/null
"${merge_cmd[@]}"

merge_sha=$(gh pr view "$pr" --json mergeCommit --jq .mergeCommit.oid)
echo "==> merged PR #$pr as $merge_sha"
result_ok "merged PR #$pr as $merge_sha" "node scripts/pr.mjs release $merge_sha --wait 600"
echo "Next: node scripts/pr.mjs release $merge_sha --wait 600"
