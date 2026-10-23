#!/usr/bin/env bash
# test-codeowners.sh: table-driven test of which changed files review-pr.sh treats as env/secrets paths.
# It reads the real .github/CODEOWNERS, so a new rule that makes every file look protected fails here.
# It also builds a throwaway git repo to check the changed-file list (renames, more than 100 files).
# Usage: scripts/test-codeowners.sh     Exits 1 and lists the failing cases if any disagrees.
set -euo pipefail
# A git hook (pre-push) exports GIT_DIR in a linked worktree. Without this, the scratch repo below would write to
# the pusher's real index and stage the deletion of every tracked file.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$here/codeowners-lib.sh"
owners=$(cat "$here/../.github/CODEOWNERS")

PROTECTED=(
  '.env'
  '.env.example'
  'apps/server/.env.production'
  'apps/server/src/env.ts'
  'packages/core/src/env/index.ts'
  'config/envs.mjs'
  'apps/web/src/secrets.ts'
  'packages/core/src/my-secret-store.ts'
  '.github/CODEOWNERS'
)
ROUTINE=(
  'apps/web/src/routes/slide/slide-frame.tsx'
  'apps/server/src/environment.ts'
  'README.md'
  'package.json'
  'scripts/review-pr.sh'
  '.github/pull_request_template.md'
  'docs/git-workflow/review-and-approval.md'
)

fail=()
for f in "${PROTECTED[@]}"; do
  [[ -n "$(codeowners_protected "$owners" "$f")" ]] || fail+=("should be protected: $f")
done
for f in "${ROUTINE[@]}"; do
  [[ -z "$(codeowners_protected "$owners" "$f")" ]] || fail+=("should be routine: $f")
done
[[ -z "$(codeowners_protected '* @owner' 'apps/web/anything.ts')" ]] || fail+=("a catch-all alone must not protect a file")
[[ -z "$(codeowners_protected '** @owner' 'apps/web/anything.ts')" ]] || fail+=("a ** catch-all alone must not protect a file")

# The file list comes from git, so a rename away from a protected path and a PR over 100 files are both seen.
# It diffs two trees from `git write-tree`, so the test needs no commit and no author identity.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
mkdir -p "$tmp/apps/server/src" "$tmp/docs" "$tmp/zzz"
echo a >"$tmp/apps/server/src/env.ts"
git -C "$tmp" add -A
base=$(git -C "$tmp" write-tree)
git -C "$tmp" mv apps/server/src/env.ts apps/server/src/config.ts
renamed_tree=$(git -C "$tmp" write-tree)
renamed=$(pr_changed_files "$tmp" "$base" "$renamed_tree")
[[ -n "$(codeowners_protected "$owners" "$renamed")" ]] || fail+=("a rename away from a protected path must stay protected")
mkdir -p "$tmp/config"
printf 'x' >"$tmp/config/$(printf 'env\tx.mjs')"
for i in $(seq 1 150); do echo "$i" >"$tmp/docs/file-$i.md"; done
echo secret >"$tmp/zzz/.env"
git -C "$tmp" add -A
big_tree=$(git -C "$tmp" write-tree)
big=$(pr_changed_files "$tmp" "$base" "$big_tree")
[[ $(wc -l <<<"$big") -ge 151 ]] || fail+=("the file list must not be capped at 100 files")
big_protected=$(codeowners_protected "$owners" "$big")
grep -qx 'zzz/.env' <<<"$big_protected" || fail+=("an env file after the first 100 files must be protected")
grep -qx "config/$(printf 'env\tx.mjs')" <<<"$big_protected" || fail+=("a protected path with a tab in its name must stay protected")

if ((${#fail[@]})); then
  printf 'FAIL %s\n' "${fail[@]}" >&2
  exit 1
fi
echo "ok: ${#PROTECTED[@]} protected and ${#ROUTINE[@]} routine paths classified, catch-all ignored, renames and 150+ files seen"
