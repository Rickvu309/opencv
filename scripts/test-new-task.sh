#!/usr/bin/env bash
# test-new-task.sh: argument parsing of scripts/new-task.sh, with a stubbed gh and a throwaway clone.
# No network, no real issue is read or created. Usage: scripts/test-new-task.sh
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE PR_RESULT_ID

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
script=$here/new-task.sh
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir "$tmp/bin"
cat >"$tmp/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$GH_LOG"
case "$1 $2" in
  "auth status") ;;
  "issue view")
    case "$*" in
      *"--json state"*) echo OPEN ;;
      *"--json title"*) echo "Set up the git workflow" ;;
    esac ;;
  "api user") echo tester ;;
  "issue edit") ;;
  "issue create") echo "https://github.com/example/repo/issues/999" ;;
esac
exit 0
STUB
chmod +x "$tmp/bin/gh"
export GH_LOG=$tmp/gh.log PATH="$tmp/bin:$PATH"
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv
result_ok() { node "$here/lib/result-check.mjs" "$PR_RESULT_DIR/opencv-new-task-$1.json" "${@:2}" >/dev/null || fail "result file for $1"; }

# A local clone of this repo's main: no commit identity needed, and origin is only read.
git clone -q --no-hardlinks --branch main "$(cd "$here/.." && pwd)" "$tmp/repo"
cd "$tmp/repo"

fail() { printf 'FAIL %s\n' "$1" >&2; cat "$tmp/err" >&2 || true; exit 1; }

run() {
  : >"$GH_LOG"
  set +e
  "$script" "$@" >"$tmp/out" 2>"$tmp/err"
  code=$?
  set -e
}

run
[[ $code -eq 2 ]] || fail "no args: exit $code, want 2"
grep -q 'new-task.sh' "$tmp/err" "$tmp/out" || fail "no args: usage not printed"
result_ok unknown status=fail cause=hygiene
echo 'ok: no args prints usage (exit 2)'

run chore --no-install
[[ $code -ne 0 ]] || fail "chore --no-install: exit 0"
! grep -q 'issue create' "$GH_LOG" || fail "chore --no-install: called gh issue create"
echo "ok: 'chore --no-install' is refused without creating an issue (exit $code)"

run chore --bogus 777
[[ $code -eq 2 ]] || fail "unknown option: exit $code, want 2"
! grep -q 'issue create' "$GH_LOG" || fail "unknown option: called gh issue create"
echo 'ok: unknown option is an error (exit 2)'
run wrongtype 778
[[ $code -eq 1 ]] || fail "wrong type: exit $code, want 1"
result_ok wrongtype-778 status=fail cause=hygiene
[[ "$(tail -n1 "$tmp/err" "$tmp/out" | grep -c '^RESULT_JSON: ')" -ge 1 ]] || fail "failure: RESULT_JSON line missing"
echo 'ok: a refused run writes status fail'

run chore 777 --no-install -d "scratch task thing"
[[ $code -eq 0 ]] || fail "chore 777 --no-install -d: exit $code"
! grep -q 'issue create' "$GH_LOG" || fail "chore 777: called gh issue create"
[[ -n "$(git branch --list 'chore/777-scratch-task-thing')" ]] || fail "branch chore/777-scratch-task-thing missing"
[[ -d "$tmp/repo.worktrees/777-scratch-task-thing" ]] || fail "worktree 777-scratch-task-thing missing"
echo 'ok: options after positionals reach the worktree step (chore/777-scratch-task-thing)'
result_ok chore-777-scratch-task-thing status=ok cause=none
[[ "$(tail -n1 "$tmp/out")" == "RESULT_JSON: $PR_RESULT_DIR/opencv-new-task-chore-777-scratch-task-thing.json" ]] || fail "RESULT_JSON is not the last line"
grep -q 'scripts/open-pr.sh --draft' "$PR_RESULT_DIR/opencv-new-task-chore-777-scratch-task-thing.json" || fail "next is not the open-pr command"
echo 'ok: success writes status ok with the next command, path printed last'

echo 'ok: new-task.sh argument parsing'
