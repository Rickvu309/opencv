#!/usr/bin/env bash
# Runs scripts/merge-pr.sh with a stub gh and a stub review command, so no network is needed. The stub gh records
# every call in $MP_LOG; cases assert on the exit code, the output and which calls were recorded.
set -euo pipefail
# A git hook exports GIT_DIR; the throwaway repo below must never be the real one.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
script=$here/merge-pr.sh
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir "$tmp/bin"
cat >"$tmp/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$MP_LOG"
case "$1 $2" in
  "api user") echo "$MP_ME" ;;
  "repo view") echo "owner/repo" ;;
  "pr diff") [[ -z "${MP_DIFF_FAIL:-}" ]] || exit 1; printf '%s\n' $MP_FILES ;;
  "api repos/owner/repo/branches/main") echo "${MP_MAIN:-1234567890ab00000000000000000000000000ff}" ;;
  "api repos/owner/repo/compare/"*) [[ -z "${MP_COMPARE_FAIL:-}" ]] || exit 1; printf '%s\n' ${MP_COMPARE_FILES:-} ;;
  "pr merge" | "api repos/owner/repo/statuses/"*) ;;
  "pr view")
    case "$*" in
      *"--json body"*) jq -r "${@: -1}" <<<"{\"body\":\"${MP_BODY:-}\"}" ;;
      *"--json author"*) jq -r "${@: -1}" <<<"{\"author\":{\"login\":\"$MP_AUTHOR\"}}" ;;
      *"--json comments,reviews"*) jq -r "${@: -1}" <<<"$MP_EVIDENCE" ;;
      *"--json mergeCommit"*) jq -r "${@: -1}" <<<'{"mergeCommit":{"oid":"cafe0000cafe0000cafe0000cafe0000cafe0000"}}' ;;
      *) echo "stub gh: unexpected: $*" >&2; exit 1 ;;
    esac ;;
  *) echo "stub gh: unexpected: $*" >&2; exit 1 ;;
esac
STUB
cat >"$tmp/review" <<'STUB'
#!/usr/bin/env bash
# The first call answers MP_REVIEW_OUT/RC; every later call (the --regate rerun) answers MP_REVIEW_OUT2/RC2 when set.
n=$(( $(cat "$MP_COUNT" 2>/dev/null || echo 0) + 1 )); echo "$n" >"$MP_COUNT"
echo "review-pr: working on $1 (call $n)"
if (( n > 1 )) && [[ -n "${MP_REVIEW_OUT2:-}" ]]; then printf '%s\n' "$MP_REVIEW_OUT2"; exit "${MP_REVIEW_RC2:-0}"; fi
printf '%s\n' "$MP_REVIEW_OUT"
exit "$MP_REVIEW_RC"
STUB
chmod +x "$tmp/bin/gh" "$tmp/review"
# merge-pr.sh runs from the main checkout: a throwaway repo on main stands in for it.
git init -q -b main "$tmp/repo" && git -C "$tmp/repo" config core.hooksPath /dev/null
git -C "$tmp/repo" commit -q --allow-empty -m base
export HEAVY_SLOT=1
export PATH=$tmp/bin:$PATH MP_LOG=$tmp/gh.log MERGE_PR_REVIEW_CMD=$tmp/review
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv MP_COUNT=$tmp/review-count

patch=0123456789abcdef0123456789abcdef01234567
old=ffffffffffffffffffffffffffffffffffffffff
head=abcdef0123456789abcdef0123456789abcdef01
ok_line="RESULT: OK (patch id $patch, main 1234567890ab). Check the verify-opencv evidence, then: gh pr merge 5 --squash --match-head-commit $head"
evidence() { jq -nc --arg c "$1" '{comments:[{body:$c}],reviews:[]}'; }
full="review-pr.sh: OK (patch id $patch, main 1234567890ab). Independent review: sol-loop, approved. verify-opencv: PASS"
review_only="review-pr.sh: OK (patch id $patch, main 1234567890ab). Independent review: sol-loop, approved."

reset() {
  : >"$MP_LOG"; rm -f "$MP_COUNT"; unset MP_BODY; rm -rf "$tmp/repo/.git/pre-push-stamps"; export HEAVY_SLOT=1
  mkdir -p "$tmp/repo/.git/pre-push-stamps"; echo ok >"$tmp/repo/.git/pre-push-stamps/$head"
  git -C "$tmp/repo" switch -q main 2>/dev/null || true; git -C "$tmp/repo" reset -q --hard; unset MP_REVIEW_OUT2 MP_REVIEW_RC2 MP_COMPARE_FILES MP_COMPARE_FAIL MP_MAIN
  export MP_ME=owner MP_AUTHOR=owner MP_REVIEW_RC=0 MP_REVIEW_OUT=$ok_line MP_FILES="scripts/x.sh docs/y.md"
  MP_EVIDENCE=$(evidence "$full"); export MP_EVIDENCE
}
run() {
  set +e
  (cd "$tmp/repo" && "$script" 5 "$@") >"$tmp/out" 2>"$tmp/err"
  code=$?
  set -e
}
fail() { printf 'FAIL %s: %s\n' "$1" "$2" >&2; cat "$tmp/out" "$tmp/err" "$MP_LOG" >&2; exit 1; }
expect() {
  local name=$1 want=$2; shift 2
  [[ "$code" -eq "$want" ]] || fail "$name" "exit $code, want $want"
  local needle
  cat "$tmp/out" "$tmp/err" >"$tmp/all"
  for needle in "$@"; do grep -F -q -- "$needle" "$tmp/all" || fail "$name" "output missing: $needle"; done
  printf 'ok: %s (exit %s)\n' "$name" "$code"
}
# The result file of the last run must pass the schema check and these key=value expectations; its path is the last line.
result() {
  local f=$PR_RESULT_DIR/opencv-merge-pr-5.json
  node "$here/lib/result-check.mjs" "$f" script=merge-pr id=5 "$@" >/dev/null || fail "result file" "$(cat "$f" 2>/dev/null)"
  [[ "$(tail -n1 "$tmp/out")" == "RESULT_JSON: $f" ]] || fail "result file" "RESULT_JSON is not the last line"
}
called() { grep -F -q -- "$2" "$MP_LOG" || fail "$1" "gh was not called with: $2"; }
never() { grep -F -q -- "$2" "$MP_LOG" && fail "$1" "gh was called with: $2"; return 0; }
no_merge() { never "$1" "api repos/owner/repo/statuses/"; never "$1" "pr merge"; }
no_writes() { never "$1" "api repos/"; never "$1" "pr merge"; }

