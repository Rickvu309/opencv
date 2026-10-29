#!/usr/bin/env bash
# Runs scripts/merge-pr.sh with a stub gh and a stub review command, so no network is needed. The stub gh records
# every call in $MP_LOG; cases assert on the exit code, the output and which calls were recorded.
set -euo pipefail
# A git hook exports GIT_DIR; the throwaway repo below must never be the real one.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/lib/merge-pr-harness.sh
. "$here/lib/merge-pr-harness.sh"

reset
run
expect "ok path merges" 0 "merged PR #5 as cafe0000cafe0000cafe0000cafe0000cafe0000" "node scripts/pr.mjs release cafe0000cafe0000cafe0000cafe0000cafe0000 --wait 600"
called "ok path" "api repos/owner/repo/statuses/$head -f state=success -f context=gates/review-pr -f description=OK patch ${patch:0:12} main 1234567890ab"
called "ok path" "pr merge 5 --squash --match-head-commit $head"
status_line=$(grep -n 'statuses/' "$MP_LOG" | head -1 | cut -d: -f1); merge_line=$(grep -n 'pr merge' "$MP_LOG" | head -1 | cut -d: -f1)
(( status_line < merge_line )) || fail "ok path" "status was not posted before the merge"
result status=ok cause=none "next=node scripts/pr.mjs release cafe0000cafe0000cafe0000cafe0000cafe0000 --wait 600"

reset; MP_REVIEW_RC=1 MP_REVIEW_OUT="RESULT: FAIL (2). Request changes" run
expect "review FAIL exits 1" 1 "did not pass"
result status=fail cause=hygiene
no_writes "review FAIL"

reset; MP_REVIEW_RC=1 MP_REVIEW_OUT="" run
expect "review error without a RESULT line exits 1" 1 "did not pass"
no_writes "review error"

reset; MP_REVIEW_RC=2 MP_REVIEW_OUT="RESULT: HUMAN REQUIRED. Do NOT merge." run
expect "HUMAN REQUIRED exits 2" 2 "do not merge"
result status=human cause=hygiene
no_writes "HUMAN"

reset; MP_REVIEW_OUT="no result here" run
expect "exit 0 without an OK line refuses" 1 "without a RESULT: OK line"
no_writes "no OK line"

reset; MP_EVIDENCE=$(evidence "review-pr.sh: OK (patch id $old, main 1234567890ab). Independent review: sol-loop, approved. verify-opencv: PASS") run
expect "stale patch id refuses and names the current id" 1 "$patch"
result status=fail cause=hygiene "next=gh pr comment 5 --body \"review-pr.sh: OK (patch id $patch, main 1234567890ab). Independent review: <who>, approved. verify-<skill>: <result>\""
no_writes "stale"

reset; MP_EVIDENCE=$(evidence "review-pr.sh: OK (patch id ${patch}0, main 1234567890ab). Independent review: x, approved. verify: PASS") run
expect "a longer id that contains the patch id refuses" 1 "$patch"
no_writes "suffixed id"

reset; MP_EVIDENCE=$(evidence "review-pr.sh: OK (patch id a${patch}, main 1234567890ab). Independent review: x, approved. verify: PASS") run
expect "a prefixed id refuses" 1 "$patch"
no_writes "prefixed id"

reset; MP_DIFF_FAIL=1 run
expect "a failed diff listing refuses" 1 "could not list the files"
no_writes "diff failure"

reset; MP_MAIN=9999999999990000000000000000000000000000 run
expect "main moved during the review refuses and names --regate" 1 "main moved from 1234567890ab" "scripts/merge-pr.sh 5 --regate"
result status=fail cause=behind-main "next=scripts/merge-pr.sh 5 --regate"
[[ "$(cat "$MP_COUNT")" == 1 ]] || fail "main moved" "the gate reran without --regate"
never "main moved" "api repos/owner/repo/statuses/"; never "main moved" "pr merge"

