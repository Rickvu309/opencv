#!/usr/bin/env bash
# Each case runs scripts/review-pr.sh against a throwaway "main checkout" with a local bare origin and stub gh and pnpm,
# so no network is needed. The stub gh answers the calls the script makes from REVIEW_TEST_* variables.
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE CHECK_DRY_RUN CHECK_BASE_REF

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
script=$here/review-pr.sh

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/bin"
cat >"$tmp/bin/gh" <<'STUB'
#!/usr/bin/env bash
# Answers: gh auth status; gh pr view N --json F --jq Q; gh issue view N --json state --jq .state; gh repo view; gh api graphql.
case "$1 $2" in
  "auth status") exit 0 ;;
  "pr view")
    case "$5" in
      state) echo OPEN ;; baseRefName) echo main ;; headRefName) echo "${REVIEW_TEST_BRANCH}" ;;
      title) echo "${REVIEW_TEST_TITLE}" ;; body) echo "Closes #${REVIEW_TEST_ISSUE}" ;;
      isDraft) echo false ;; labels) echo "" ;; reviews) echo "${REVIEW_TEST_CHANGES:-0}" ;;
      *) echo "stub gh: unknown field $5" >&2; exit 1 ;;
    esac ;;
  "issue view") echo OPEN ;;
  "repo view") echo "owner repo" ;;
  "api graphql") echo 0 ;;
  *) echo "stub gh: unexpected: $*" >&2; exit 1 ;;
esac
STUB
# pnpm install: creates node_modules, then exits with REVIEW_TEST_PNPM_EXIT (default 0). The two verify checkers print
# the file REVIEW_TEST_<APP_UI|LANDING>_OUT and exit with REVIEW_TEST_<APP_UI|LANDING>_EXIT; each call is logged with its env.
cat >"$tmp/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
mkdir -p node_modules
if [[ "$*" == "--filter api... run build" ]]; then
  exit "${REVIEW_TEST_API_BUILD_EXIT:-0}"
fi
case "$*" in
  "--filter web verify:app-ui")
    echo "app-ui PORT=$PORT VERIFY_TIER=$VERIFY_TIER" >>"$REVIEW_TEST_VERIFY_CALLS"
    cat "$REVIEW_TEST_APP_UI_OUT"; exit "${REVIEW_TEST_APP_UI_EXIT:-0}" ;;
  "--filter web verify:landing")
    echo "landing PORT=$PORT VERIFY_TIER=$VERIFY_TIER" >>"$REVIEW_TEST_VERIFY_CALLS"
    cat "$REVIEW_TEST_LANDING_OUT"; exit "${REVIEW_TEST_LANDING_EXIT:-0}" ;;
esac
exit "${REVIEW_TEST_PNPM_EXIT:-0}"
STUB
printf '#!/usr/bin/env bash\nexit 0\n' >"$tmp/bin/chrome"
chmod +x "$tmp/bin/gh" "$tmp/bin/pnpm" "$tmp/bin/chrome"
export CHROME_BIN=$tmp/bin/chrome
export PATH=$tmp/bin:$PATH
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv HEAVY_SLOT=1
export REVIEW_TEST_ISSUE=7
export REVIEW_TEST_BRANCH=chore/7-thing
export REVIEW_TEST_TITLE='chore: thing (#7)'

# Throwaway repos run no hooks unless a case turns them on; commits use the global identity.
quiet_repo() { git -C "$1" config core.hooksPath /dev/null; }

# origin: main has a check.sh that logs the tree it ran on; the main checkout clones it. Writing the tree touches the
# index, and PR code runs with hooks on during the check anyway, so the stub keeps hooks off to isolate the merge step.
origin=$tmp/origin.git
work=$tmp/work
git init -q --bare -b main "$origin"
git init -q -b main "$work"
quiet_repo "$work"
cd "$work"
mkdir -p scripts .github
cat >scripts/check.sh <<'CHK'
#!/usr/bin/env bash
echo "ran on $(git -c core.hooksPath=/dev/null write-tree)" >>"$REVIEW_TEST_RUNS"
echo "retry=${CHECK_RETRY_FAILED_TESTS-unset}" >>"$REVIEW_TEST_RUNS.env"
[[ -f FAIL_CHECK ]] && exit 1
exit 0
CHK
chmod +x scripts/check.sh
cp "$here/codeowners-lib.sh" scripts/codeowners-lib.sh
mkdir -p .claude/skills/verify-app-ui
echo '[{"id":"20","issue":553,"since":"2026-10-29","note":"contrast"}]' >.claude/skills/verify-app-ui/known-findings.json
echo '* @owner' >.github/CODEOWNERS
echo base >file.txt
git add -A && git commit -q -m "base"
git remote add origin "$origin"
git push -q origin main

