#!/usr/bin/env bash
# test-new-task.sh: argument parsing of scripts/new-task.sh, with a stubbed gh and a throwaway clone.
# No network, no real issue is read or created. Usage: scripts/test-new-task.sh
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

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
echo 'ok: no args prints usage (exit 2)'

run chore --no-install
[[ $code -ne 0 ]] || fail "chore --no-install: exit 0"
! grep -q 'issue create' "$GH_LOG" || fail "chore --no-install: called gh issue create"
echo "ok: 'chore --no-install' is refused without creating an issue (exit $code)"

run chore --bogus 777
[[ $code -eq 2 ]] || fail "unknown option: exit $code, want 2"
! grep -q 'issue create' "$GH_LOG" || fail "unknown option: called gh issue create"
echo 'ok: unknown option is an error (exit 2)'

run chore 777 --no-install -d "scratch task thing"
[[ $code -eq 0 ]] || fail "chore 777 --no-install -d: exit $code"
! grep -q 'issue create' "$GH_LOG" || fail "chore 777: called gh issue create"
[[ -n "$(git branch --list 'chore/777-scratch-task-thing')" ]] || fail "branch chore/777-scratch-task-thing missing"
[[ -d "$tmp/repo.worktrees/777-scratch-task-thing" ]] || fail "worktree 777-scratch-task-thing missing"
echo 'ok: options after positionals reach the worktree step (chore/777-scratch-task-thing)'

echo 'ok: new-task.sh argument parsing'