# --regate: main moved after the gate. Disjoint files and overlapping files both rerun the gate; only an OK for the new
# main merges. The first gate tested main 1234567890ab; the rerun tests main 999999999999.
moved=9999999999990000000000000000000000000000
ok_line2="RESULT: OK (patch id $patch, main 999999999999). Check the verify-opencv evidence, then: gh pr merge 5 --squash --match-head-commit $head"
reset; MP_MAIN=$moved MP_REVIEW_OUT2=$ok_line2 MP_COMPARE_FILES="apps/web/a.tsx docs/z.md" run --regate
expect "--regate with disjoint files reruns the gate and merges" 0 "main moved from 1234567890ab to 999999999999: 2 file(s) changed on main" "disjoint: none of them is one of the PR's 2 file(s)" "review gate (regate: main moved)" "merged PR #5"
[[ "$(cat "$MP_COUNT")" == 2 ]] || fail "regate disjoint" "the gate ran $(cat "$MP_COUNT") times, want 2"
called "regate disjoint" "api repos/owner/repo/compare/1234567890ab...$moved"
called "regate disjoint" "description=OK patch ${patch:0:12} main 999999999999"
called "regate disjoint" "pr merge 5 --squash --match-head-commit $head"
result status=ok cause=none

reset; MP_MAIN=$moved MP_REVIEW_OUT2=$ok_line2 MP_COMPARE_FILES="scripts/x.sh apps/web/a.tsx" run --regate
expect "--regate with overlapping files says so, still reruns and merges" 0 "NOT disjoint: 1 file(s) are in both: scripts/x.sh" "merged PR #5"
[[ "$(cat "$MP_COUNT")" == 2 ]] || fail "regate overlap" "the gate ran $(cat "$MP_COUNT") times, want 2"

reset; MP_MAIN=$moved MP_REVIEW_OUT2=$ok_line2 MP_COMPARE_FAIL=1 run --regate
expect "--regate still reruns when the file list is unavailable" 0 "could not list the files that changed on main" "merged PR #5"

reset; MP_MAIN=$moved MP_REVIEW_RC2=1 MP_REVIEW_OUT2="RESULT: FAIL (1). Request changes" MP_COMPARE_FILES="scripts/x.sh" run --regate
expect "--regate does not merge when the rerun fails" 1 "NOT disjoint" "did not pass"
no_merge "regate rerun fails"

reset; MP_MAIN=$moved MP_COMPARE_FILES="docs/z.md" run --regate
expect "--regate does not merge when main moved again during the rerun" 1 "main moved from 1234567890ab" "--regate"
no_merge "regate main moved twice"
[[ "$(cat "$MP_COUNT")" == 2 ]] || fail "regate twice" "the gate ran $(cat "$MP_COUNT") times, want 2 (one rerun only)"

reset; MP_MAIN=$moved MP_REVIEW_OUT2=$ok_line2 MP_EVIDENCE=$(evidence "$review_only") MP_FILES="apps/web/a.tsx" MP_COMPARE_FILES="docs/z.md" run --regate
expect "--regate still demands the verify evidence" 1 "'verify'"
no_merge "regate missing verify"

reset
run --regate
expect "--regate with an unmoved main merges after one gate run" 0 "merged PR #5"
[[ "$(cat "$MP_COUNT")" == 1 ]] || fail "regate not needed" "the gate ran $(cat "$MP_COUNT") times, want 1"
never "regate not needed" "api repos/owner/repo/compare/"

reset; MP_EVIDENCE=$(evidence "looks good, patch id $patch") run
expect "no independent review refuses" 1 "Independent review"
no_writes "no independent review"

reset; MP_EVIDENCE=$(evidence "$review_only") MP_FILES="docs/y.md scripts/x.sh" run
expect "verify evidence is not needed without apps/" 0 "merged PR #5"

reset; MP_EVIDENCE=$(evidence "$review_only") MP_FILES="docs/y.md apps/web/src/a.tsx" run
expect "missing verify evidence refuses when apps/ changed" 1 "'verify'"
no_writes "missing verify"