# PR branch from the first main commit.
git checkout -q -b "$REVIEW_TEST_BRANCH"
echo change >other.txt
git add -A && git commit -q -m "change"
git push -q origin "$REVIEW_TEST_BRANCH:refs/pull/1/head"

# main moves ahead, so the PR is behind main.
git checkout -q main
echo more >file.txt
git commit -q -am "main moves"
git push -q origin main

main_checkout=$tmp/repo
git clone -q "$origin" "$main_checkout"
quiet_repo "$main_checkout"
cp "$script" "$main_checkout/scripts/review-pr.sh"
mkdir -p "$main_checkout/scripts/lib" && cp "$here/lib/result.sh" "$here/lib/conflict-report.sh" "$here/lib/rules.sh" "$here/lib/verify-tier.sh" "$here/lib/verify-gate.mjs" "$main_checkout/scripts/lib/"
export REVIEW_TEST_RUNS=$tmp/runs
: >"$REVIEW_TEST_RUNS"

run() {
  set +e
  (cd "$main_checkout" && scripts/review-pr.sh 1 "$@") >"$tmp/out" 2>"$tmp/err"
  code=$?
  set -e
}
fail() { printf 'FAIL %s: %s\n' "$1" "$2" >&2; cat "$tmp/out" "$tmp/err" >&2; exit 1; }
expect() {
  local name=$1 want=$2; shift 2
  [[ "$code" -eq "$want" ]] || fail "$name" "exit $code, want $want"
  local needle
  for needle in "$@"; do grep -F -q -- "$needle" "$tmp/out" || fail "$name" "output missing: $needle"; done
  printf 'ok: %s (exit %s)\n' "$name" "$code"
}
# The result file of the last run must pass the schema check and these key=value expectations; its path is the last line.
result() {
  local f=$PR_RESULT_DIR/opencv-review-pr-1.json
  node "$here/lib/result-check.mjs" "$f" script=review-pr id=1 "$@" >/dev/null || fail "result file" "$(cat "$f" 2>/dev/null)"
  [[ "$(tail -n1 "$tmp/out")" == "RESULT_JSON: $f" ]] || fail "result file" "RESULT_JSON is not the last line"
}
absent() { grep -F -q -- "$2" "$tmp/out" && fail "$1" "output has: $2"; return 0; }
runs() { grep -c . "$REVIEW_TEST_RUNS" || true; }
want_runs() { [[ $(runs) -eq "$2" ]] || fail "$1" "check ran $(runs) times, want $2"; }
patch_id() { grep -oE 'patch id [0-9a-f]+' "$tmp/out" | head -1; }
# The tree a squash merge of the PR into main lands, computed independently of the script.
merge_tree() { git -C "$work" merge-tree --write-tree main "$REVIEW_TEST_BRANCH"; }
pr_commit() { git -C "$work" add -A && git -C "$work" commit -q -m "$1" && git -C "$work" push -q -f origin "$REVIEW_TEST_BRANCH:refs/pull/1/head"; }
main_commit() { git -C "$work" checkout -q main && git -C "$work" add -A && git -C "$work" commit -q -m "$1" && git -C "$work" push -q origin main && git -C "$work" checkout -q "$REVIEW_TEST_BRANCH"; }

CHECK_RETRY_FAILED_TESTS=1 run --no-install
expect "behind main merges and passes" 0 "branch is behind main; the checks run on the merge" "merges cleanly" "lint, typecheck, test passed" "running pnpm --filter web build" "web build passed" "RESULT: OK (patch id" "--match-head-commit $(git -C "$work" rev-parse "$REVIEW_TEST_BRANCH")"
want_runs "behind main" 1
[[ "$(cat "$REVIEW_TEST_RUNS.env")" == "retry=unset" ]] || fail "gate" "the gate's check ran with CHECK_RETRY_FAILED_TESTS set: it must never retry"
result status=ok cause=none next="heavy -- scripts/merge-pr.sh 1"
grep -q "patch id" "$PR_RESULT_DIR/opencv-review-pr-1.json" || fail "ok result" "detail has no patch id"
grep -q "ran on $(merge_tree)" "$REVIEW_TEST_RUNS" || fail "behind main" "check did not run on the merge tree $(merge_tree)"
patch1=$(patch_id)
GIT_CONFIG_PARAMETERS="'color.ui=always' 'diff.noprefix=true'" run --no-install
expect "patch id ignores color and prefix config" 0 "$patch1"

