#!/usr/bin/env bash
# Each case runs the hook in a throwaway repo, because the hook reads the staged index.
# pre-push exports GIT_DIR, which would make that repo read this worktree.
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
hook=$(cd "$here/.." && pwd)/.githooks/pre-commit

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

repo=$tmp/repo
header='How to split (follow in order):'

fresh() {
  rm -rf "$repo"
  git init -q -b task "$repo"
  git -C "$repo" config user.name test
  git -C "$repo" config user.email test@example.com
  git -C "$repo" config core.hooksPath /dev/null
  cd "$repo"
}

bytes_of() {
  head -c "$1" /dev/zero | tr '\0' 'a'
}

run() {
  set +e
  "$hook" >"$tmp/out" 2>"$tmp/err"
  code=$?
  set -e
}

fail() {
  printf 'FAIL %s: %s\n' "$1" "$2" >&2
  cat "$tmp/err" >&2
  exit 1
}

expect_pass() {
  local name=$1
  run
  [[ "$code" -eq 0 ]] || fail "$name" "exit $code, want 0"
  [[ ! -s "$tmp/err" ]] || fail "$name" "stderr not empty"
  printf 'ok: %s (exit 0)\n' "$name"
}

expect_block() {
  local name=$1
  shift
  run
  [[ "$code" -eq 1 ]] || fail "$name" "exit $code, want 1"
  grep -F -q -- "$header" "$tmp/err" || fail "$name" "stderr missing split instructions"
  local needle
  for needle in "$@"; do
    grep -F -q -- "$needle" "$tmp/err" || fail "$name" "stderr missing $needle"
  done
  printf 'ok: %s (exit 1)\n' "$name"
}

fresh
echo 'export const a = 1;' >small.ts
git add small.ts
expect_pass 'small text file'

fresh
bytes_of 20000 >edge.ts
git add edge.ts
expect_pass 'exactly 20000 bytes'

fresh
bytes_of 20001 >edge.ts
git add edge.ts
expect_block '20001 bytes' 'edge.ts: 5001 tokens (20001 bytes), limit 5000 tokens (20000 bytes)' 'at least 2 parts'

fresh
bytes_of 100 >grow.ts
git add grow.ts
bytes_of 30000 >grow.ts
expect_pass 'staged small, worktree grown'

fresh
bytes_of 30000 >trim.ts
git add trim.ts
bytes_of 100 >trim.ts
expect_block 'staged big, worktree trimmed' 'trim.ts: 7500 tokens (30000 bytes)' 'at least 2 parts'

fresh
{ head -c 30000 /dev/zero; echo text; } >blob.glb
git add blob.glb
expect_pass 'big binary file'

fresh
bytes_of 30000 >lock.yaml
printf '%s\n' 'lock.yaml linguist-generated' >.gitattributes
git add lock.yaml .gitattributes
expect_pass 'big file marked linguist-generated'

fresh
bytes_of 30000 >lock.yaml
printf '%s\n' 'lock.yaml linguist-generated=false' >.gitattributes
git add lock.yaml .gitattributes
expect_block 'big file with the attribute unset' 'lock.yaml: 7500 tokens'

fresh
bytes_of 30000 >lock.yaml
git add lock.yaml
expect_block 'same big file without the attribute' 'lock.yaml: 7500 tokens'

fresh
bytes_of 30000 >old.ts
git add old.ts
git commit -q -m seed
git rm -q old.ts
expect_pass 'deleting a big committed file'

fresh
bytes_of 30000 >'big file.ts'
git add 'big file.ts'
expect_block 'big path with a space' 'big file.ts: 7500 tokens'

fresh
bytes_of 30000 >one.ts
bytes_of 41000 >two.md
bytes_of 100 >three.ts
git add one.ts two.md three.ts
expect_block 'two big files' 'one.ts: 7500 tokens' 'two.md: 10250 tokens' 'at least 3 parts' '2 staged file(s)'
if grep -F -q 'three.ts' "$tmp/err"; then
  fail 'two big files' 'listed a file under the limit'
fi

fresh
bytes_of 30000 >f.ts
printf '%s\n' 'f.ts -diff' >.gitattributes
git add f.ts .gitattributes
expect_block 'big text file with the -diff attribute' 'f.ts: 7500 tokens'

fresh
bytes_of 30000 >lock.yaml
printf '%s\n' 'lock.yaml linguist-generated' >.gitattributes
git add lock.yaml .gitattributes
: >.gitattributes
expect_pass 'linguist-generated read from the staged .gitattributes'

fresh
bytes_of 30000 >'1:big.ts'
git add -- '1:big.ts'
expect_block 'big path that looks like a stage revision' '1:big.ts: 7500 tokens'

fresh
bytes_of 100 >grow.ts
git add grow.ts
git commit -q -m seed
bytes_of 30000 >grow.ts
git config core.hooksPath "$(dirname "$hook")"
set +e
git commit -q -a -m x >"$tmp/out" 2>"$tmp/err"
code=$?
set -e
[[ "$code" -ne 0 ]] || fail 'git commit -a with a grown file' 'commit succeeded'
grep -F -q 'grow.ts: 7500 tokens' "$tmp/err" || fail 'git commit -a with a grown file' 'stderr missing grow.ts'
printf 'ok: git commit -a with a grown file (exit %s)\n' "$code"

echo 'ok: pre-commit hook'
