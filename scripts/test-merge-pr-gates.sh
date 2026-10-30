#!/usr/bin/env bash
# merge-pr.sh gates: the required ci check, and risk:high for ci.yml, check.mjs and the ruleset.
# Same stubs as test-merge-pr.sh (scripts/lib/merge-pr-harness.sh).
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/lib/merge-pr-harness.sh
. "$here/lib/merge-pr-harness.sh"

reset; MP_MERGE_FAIL=1 run
expect "refused merge says so" 1 "GitHub refused the merge/enqueue" "allow_auto_merge=true" "Never add --admin"
called "refused merge" "pr merge 5 --squash --match-head-commit $head"
never "refused merge" "statuses/"

# The required ci check gates the merge: only a success on the head passes.
for case in "failure:{\"check_runs\":[{\"name\":\"ci\",\"conclusion\":\"failure\",\"started_at\":\"2026-01-01T00:00:00Z\"}]}:is failure" \
  "pending:{\"check_runs\":[{\"name\":\"ci\",\"conclusion\":null,\"started_at\":\"2026-01-01T00:00:00Z\"}]}:is pending" \
  "missing:{\"check_runs\":[]}:is missing" \
  "other:{\"check_runs\":[{\"name\":\"check\",\"conclusion\":\"success\",\"started_at\":\"2026-01-01T00:00:00Z\"}]}:is missing"; do
  name=${case%%:*}; rest=${case#*:}; want=${rest##*:}; json=${rest%:*}
  reset; MP_CI=$json run
  expect "a $name ci check refuses the merge" 1 "$want" "gh run rerun"
  result status=fail cause=hygiene
  no_merge "ci $name"
done
reset; MP_CI='{"check_runs":[{"name":"ci","conclusion":"failure","started_at":"2026-01-01T00:00:00Z"},{"name":"ci","conclusion":"success","started_at":"2026-01-02T00:00:00Z"}]}' run
expect "the latest ci run counts, a rerun that passed merges" 0 "merged PR #5"
# A newer queued ci run has no start time yet; it must still beat an older success (latest = highest id).
reset; MP_CI='{"check_runs":[{"id":2,"name":"ci","status":"queued","conclusion":null,"started_at":null},{"id":1,"name":"ci","status":"completed","conclusion":"success","started_at":"2026-01-01T00:00:00Z"}]}' run
expect "a newer queued ci run beats an older success" 1 "is pending" "gh run rerun"
no_merge "newer queued ci"

# ci.yml, check.mjs and the ruleset attest the ci check, so the issue must carry risk:high.
reset; MP_FILES="scripts/check.mjs docs/y.md" run
expect "a check.mjs change without risk:high refuses" 1 "risk:high" "gh issue edit"
no_merge "risk"
reset; MP_FILES="scripts/check.mjs" MP_LABELS="chore risk:normal" run
expect "another risk label does not count" 1 "risk:high"
no_merge "risk normal"
reset; MP_FILES=".github/workflows/ci.yml" run
expect "deleting ci.yml refuses" 1 "deletes .github/workflows/ci.yml" "git checkout origin/main -- .github/workflows/ci.yml"
no_merge "ci delete"
reset; MP_FILES=".github/rulesets/main.json" MP_LABELS="chore risk:high" run
expect "risk:high lets a ruleset change through" 0 "merged PR #5"

reset; MP_FILES=".github/actions/setup/action.yml" run
expect "an action change without risk:high refuses" 1 "risk:high"
no_merge "action risk"
reset; MP_FILES=".github/actions/setup/action.yml" MP_LABELS="chore risk:high" run
expect "risk:high lets an action change through" 0 "merged PR #5"

# The pull request details are read fresh at merge: title, closing line, open issue.
for case in "title:MP_TITLE=fix bug:title is not" "wrong number:MP_TITLE=feat: x (#8):title is not" \
  "closing line:MP_BODY=Summary only:no \"Closes #9\"" "other issue:MP_BODY=Closes #99:no \"Closes #9\"" "closed issue:MP_ISSUE_STATE=CLOSED:issue #9 is closed"; do
  name=${case%%:*}; rest=${case#*:}; want=${rest##*:}; assign=${rest%:*}
  reset; export "$assign"; run
  expect "a bad $name refuses" 1 "$want" "gh pr edit 5 --title"
  result status=fail cause=hygiene
  no_merge "metadata $name"
done
reset; MP_BRANCH=feat/no-issue run
expect "a branch with no issue refuses" 1 "names no issue" "rename the branch"
no_merge "no issue"

# Mass deletion: a throwaway base with authored files, generated files (read from the base tree's attributes) and one big file.
git -C "$tmp/repo" switch -q main
mkdir -p "$tmp/repo/d" "$tmp/repo/gen" "$tmp/repo/.github/workflows"
for i in $(seq 1 40); do echo "line $i" >"$tmp/repo/d/f$i.txt"; echo "gen $i" >"$tmp/repo/gen/g$i.txt"; done
seq 1 2500 >"$tmp/repo/big.txt"
echo 'gen/** linguist-generated' >"$tmp/repo/.gitattributes"
echo "on: push" >"$tmp/repo/.github/workflows/ci.yml"
git -C "$tmp/repo" add -A && git -C "$tmp/repo" commit -q -m "base files" && git -C "$tmp/repo" push -q origin main
branch_from_main() {  # branch_from_main <name> <command run in the repo>: commit the result and print the sha
  git -C "$tmp/repo" switch -q -c "$1" main; (cd "$tmp/repo" && eval "$2"); git -C "$tmp/repo" add -A
  git -C "$tmp/repo" commit -q -m "feat: change (#9)"; git -C "$tmp/repo" rev-parse HEAD; git -C "$tmp/repo" switch -q main
}
many=$(branch_from_main many 'git rm -q d/f1.txt d/f2.txt d/f3.txt d/f4.txt d/f5.txt d/f6.txt d/f7.txt d/f8.txt d/f9.txt d/f10.txt d/f11.txt d/f12.txt d/f13.txt d/f14.txt d/f15.txt d/f16.txt d/f17.txt d/f18.txt d/f19.txt d/f20.txt d/f21.txt d/f22.txt d/f23.txt d/f24.txt d/f25.txt d/f26.txt')
reset; MP_HEAD=$many run
expect "26 deleted authored files refuse" 1 "deletes a lot of authored source" "26 files (limit 25)" "needs-human-review" "Fix:"
no_merge "mass delete"
result status=fail cause=hygiene
gen=$(branch_from_main gen 'git rm -q gen/*.txt')
reset; MP_HEAD=$gen run
expect "deleting generated files is not a mass deletion" 0 "merged PR #5"
self=$(branch_from_main self 'git rm -q d/f*.txt && echo "d/** linguist-generated" >.gitattributes')
reset; MP_HEAD=$self run
expect "a PR cannot exempt its own deletions" 1 "deletes a lot of authored source"
no_merge "self exempt"
big=$(branch_from_main big 'git rm -q big.txt')
reset; MP_HEAD=$big run
expect "2500 deleted lines refuse" 1 "2500 lines (limit 2000)"
pct=$(branch_from_main pct 'git rm -q d/f1.txt d/f2.txt d/f3.txt d/f4.txt d/f5.txt d/f6.txt d/f7.txt d/f8.txt d/f9.txt d/f10.txt d/f11.txt d/f12.txt d/f13.txt d/f14.txt d/f15.txt d/f16.txt d/f17.txt d/f18.txt d/f19.txt d/f20.txt')
reset; MP_HEAD=$pct run
expect "20 of 41 authored files is over 10 percent" 1 "authored files (limit 10%)"
few=$(branch_from_main few 'git rm -q d/f1.txt d/f2.txt')
reset; MP_HEAD=$few run
expect "a small deletion merges" 0 "merged PR #5"

# A rename of ci.yml to nightly.yml: gh pr diff lists only nightly.yml, so the git diff without renames must catch it.
ren=$(branch_from_main ren 'git mv .github/workflows/ci.yml .github/workflows/nightly.yml')
reset; MP_HEAD=$ren MP_FILES=".github/workflows/nightly.yml" MP_LABELS="chore risk:high" run
expect "renaming ci.yml away refuses" 1 "deletes .github/workflows/ci.yml" "git checkout origin/main -- .github/workflows/ci.yml"
no_merge "ci rename"

echo "all merge-pr gate cases passed"