# R90: review-pr.sh 248 and 255 were run without heavy (calls.jsonl, session b3bc055a, 2026-10-23T23:32 and 23:44).
HEAVY_SLOT= run --no-install
[[ $code -eq 1 ]] && grep -q 'must run through heavy' "$tmp/err" && grep -qx 'Fix: heavy -- scripts/review-pr.sh 1 --no-install' "$tmp/err" || fail "R90" "no heavy was not refused with the fix"
result status=fail cause=hygiene "next=heavy -- scripts/review-pr.sh 1 --no-install"
echo "ok: R90 without heavy it refuses and names the heavy command"
want_runs "no heavy" 1
run --no-install
expect "same tree is cached" 0 "(cached; --no-cache reruns)" "RESULT: OK"
want_runs "cached" 1

run --no-install --no-cache
expect "--no-cache reruns" 0 "lint, typecheck, test passed"
want_runs "no-cache" 2

# A rebase that keeps the diff text keeps the patch id and lands the same tree, so the cache still hits.
git -C "$work" checkout -q "$REVIEW_TEST_BRANCH"
git -C "$work" rebase -q main
git -C "$work" push -q -f origin "$REVIEW_TEST_BRANCH:refs/pull/1/head"
run --no-install
expect "rebased same patch" 0 "branch contains the latest main" "(cached; --no-cache reruns)" "$patch1"
want_runs "rebased" 2

# main moves again without touching the PR: same patch id, new merge tree, so the check runs once more.
echo third >"$work/file.txt"
main_commit "main moves again"
run --no-install
expect "fresh main keeps the patch id" 0 "branch is behind main" "lint, typecheck, test passed" "$patch1"
want_runs "fresh main" 3

# A change in whitespace only is a different patch. A requested change is a soft FAIL: the checks still run and are
# cached for the rerun after it clears.
printf 'change \n' >"$work/other.txt"
pr_commit "trailing space"
REVIEW_TEST_CHANGES=1 run --no-install
expect "requested changes still runs the check" 1 "a reviewer has requested changes" "lint, typecheck, test passed" "RESULT: FAIL"
result status=fail cause=hygiene
absent "soft fail" "skipped the full check"
absent "soft fail" "(cached;"
[[ "$(patch_id)" != "$patch1" ]] || fail "whitespace" "patch id unchanged: $patch1"
want_runs "soft fail" 4
run --no-install
expect "cleared request hits the cache" 0 "(cached; --no-cache reruns)"
want_runs "cleared" 4

# A checklist FAIL that needs a new push skips the expensive check, but the merge still runs.
REVIEW_TEST_TITLE='bad title' run --no-install
expect "checklist FAIL skips the check" 1 "merges cleanly" "skipped the full check" "RESULT: FAIL"
absent "checklist fail" "web build passed"
result status=fail cause=hygiene
want_runs "checklist fail" 4

# The PR's own hooks take no part in the merge or the checkout: merge-tree writes no ref or index, and the checkout runs with hooks off.
mkdir -p "$work/.githooks"
printf '#!/usr/bin/env bash\necho "PR_HOOK_RAN $0" >&2\nexit 1\n' >"$work/.githooks/commit-msg"
printf '#!/usr/bin/env bash\necho "PR_HOOK_RAN $0" >&2\nexit 1\n' >"$work/.githooks/pre-merge-commit"
printf '#!/usr/bin/env bash\necho "PR_HOOK_RAN $0" >&2\nexit 1\n' >"$work/.githooks/reference-transaction"
printf '#!/usr/bin/env bash\necho "PR_HOOK_RAN $0" >&2\nexit 1\n' >"$work/.githooks/post-index-change"
chmod +x "$work/.githooks/"*
pr_commit "add failing hooks"
git -C "$main_checkout" config core.hooksPath .githooks
run --no-install
expect "PR hooks do not run during the merge" 0 "merges cleanly" "RESULT: OK"
grep -q PR_HOOK_RAN "$tmp/err" && fail "hooks" "a PR hook ran"
quiet_repo "$main_checkout"
want_runs "hooks" 5