reset; MP_EVIDENCE=$(jq -nc --arg a "$review_only" --arg b "verify-opencv PASS for patch id $patch" '{comments:[{body:$a}],reviews:[{body:$b}]}') MP_FILES="apps/web/src/a.tsx" run
expect "evidence may come from a comment and a review" 0 "merged PR #5"

reset; MP_AUTHOR=contributor run
expect "non-author refuses" 1 "contributor" "never merged here"
never "non-author" "api repos/"; never "non-author" "pr merge"
[[ ! -s "$tmp/out" ]] || ! grep -q 'review-pr: working' "$tmp/out" || fail "non-author" "the review ran before the author check"

reset
run --dry-run
expect "dry run passes and prints the commands" 0 "dry run, nothing changed" "context=gates/review-pr" "pr merge 5 --squash --match-head-commit $head"
no_merge "dry run"

reset; MP_AUTHOR=contributor run --dry-run
expect "dry run still refuses a non-author" 1 "contributor"


reset; echo one >"$tmp/repo/README"; git -C "$tmp/repo" add README; git -C "$tmp/repo" commit -q -m readme; echo more >>"$tmp/repo/README"
run
expect "R68: an edited file in the main checkout refuses" 1 "has edited files" "README"
no_writes "dirty main"

reset; git -C "$tmp/repo" switch -q -c feat/9-x
run
expect "R68: a main checkout on another branch refuses" 1 "is on 'feat/9-x'" "git -C"
git -C "$tmp/repo" switch -q main


reset; MP_FILES="docs/y.md .github/workflows/extra.yml" run
expect "R105: a workflow file refuses before the gate" 1 "GitHub Actions workflow files" ".github/workflows/extra.yml"
no_merge "workflow"; never_gated "workflow"
lookup_gone='wt=$(git worktree list --porcelain | awk -v b=refs/heads/feat/9-gone '"'"'/^worktree /{w=substr($0,10)} $0=="branch " b {print w; exit}'"'"') && [ -n "$wt" ] && cd "$wt" &&'
# The fix runs in the branch's worktree, never in the main checkout where merge-pr.sh runs, and removes the files for real.
fix=$(grep '^Fix: ' "$tmp/err" | sed 's/^Fix: //')
[[ "$fix" == "$lookup_gone git rm -rf -- .github/workflows/extra.yml && git commit --amend --no-edit && git push --force-with-lease" ]] || fail "R105 fix" "wrong fix: $fix"
git -C "$tmp/repo" worktree add -q -b feat/9-wt "$tmp/wt" pr-head
reset; MP_BRANCH=feat/9-wt MP_FILES=".github/workflows/extra.yml" run
expect "R105: the fix goes to the worktree that has the branch" 1 "Fix: cd $tmp/wt && git rm -rf -- .github/workflows/extra.yml"
git -C "$tmp/repo" worktree remove --force "$tmp/wt"; git -C "$tmp/repo" branch -q -D feat/9-wt

reset; rm "$tmp/repo/.git/pre-push-stamps/$head"; echo ok >"$tmp/repo/.git/pre-push-stamps/other"
run
expect "R97: a head with no pre-push stamp refuses before the gate and says to rebase" 1 "was pushed without the pre-push hook" "$lookup_gone git fetch origin main && git rebase origin/main && git commit --amend --no-edit && git push --force-with-lease"
no_merge "no stamp"; never_gated "no stamp"

