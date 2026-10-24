#!/usr/bin/env bash
# Each case runs scripts/review-pr.sh against a throwaway "main checkout" with a local bare origin and a stub gh,
# so no network is needed. The stub answers the gh calls the script makes from REVIEW_TEST_* variables.
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
      isDraft) echo false ;; labels) echo "" ;; reviews) echo 0 ;;
      *) echo "stub gh: unknown field $5" >&2; exit 1 ;;
    esac ;;
  "issue view") echo OPEN ;;
  "repo view") echo "owner repo" ;;
  "api graphql") echo 0 ;;
  *) echo "stub gh: unexpected: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$tmp/bin/gh"
export PATH=$tmp/bin:$PATH
export REVIEW_TEST_ISSUE=7
export REVIEW_TEST_BRANCH=chore/7-thing
export REVIEW_TEST_TITLE='chore: thing (#7)'

# Throwaway repos run no hooks, like the other script tests; commits use the global identity.
quiet_repo() { git -C "$1" config core.hooksPath /dev/null; }

# origin: main has a check.sh that logs each run; the main checkout clones it.
origin=$tmp/origin.git
work=$tmp/work
git init -q --bare "$origin"
git init -q -b main "$work"
quiet_repo "$work"
cd "$work"
mkdir -p scripts .github
cat >scripts/check.sh <<'CHK'
#!/usr/bin/env bash
echo "ran on $(git rev-parse --short 'HEAD^{tree}')" >>"$REVIEW_TEST_RUNS"
[[ -f FAIL_CHECK ]] && exit 1
exit 0
CHK
chmod +x scripts/check.sh
cp "$here/codeowners-lib.sh" scripts/codeowners-lib.sh
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
runs() { grep -c . "$REVIEW_TEST_RUNS" || true; }

run --no-install
expect "behind main merges and passes" 0 "branch is behind main; the checks run on the merge" "merges cleanly" "lint, typecheck, test passed" "RESULT: OK (patch id"
[[ $(runs) -eq 1 ]] || fail "behind main" "check ran $(runs) times, want 1"
if grep -q "ran on $(git -C "$main_checkout" rev-parse --short 'origin/main^{tree}')" "$REVIEW_TEST_RUNS"; then
  fail "behind main" "check ran on main's tree, not the merge"
fi
patch1=$(grep -oE 'patch id [0-9a-f]+' "$tmp/out" | head -1)

run --no-install
expect "same tree is cached" 0 "(cached; --no-cache reruns)" "RESULT: OK"
[[ $(runs) -eq 1 ]] || fail "cached" "check ran $(runs) times, want 1"

run --no-install --no-cache
expect "--no-cache reruns" 0 "lint, typecheck, test passed"
[[ $(runs) -eq 2 ]] || fail "no-cache" "check ran $(runs) times, want 2"

# A rebase that keeps the same hunks keeps the patch id and lands the same tree, so the cache still hits.
git -C "$work" checkout -q "$REVIEW_TEST_BRANCH"
git -C "$work" rebase -q main
git -C "$work" push -q -f origin "$REVIEW_TEST_BRANCH:refs/pull/1/head"
run --no-install
expect "rebased same patch" 0 "branch contains the latest main" "(cached; --no-cache reruns)" "$patch1"
[[ $(runs) -eq 2 ]] || fail "rebased" "check ran $(runs) times, want 2"

# A checklist FAIL skips the expensive check.
REVIEW_TEST_TITLE='bad title' run --no-install
expect "checklist FAIL skips the check" 1 "skipped the full check" "RESULT: FAIL"
[[ $(runs) -eq 2 ]] || fail "checklist fail" "check ran $(runs) times, want 2"

# A conflicting PR fails without running the check.
git -C "$work" checkout -q main
echo conflict >"$work/other.txt"
git -C "$work" add -A && git -C "$work" commit -q -m "conflicts with the PR"
git -C "$work" push -q origin main
run --no-install
expect "merge conflict" 1 "does not merge cleanly with main; author must rebase" "RESULT: FAIL"
[[ $(runs) -eq 2 ]] || fail "conflict" "check ran $(runs) times, want 2"

# A failing check is not cached.
git -C "$work" checkout -q "$REVIEW_TEST_BRANCH"
git -C "$work" reset -q --hard main
echo change >"$work/other.txt"
touch "$work/FAIL_CHECK"
git -C "$work" add -A && git -C "$work" commit -q -m "break the check"
git -C "$work" push -q -f origin "$REVIEW_TEST_BRANCH:refs/pull/1/head"
run --no-install
expect "failing check" 1 "scripts/check.sh failed" "RESULT: FAIL"
before=$(runs)
run --no-install
expect "failing check is not cached" 1 "scripts/check.sh failed"
[[ $(runs) -eq $((before + 1)) ]] || fail "not cached" "check ran $(runs) times, want $((before + 1))"

if git -C "$main_checkout" worktree list | grep -q review-pr-; then fail "cleanup" "review worktree left behind"; fi
echo "all review-pr tests passed"