# A failed install is a FAIL and is never cached, even though the check itself passed.
echo '{}' >"$work/package.json"; : >"$work/pnpm-lock.yaml"
pr_commit "add a package.json"
REVIEW_TEST_PNPM_EXIT=1 run
expect "failed install fails" 1 "dependency install failed (pnpm install --frozen-lockfile)" "lint, typecheck, test passed" "RESULT: FAIL"
result status=fail cause=env
want_runs "failed install" 6
REVIEW_TEST_PNPM_EXIT=1 run
expect "failed install is not cached" 1 "dependency install failed" "RESULT: FAIL"
want_runs "failed install rerun" 7
run
expect "install passes" 0 "lint, typecheck, test passed" "web build passed" "RESULT: OK"
want_runs "install passes" 8
run
expect "install pass is cached" 0 "(cached; --no-cache reruns)"
want_runs "install cached" 8

echo api-build >"$work/api-build.txt"
pr_commit "check the API production build"
REVIEW_TEST_API_BUILD_EXIT=1 run
expect "failed API build fails" 1 "api build failed" "RESULT: FAIL"
result status=fail cause=build
want_runs "failed API build" 9
REVIEW_TEST_API_BUILD_EXIT=1 run
expect "failed API build is not cached" 1 "api build failed" "RESULT: FAIL"
want_runs "failed API build rerun" 10
run
expect "API build passes" 0 "api build passed" "RESULT: OK"
want_runs "API build passes" 11
run
expect "API build pass is cached" 0 "api build passed for this exact tree (cached; --no-cache reruns)"
want_runs "API build cached" 11

# A PR cannot weaken the gate: main's check.sh runs, not the PR's copy.
printf '#!/usr/bin/env bash\nexit 0\n' >"$work/scripts/check.sh"
touch "$work/FAIL_CHECK"
pr_commit "replace check.sh and break the check"
run --no-install
expect "main's check.sh runs, not the PR's" 1 "scripts/check.sh failed" "RESULT: FAIL"
result status=fail cause=test
want_runs "gate" 12
run --no-install
expect "failing check is not cached" 1 "scripts/check.sh failed"
want_runs "not cached" 13

# A PR whose net diff is empty gets no patch id and still passes.
git -C "$work" reset -q --hard main
echo noop >"$work/noop.txt" && git -C "$work" add -A && git -C "$work" commit -q -m "add"
git -C "$work" rm -q noop.txt && git -C "$work" commit -q -m "remove"
git -C "$work" push -q -f origin "$REVIEW_TEST_BRANCH:refs/pull/1/head"
run --no-install
expect "empty net diff" 0 "patch id none" "RESULT: OK"

# A conflicting PR fails without running the check and names the file.
echo change >"$work/other.txt"; touch "$work/FAIL_CHECK"; git -C "$work" add -A && git -C "$work" commit -q -m "change again" && git -C "$work" push -q -f origin "$REVIEW_TEST_BRANCH:refs/pull/1/head"
git -C "$work" checkout -q main
echo conflict-main >"$work/other.txt"
git -C "$work" add -A && git -C "$work" commit -q -m "feat: change other.txt, which the PR also changes (#41)" && git -C "$work" push -q origin main
conflict_sha=$(git -C "$work" rev-parse HEAD)
run --no-install
expect "merge conflict" 1 "does not merge cleanly with main; author must rebase" "resolve: other.txt" "RESULT: FAIL"
result status=fail cause=merge-conflict 'files=["other.txt"]' 'next=git fetch origin && git rebase origin/main' "blockedBy={\"pr\":41,\"commit\":\"$conflict_sha\",\"files\":[\"other.txt\"]}"
expect "conflict report names the commit on main" 1 "other.txt: changed on main in ${conflict_sha:0:9} \"feat: change other.txt, which the PR also changes (#41)\" (PR #41)" "git fetch origin && git rebase origin/main && heavy -- git push --force-with-lease"
want_runs "conflict" 14