reset; echo skip >"$tmp/repo/.git/pre-push-stamps/$head"
run
expect "R98: a SKIP_CHECKS push that the PR does not mention refuses" 1 "pushed with SKIP_CHECKS=1" "gh api -X PATCH repos/{owner}/{repo}/pulls/5"
grep -q 'gh pr edit' "$tmp/err" && fail "R98 fix" "gh pr edit fails on the deprecated Projects API here; the fix must use gh api"
no_merge "skip unsaid"; never_gated "skip unsaid"
# A real PR body is built from the template, which has its own line about SKIP_CHECKS. That line is not the declaration.
reset; echo skip >"$tmp/repo/.git/pre-push-stamps/$head"; MP_BODY=$(cat "$here/../.github/pull_request_template.md") run
expect "R98: the PR template's own SKIP_CHECKS line is not a declaration" 1 "does not say \"emergency declared by <name>\""
no_merge "template body"
reset; echo skip >"$tmp/repo/.git/pre-push-stamps/$head"; MP_BODY="**Checks were skipped (SKIP_CHECKS=1), emergency declared by unknown.**" run
expect "R98: an unnamed human is not a declaration" 1 "does not say"
reset; echo skip >"$tmp/repo/.git/pre-push-stamps/$head"
MP_BODY="**Checks were skipped (SKIP_CHECKS=1), emergency declared by Quan. Reviewer: run scripts/check.sh.**"$'\n\n'"$(cat "$here/../.github/pull_request_template.md")" run
expect "R98: the line open-pr.sh writes, with a name, merges" 0 "merged PR #5"

# R97 for a commit made with the commit hooks skipped: their refusals are checked again on the head.
git -C "$tmp/repo" switch -q -c trailer-head pr-head
echo y >"$tmp/repo/y.txt"; git -C "$tmp/repo" add y.txt
git -C "$tmp/repo" commit -q -m "feat: y (#9)" -m "Co-""Authored-""By: Someone <s@example.com>"
trailer_head=$(git -C "$tmp/repo" rev-parse HEAD)
git -C "$tmp/repo" switch -q -c big-head pr-head
head -c 30000 /dev/zero | tr '\0' 'a' >"$tmp/repo/big.txt"; git -C "$tmp/repo" add big.txt; git -C "$tmp/repo" commit -q -m "feat: big (#9)"
big_head=$(git -C "$tmp/repo" rev-parse HEAD)
git -C "$tmp/repo" switch -q main
for case in "trailer:$trailer_head:attribution trailer" "big:$big_head:over the 20000-byte"; do
  IFS=: read -r name sha want <<<"$case"
  reset; echo ok >"$tmp/repo/.git/pre-push-stamps/$sha"; MP_HEAD=$sha MP_REVIEW_OUT="RESULT: OK (patch id $patch, main 1234567890ab). Check the verify-opencv evidence, then: gh pr merge 5 --squash --match-head-commit $sha" run
  if [[ $name == big ]]; then fixcmd="$lookup_gone git add -A && git commit -m \"fix: split oversize files under the 20000-byte limit\" && git push origin HEAD"
  else fixcmd="$lookup_gone"; fi
  expect "R97: a $name commit that the commit hooks would refuse is refused before the gate" 1 "$want" "$fixcmd"
  no_merge "$name"; never_gated "$name"
done

# A commit on main with a trailer GitHub added is not the branch's: origin/main is fetched before the commits are compared.
git -C "$tmp/repo" switch -q -c main-next main
git -C "$tmp/repo" commit -q --allow-empty -m "feat: squash (#8)" -m "Co-""authored-""by: Reviewer <r@example.com>"
git -C "$tmp/repo" push -q origin main-next:main
git -C "$tmp/repo" switch -q -c on-new-main main-next
echo z >"$tmp/repo/z.txt"; git -C "$tmp/repo" add z.txt; git -C "$tmp/repo" commit -q -m "feat: z (#9)"
new_head=$(git -C "$tmp/repo" rev-parse HEAD)
git -C "$tmp/repo" switch -q main; git -C "$tmp/repo" branch -q -D main-next
git -C "$tmp/repo" update-ref refs/remotes/origin/main main
reset; echo ok >"$tmp/repo/.git/pre-push-stamps/$new_head"
MP_HEAD=$new_head MP_REVIEW_OUT="RESULT: OK (patch id $patch, main 1234567890ab). Check the verify-opencv evidence, then: gh pr merge 5 --squash --match-head-commit $new_head" run
expect "R97: a stale origin/main does not blame the branch for a trailer already on main" 0 "merged PR #5"
git -C "$tmp/repo" push -q origin main --force

reset
run --nope
expect "unknown option" 1 "unknown option"

bash "$here/test-merge-pr-gates.sh"
echo "all merge-pr cases passed"