reset
run
expect "ok path merges" 0 "merged PR #5 as cafe0000cafe0000cafe0000cafe0000cafe0000" "node scripts/verify-deploy.mjs --commit cafe0000cafe0000cafe0000cafe0000cafe0000"
called "ok path" "api repos/owner/repo/statuses/$head -f state=success -f context=gates/review-pr -f description=OK patch ${patch:0:12} main 1234567890ab"
called "ok path" "pr merge 5 --squash --admin --match-head-commit $head"
status_line=$(grep -n 'statuses/' "$MP_LOG" | head -1 | cut -d: -f1); merge_line=$(grep -n 'pr merge' "$MP_LOG" | head -1 | cut -d: -f1)
(( status_line < merge_line )) || fail "ok path" "status was not posted before the merge"
result status=ok cause=none "next=node scripts/verify-deploy.mjs --commit cafe0000cafe0000cafe0000cafe0000cafe0000"

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
expect "main moved during the review refuses and names --regate" 1 "main moved from 1234567890ab" "heavy -- scripts/merge-pr.sh 5 --regate"
result status=fail cause=behind-main "next=heavy -- scripts/merge-pr.sh 5 --regate"
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
called "regate disjoint" "pr merge 5 --squash --admin --match-head-commit $head"
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
expect "non-author refuses" 1 "contributor" "never merged with --admin"
never "non-author" "api repos/"; never "non-author" "pr merge"
[[ ! -s "$tmp/out" ]] || ! grep -q 'review-pr: working' "$tmp/out" || fail "non-author" "the review ran before the author check"

reset
run --dry-run
expect "dry run passes and prints the commands" 0 "dry run, nothing changed" "context=gates/review-pr" "pr merge 5 --squash --admin --match-head-commit $head"
no_writes "dry run"

reset; MP_AUTHOR=contributor run --dry-run
expect "dry run still refuses a non-author" 1 "contributor"

# The rules of AGENTS.md that merge-pr.sh enforces. Past cases: review-pr.sh 248 and 255 were run with no heavy
# (calls.jsonl, session b3bc055a, 2026-10-23T23:32 and 23:44); the others are synthetic, no past violation was recorded.
reset; unset HEAVY_SLOT; run
expect "R90: without heavy it refuses and names the heavy command" 1 "must run through heavy" "heavy -- scripts/merge-pr.sh 5"
result status=fail cause=hygiene "next=heavy -- scripts/merge-pr.sh 5"
no_writes "no heavy"; never "no heavy" "pr view"

reset; echo one >"$tmp/repo/README"; git -C "$tmp/repo" add README; git -C "$tmp/repo" commit -q -m readme; echo more >>"$tmp/repo/README"
run
expect "R68: an edited file in the main checkout refuses" 1 "has edited files" "README"
no_writes "dirty main"

reset; git -C "$tmp/repo" switch -q -c feat/9-x
run
expect "R68: a main checkout on another branch refuses" 1 "is on 'feat/9-x'" "git -C"
git -C "$tmp/repo" switch -q main

reset; MP_FILES="docs/y.md .github/workflows/ci.yml" run
expect "R105: a workflow file refuses" 1 "GitHub Actions workflow files" ".github/workflows/ci.yml"
no_merge "workflow"

reset; rm "$tmp/repo/.git/pre-push-stamps/$head"; echo ok >"$tmp/repo/.git/pre-push-stamps/other"
run
expect "R97: a head with no pre-push stamp refuses and names the push" 1 "was pushed without the pre-push hook" "git push --force-with-lease"
no_merge "no stamp"

reset; echo skip >"$tmp/repo/.git/pre-push-stamps/$head"
run
expect "R98: a SKIP_CHECKS push that the PR does not mention refuses" 1 "pushed with SKIP_CHECKS=1" "gh pr edit 5"
no_merge "skip unsaid"
reset; echo skip >"$tmp/repo/.git/pre-push-stamps/$head"; MP_BODY="SKIP_CHECKS=1: emergency declared by Quan" run
expect "R98: a SKIP_CHECKS push that the PR mentions merges" 0 "merged PR #5"

reset
run --nope
expect "unknown option" 1 "unknown option"

echo "all merge-pr cases passed"