# A conflict on a non-ASCII path is reported under its real name, not as git's quoted octal form.
git -C "$work" checkout -q "$REVIEW_TEST_BRANCH"
echo pr-side >"$work/café.txt"; git -C "$work" add -A && git -C "$work" commit -q -m "add the accent" && git -C "$work" push -q -f origin "$REVIEW_TEST_BRANCH:refs/pull/1/head"
git -C "$work" checkout -q main
echo main-side >"$work/café.txt"; echo conflict-main-again >"$work/other.txt"
git -C "$work" add -A && git -C "$work" commit -q -m "feat: accent and other.txt (#42)" && git -C "$work" push -q origin main
accent_sha=$(git -C "$work" rev-parse HEAD)
run --no-install
expect "non-ASCII conflict" 1 "resolve: café.txt other.txt" "café.txt: changed on main in ${accent_sha:0:9} \"feat: accent and other.txt (#42)\" (PR #42)" "RESULT: FAIL"
absent "non-ASCII conflict" '\303'
result status=fail cause=merge-conflict 'files=["café.txt","other.txt"]' "blockedBy={\"pr\":42,\"commit\":\"$accent_sha\",\"files\":[\"café.txt\",\"other.txt\"]}"
want_runs "non-ASCII conflict" 14

# The invariant verify tier. A PR that touches apps/web runs both checkers at VERIFY_TIER=invariant and is classified
# against main's known-findings.json (here: app-ui lists 20; landing has no file, so an empty list).
export REVIEW_TEST_VERIFY_CALLS=$tmp/verify-calls
passing="$tmp/pass.txt"
printf 'PASS 01 [invariant] a: ok | rule: r\nPASS 20 [invariant] b: ok | rule: r\n2 PASS, 0 FAIL, 0 STALE [tier invariant]\n' >"$passing"
known_fail="$tmp/known-fail.txt"
printf 'PASS 01 [invariant] a: ok | rule: r\nFAIL 20 [invariant] text-contrast: 8 of 455 text nodes fail | rule: r\n1 PASS, 1 FAIL, 0 STALE: 20 [tier invariant]\n' >"$known_fail"
export REVIEW_TEST_APP_UI_OUT=$known_fail REVIEW_TEST_LANDING_OUT=$passing
calls() { grep -c . "$REVIEW_TEST_VERIFY_CALLS" || true; }
want_calls() { [[ $(calls) -eq "$2" ]] || fail "$1" "verify checkers ran $(calls) times, want $2"; }
verify_result() { local f=$PR_RESULT_DIR/opencv-review-pr-1.json; grep -qF -- "$1" "$f" || fail "result file" "no '$1' in $(cat "$f")"; }

git -C "$work" checkout -q "$REVIEW_TEST_BRANCH"
git -C "$work" reset -q --hard main
mkdir -p "$work/docs" && echo notes >"$work/docs/notes.md"
pr_commit "docs only"
: >"$REVIEW_TEST_VERIFY_CALLS"
run --no-install
expect "a docs-only PR skips the verify tier" 0 "the verify tier is skipped" "RESULT: OK"
want_calls "docs only" 0

mkdir -p "$work/apps/web" && echo ui >"$work/apps/web/page.txt"
pr_commit "touch the web app"
run --no-install
expect "a known FAIL passes" 0 "verify-app-ui invariant tier: pass" "verify-landing invariant tier: pass" "RESULT: OK"
want_calls "known fail" 2
grep -qE '^app-ui PORT=445[0-8] VERIFY_TIER=invariant$' "$REVIEW_TEST_VERIFY_CALLS" || fail "ports" "app-ui call: $(cat "$REVIEW_TEST_VERIFY_CALLS")"
grep -qE '^landing PORT=[0-9]+ VERIFY_TIER=invariant$' "$REVIEW_TEST_VERIFY_CALLS" || fail "ports" "landing call: $(cat "$REVIEW_TEST_VERIFY_CALLS")"
[[ -f $PR_RESULT_DIR/review-pr-1-verify-app-ui.log ]] || fail "logs" "no app-ui log under the result directory"
run --no-install
expect "a passing verify tier is cached" 0 "verify invariant tier passed for this exact tree" "RESULT: OK"
want_calls "verify cached" 2
run --no-install --no-cache
expect "--no-cache reruns the verify tier" 0 "verify-app-ui invariant tier: pass"
want_calls "verify no-cache" 4

