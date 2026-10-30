#!/usr/bin/env bash
# The hook is a shim over `ocv-tools hook commit-msg`; the refusals print on stdout, so both streams are read.
# The main-branch case needs its own repo: the hook reads the current HEAD.
# pre-push exports GIT_DIR, which would make that repo read this worktree.
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/.." && pwd)
hook=$root/.githooks/commit-msg
cd "$root"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

run() {
  local file=$1
  set +e
  "$hook" "$file" >"$tmp/err" 2>&1
  code=$?
  set -e
}

expect() {
  local want=$1 name=$2 file=$3 needle=${4:-}
  run "$file"
  if [[ "$code" -ne "$want" ]]; then
    printf 'FAIL %s: exit %s, want %s\n' "$name" "$code" "$want" >&2
    cat "$tmp/err" >&2
    exit 1
  fi
  if [[ -n "$needle" ]] && ! grep -F -q -- "$needle" "$tmp/err"; then
    printf 'FAIL %s: stderr missing %s\n' "$name" "$needle" >&2
    cat "$tmp/err" >&2
    exit 1
  fi
  printf 'ok: %s (exit %s)\n' "$name" "$code"
}

printf '%s\n' 'feat: slide editor foundation (#62)' '' 'Co-authored-by: Cursor <cursoragent@cursor.com>' >"$tmp/cursor"
expect 2 'cursor trailer' "$tmp/cursor" 'NO_AI_ATTRIBUTION'

printf '%s\n' 'chore: reject attribution trailers (#128)' '' '  CO-AUTHORED-BY: Cursor <cursoragent@cursor.com>' >"$tmp/upper"
expect 2 'uppercase trailer' "$tmp/upper" 'NO_AI_ATTRIBUTION'

printf '%s\n' 'chore: reject attribution trailers (#128)' '' 'Generated-with: some-tool' >"$tmp/gen"
expect 2 'generated-with trailer' "$tmp/gen" 'NO_AI_ATTRIBUTION'

printf '%s\n' \
  'chore: reject attribution trailers (#128)' \
  '' \
  'A sentence may mention Co-authored-by and Generated-with without a trailer.' \
  'See the note on Co-authored-by: it is a trailer only at line start.' \
  >"$tmp/prose"
expect 0 'prose mention' "$tmp/prose"
if grep -F -q 'NO_AI_ATTRIBUTION' "$tmp/err"; then
  echo 'FAIL prose mention: rejected a non-trailer line' >&2
  exit 1
fi

printf '%s\n' 'chore: reject attribution trailers (#128)' '# Co-authored-by: Cursor <cursoragent@cursor.com>' >"$tmp/comment"
expect 0 'comment line' "$tmp/comment"

printf '%s\n' '# comment only' '' >"$tmp/empty"
expect 2 'empty subject' "$tmp/empty" 'EMPTY_MESSAGE'

printf '%s\n' 'chore: reject attribution trailers (#128)' >"$tmp/clean"
expect 0 'clean subject' "$tmp/clean"

long=$(printf 'chore: %s (#128)' "$(printf 'x%.0s' {1..80})")
printf '%s\n' "$long" >"$tmp/long"
expect 0 'long subject warns' "$tmp/long"
if ! grep -F -q 'warning:' "$tmp/err"; then
  echo 'FAIL long subject: missing 72-character warning' >&2
  exit 1
fi

main_repo=$tmp/main-repo
git init -q -b main "$main_repo"
ln -s "$root/scripts" "$main_repo/scripts"
printf '%s\n' 'chore: reject attribution trailers (#128)' >"$tmp/main-msg"
(
  cd "$main_repo"
  set +e
  "$hook" "$tmp/main-msg" >"$tmp/err" 2>&1
  code=$?
  set -e
  if [[ "$code" -eq 0 ]]; then
    echo 'FAIL main branch: hook exited 0' >&2
    exit 1
  fi
  if ! grep -F -q 'ON_MAIN: committing on main is not allowed' "$tmp/err"; then
    echo 'FAIL main branch: stderr missing main rejection' >&2
    cat "$tmp/err" >&2
    exit 1
  fi
  printf 'ok: main branch (exit %s)\n' "$code"
)

echo 'ok: commit-msg hook'
