#!/usr/bin/env bash
# Each case runs the hook in a throwaway repo, because the hook reads the staged index.
# pre-push exports GIT_DIR, which would make that repo read this worktree.
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/.." && pwd)
hook=$root/.githooks/pre-commit

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
  ln -s "$root/node_modules" "$repo/node_modules"
  # The size cases stage files that are not valid prettier input; the format cases call fresh_format instead.
  echo '*' >"$repo/.prettierignore"
  cd "$repo"
}

fresh_format() {
  fresh
  rm .prettierignore
  echo '{ "semi": false }' >.prettierrc
  printf '%s\n' node_modules >.gitignore
  git add .prettierrc .gitignore
  git commit -q -m seed
}

expect_staged() {
  local name=$1 path=$2 want=$3
  [[ "$(git show ":$path")" == "$want" ]] || fail "$name" "staged $path is not '$want'"
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

fresh_format
printf 'const a  =  1;\n' >a.ts
git add a.ts
expect_pass 'fully staged unformatted file'
expect_staged 'fully staged unformatted file' a.ts 'const a = 1'
[[ "$(cat a.ts)" == 'const a = 1' ]] || fail 'fully staged unformatted file' 'worktree file not formatted'

fresh_format
printf 'const a = 1\n' >a.ts
git add a.ts
expect_pass 'already formatted file'
expect_staged 'already formatted file' a.ts 'const a = 1'

fresh_format
printf 'const a  =  1;\n' >a.ts
git add a.ts
printf 'const a  =  1;\nconst b  =  2;\n' >a.ts
before=$(git show :a.ts)
run
[[ "$code" -eq 1 ]] || fail 'partly staged unformatted file' "exit $code, want 1"
grep -F -q "pnpm exec prettier --write 'a.ts'" "$tmp/err" || fail 'partly staged unformatted file' 'stderr missing the fix command'
grep -F -q "git add -p" "$tmp/err" || fail 'partly staged unformatted file' 'stderr missing git add -p'
! grep -F -q "&& git add 'a.ts'" "$tmp/err" || fail 'partly staged unformatted file' 'stderr advises staging the whole file'
[[ "$(git show :a.ts)" == "$before" ]] || fail 'partly staged unformatted file' 'index changed'
[[ "$(cat a.ts)" == $'const a  =  1;\nconst b  =  2;' ]] || fail 'partly staged unformatted file' 'worktree changed'
printf 'ok: partly staged unformatted file (exit 1)\n'

fresh_format
printf 'const a = 1\n' >a.ts
git add a.ts
printf 'const a  =  1;\nconst b  =  2;\n' >a.ts
expect_pass 'partly staged file with formatted staged content'
[[ "$(cat a.ts)" == $'const a  =  1;\nconst b  =  2;' ]] || fail 'partly staged file with formatted staged content' 'worktree changed'

fresh_format
printf 'const a = 1\n' >gone.ts
git add gone.ts
git commit -q -m add
git rm -q gone.ts
printf 'const b  =  2;\n' >b.ts
git add b.ts
expect_pass 'staged deletion next to an unformatted file'
expect_staged 'staged deletion next to an unformatted file' b.ts 'const b = 2'

fresh_format
printf 'const a = 1\n' >gone.ts
git add gone.ts
git commit -q -m add
rm gone.ts
git add -u
expect_pass 'file deleted from the working tree and the index'

fresh_format
printf 'a\n' >notes.unknown
git add notes.unknown
expect_pass 'file type prettier does not handle'

fresh_format
printf 'const a  =  \n' >bad.ts
git add bad.ts
run
[[ "$code" -eq 0 ]] || fail 'file prettier cannot parse' "exit $code, want 0"
grep -F -q 'prettier could not format' "$tmp/err" || fail 'file prettier cannot parse' 'stderr missing the warning'
printf 'ok: file prettier cannot parse (exit 0, warns)\n'

fresh_format
rm node_modules
printf 'const a  =  1;\n' >a.ts
git add a.ts
run
[[ "$code" -eq 0 ]] || fail 'prettier missing' "exit $code, want 0"
grep -F -q 'node_modules/.bin/prettier is missing' "$tmp/err" || fail 'prettier missing' 'stderr missing the warning'
expect_staged 'prettier missing' a.ts 'const a  =  1;'
printf 'ok: prettier missing (exit 0, warns)\n'

fresh_format
git config core.hooksPath "$(dirname "$hook")"
printf 'const a  =  1;\n' >a.ts
git add a.ts
git commit -q -m x
[[ "$(git show HEAD:a.ts)" == 'const a = 1' ]] || fail 'git commit of an unformatted file' 'commit holds unformatted content'
printf 'ok: git commit of an unformatted file commits it formatted\n'

fresh_format
git config core.hooksPath "$(dirname "$hook")"
printf 'const a = 1\n' >a.ts
printf 'other\n' >other.txt
git add a.ts other.txt
git commit -q -m base
printf 'const a  =  2;\n' >a.ts
printf 'changed\n' >other.txt
git add other.txt
set +e
git commit -q -m 'path commit' a.ts >"$tmp/out" 2>"$tmp/err"
code=$?
set -e
[[ "$code" -eq 1 ]] || fail 'git commit <path> of an unformatted file' "exit $code, want 1"
grep -F -q "pnpm exec prettier --write 'a.ts'" "$tmp/err" || fail 'git commit <path> of an unformatted file' 'stderr missing the fix command'
[[ "$(git log --format=%s -1)" == base ]] || fail 'git commit <path> of an unformatted file' 'a commit was made'
[[ "$(git status --porcelain)" == $' M a.ts\nM  other.txt' ]] || fail 'git commit <path> of an unformatted file' "status is not ' M a.ts' + 'M  other.txt': $(git status --porcelain)"
pnpm_prettier=$root/node_modules/.bin/prettier
"$pnpm_prettier" --write a.ts >/dev/null
git commit -q -m 'path commit' a.ts 2>"$tmp/err" || fail 'git commit <path> after formatting' 'commit refused'
git commit -q -m 'other' 2>"$tmp/err" || fail 'git commit after a path commit' 'next commit refused'
[[ -z "$(git status --porcelain)" ]] || fail 'git commit <path> after formatting' "tree not clean: $(git status --porcelain)"
printf 'ok: git commit <path> refuses an unformatted file, leaves the index alone, passes once formatted\n'

echo 'ok: pre-commit hook'