echo ui3 >"$work/apps/web/page.txt"
pr_commit "a new tree for the failing cases, so no cached pass answers them"
printf 'PASS 01 [invariant] a: ok | rule: r\nFAIL 20 [invariant] text-contrast: known | rule: r\nFAIL 21 [invariant] alerts-have-role: %s | rule: r\n1 PASS, 1 FAIL, 0 STALE: 21 [tier invariant]\n' "$(printf 'z%.0s' {1..200})" >"$tmp/new-fail.txt"
REVIEW_TEST_APP_UI_OUT=$tmp/new-fail.txt REVIEW_TEST_APP_UI_EXIT=1 run --no-install
expect "a new FAIL fails the review" 1 "NEW FAIL 21 alerts-have-role: zzzz" "review-pr-1-verify-app-ui.log" "RESULT: FAIL"
absent "new fail" "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
result status=fail cause=test
verify_result "review-pr-1-verify-app-ui.log"
REVIEW_TEST_APP_UI_OUT=$passing run --no-install
expect "a fixed finding that is still listed fails" 1 "FIXED, still listed in known-findings.json 20 b" "RESULT: FAIL"

printf 'PASS 01 [invariant] a: ok | rule: r\nSTALE 04 [invariant] stub: not judged: coach turn | rule: r\n1 PASS, 0 FAIL, 1 STALE: 04 [tier invariant]\n' >"$tmp/stale.txt"
REVIEW_TEST_APP_UI_OUT=$tmp/stale.txt REVIEW_TEST_APP_UI_EXIT=3 run --no-install
expect "a STALE fails the review" 1 "STALE 04 stub: not judged: coach turn" "RESULT: FAIL"

printf 'PASS 01 [invariant] a: ok | rule: r\nFAIL 20 [invariant] text-contrast: still bad | rule: r\nFAIL 33 [invariant] landing-only: bad | rule: r\n' >"$tmp/landing-fail.txt"
REVIEW_TEST_LANDING_OUT=$tmp/landing-fail.txt REVIEW_TEST_LANDING_EXIT=1 run --no-install
expect "the landing list is its own (20 is not listed there)" 1 "verify-app-ui invariant tier: pass" "verify-landing invariant tier: NEW FAIL 20" "verify-landing invariant tier: NEW FAIL 33"

printf 'verify-app-ui error: chrome did not start\n' >"$tmp/error.txt"
REVIEW_TEST_APP_UI_OUT=$tmp/error.txt REVIEW_TEST_APP_UI_EXIT=2 run --no-install
expect "a checker exit 2 fails the review" 1 "ERROR -: checker exited 2: verify-app-ui error: chrome did not start" "RESULT: FAIL"

before=$(calls)
CHROME_BIN= HOME=$tmp/nohome run --no-install
expect "a missing browser fails with the install hint" 1 "verify tier needs a browser" "playwright install chromium" "RESULT: FAIL"
want_calls "no browser" "$before"

before_rerun=$(calls)
run --no-install
expect "a failed verify tier is not cached" 0 "verify-app-ui invariant tier: pass" "RESULT: OK"
absent "failed verify" "(cached;"
want_calls "failed verify rerun" "$((before_rerun + 2))"

# Main's list, not the PR's, decides: a PR that lists its own new FAIL still fails, and editing a list or checker is noted.
printf '[{"id":"21","issue":9,"since":"2026-10-29","note":"own"}]\n' >"$work/.claude/skills/verify-app-ui/known-findings.json"
pr_commit "list my own FAIL"
REVIEW_TEST_APP_UI_OUT=$tmp/new-fail.txt REVIEW_TEST_APP_UI_EXIT=1 run --no-install
expect "a PR cannot list its own FAIL" 1 "NEW FAIL 21" "so the review must read that diff: .claude/skills/verify-app-ui/known-findings.json" "RESULT: FAIL"

# A new known-findings.json on main reruns a verify tier that was cached.
git -C "$work" reset -q --hard main
before=$(calls)
mkdir -p "$work/apps/web" && echo ui2 >"$work/apps/web/page.txt"
pr_commit "touch the web app again"
run --no-install
want_calls "reset" "$((before + 2))"
run --no-install
expect "cached before main's list changes" 0 "verify invariant tier passed for this exact tree"
git -C "$work" checkout -q main
echo '[{"id":"20","issue":553,"since":"2026-10-29","note":"reworded"}]' >"$work/.claude/skills/verify-app-ui/known-findings.json"
git -C "$work" add -A && git -C "$work" commit -q -m "main edits the list" && git -C "$work" push -q origin main
git -C "$work" checkout -q "$REVIEW_TEST_BRANCH"
run --no-install
expect "a changed list on main reruns the verify tier" 0 "verify-app-ui invariant tier: pass" "RESULT: OK"
want_calls "list changed" "$((before + 4))"

if git -C "$main_checkout" worktree list | grep -q review-pr-; then fail "cleanup" "review worktree left behind"; fi
echo "all review-pr tests passed"
