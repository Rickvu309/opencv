#!/usr/bin/env bash
# test-rules.sh: the pre-push stamps (R97, R98) that scripts/open-pr.sh and scripts/merge-pr.sh read, and scripts/lib/rules.sh.
# The checks inside open-pr.sh, merge-pr.sh, review-pr.sh and new-task.sh are asserted in their own tests
# (open-pr.test.mjs, test-merge-pr.sh, test-review-pr.sh, test-new-task.sh). Usage: scripts/test-rules.sh
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE CHECK_DRY_RUN SKIP_CHECKS PR_RESULT_ID

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HOME/tmp"
tmp=$(mktemp -d -p "$HOME/tmp")
trap 'rm -rf "$tmp"' EXIT
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv
fail() { printf 'FAIL %s\n' "$1" >&2; cat "$tmp/out" "$tmp/err" >&2 2>/dev/null || true; exit 1; }

repo=$tmp/repo
mkdir -p "$repo/scripts" "$repo/.githooks"
git init -q -b main "$repo" && git -C "$repo" config core.hooksPath /dev/null
cp "$here/../.githooks/pre-push" "$repo/.githooks/pre-push"
printf '#!/usr/bin/env bash\n[[ ! -f "$PWD/FAIL_CHECK" ]]\n' >"$repo/scripts/check.sh"; chmod +x "$repo/scripts/check.sh" "$repo/.githooks/pre-push"
git -C "$repo" add -A && git -C "$repo" commit -q -m base
sha=$(git -C "$repo" rev-parse HEAD)
push() {  # push [VAR=value ...]: the hook as git runs it for a push of $sha to a task branch
  set +e
  (cd "$repo" && echo "refs/heads/feat/9-a-b $sha refs/heads/feat/9-a-b 0000000000000000000000000000000000000000" | env "$@" .githooks/pre-push origin url) >"$tmp/out" 2>"$tmp/err"
  code=$?; set -e
}
stamp=$repo/.git/pre-push-stamps/$sha

push X=1
[[ $code -eq 0 && "$(cat "$stamp")" == ok ]] || fail "a passing push is stamped ok"
echo "ok: a push through the hook leaves an ok stamp for the pushed sha"

rm -rf "$repo/.git/pre-push-stamps"; touch "$repo/FAIL_CHECK"
push X=1
[[ $code -ne 0 && ! -e "$stamp" ]] || fail "a push whose check failed must not be stamped"
rm "$repo/FAIL_CHECK"
echo "ok: a push whose quick check failed is not stamped"

push SKIP_CHECKS=1
[[ $code -eq 0 && "$(cat "$stamp")" == skip ]] || fail "a SKIP_CHECKS push is stamped skip"
echo "ok: a SKIP_CHECKS=1 push is stamped skip"

# rule_pushed_through_hook: a clone with stamps and a sha that has none is a push without the hook.
printf '#!/usr/bin/env bash\nset -euo pipefail\n. "%s/lib/result.sh"\n. "%s/lib/rules.sh"\nresult_begin merge-pr 5\ncd "%s"\nrule_pushed_through_hook "$1"\nresult_ok fine\n' "$here" "$here" "$repo" >"$tmp/r.sh"
set +e; bash "$tmp/r.sh" "$sha" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
[[ $code -eq 0 ]] || fail "a stamped sha passes"
set +e; bash "$tmp/r.sh" "0123456789abcdef0123456789abcdef01234567" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
[[ $code -eq 1 ]] && grep -q 'Fix: cd <the worktree of this branch> && git fetch origin main && git rebase origin/main && git commit --amend --no-edit && heavy -- git push --force-with-lease' "$tmp/err" || fail "an unstamped sha is refused with the fix"
rm -rf "$repo/.git/pre-push-stamps"
set +e; bash "$tmp/r.sh" "0123456789abcdef0123456789abcdef01234567" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
[[ $code -eq 0 ]] || fail "a clone whose hook never stamped is not blocked"
echo "ok: an unstamped sha is refused with the push command; a clone with no stamps yet is not blocked"

# rule_skip_said: the PR template carries its own SKIP_CHECKS line, so only "emergency declared by <name>" counts.
printf '#!/usr/bin/env bash\nset -euo pipefail\n. "%s/lib/result.sh"\n. "%s/lib/rules.sh"\nresult_begin merge-pr 5\ncd "%s"\nrule_skip_said "$1" 5 "$2"\nresult_ok fine\n' "$here" "$here" "$repo" >"$tmp/s.sh"
skip() { set +e; bash "$tmp/s.sh" "$sha" "$1" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e; }
mkdir -p "$(dirname "$stamp")"; echo skip >"$stamp"
skip "$(cat "$here/../.github/pull_request_template.md")"
[[ $code -eq 1 ]] && grep -q 'Fix: gh api -X PATCH repos/{owner}/{repo}/pulls/5 -f body=' "$tmp/err" || fail "the template's SKIP_CHECKS line must not count as a declaration"
skip "emergency declared by <who>"; [[ $code -eq 1 ]] || fail "a placeholder name is not a declaration"
skip "emergency declared by unknown."; [[ $code -eq 1 ]] || fail "unknown is not a declaration"
skip "SKIP_CHECKS=1, emergency declared by Quan."; [[ $code -eq 0 ]] || fail "a named human is a declaration"
skip "SKIP_CHECKS=1, emergency declared by Đức."; [[ $code -eq 0 ]] || fail "a non-ASCII name is a declaration"
skip "no emergency declared by anyone"; [[ $code -eq 1 ]] || fail "prose that merely contains the phrase is not a declaration"
echo ok >"$stamp"; skip "no mention"; [[ $code -eq 0 ]] || fail "an ok stamp needs no declaration"
echo "ok: only \"emergency declared by <name>\" declares a SKIP_CHECKS push; the template line and a placeholder do not"

# R105: running the named fix in the worktree leaves it clean and the branch free of workflow files.
wt=$tmp/wt
git -C "$repo" worktree add -q -b feat/9-wf "$wt"
mkdir -p "$wt/.github/workflows" && echo on >"$wt/.github/workflows/ci.yml" && echo more >"$wt/other.txt" && git -C "$wt" add -A && git -C "$wt" commit -q -m "feat: workflow"
printf '#!/usr/bin/env bash\nset -euo pipefail\n. "%s/lib/result.sh"\n. "%s/lib/rules.sh"\nresult_begin merge-pr 5\ncd "%s"\nrule_no_workflows "$(git diff --name-only main...HEAD)" "$1" "${2:-}"\nresult_ok fine\n' "$here" "$here" "$wt" >"$tmp/w.sh"
set +e; bash "$tmp/w.sh" "$wt" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
[[ $code -eq 1 ]] || fail "a workflow file is refused"
fix=$(sed -n 's/^Fix: //p' "$tmp/err")
[[ "$fix" == "cd $wt && git rm -rf -- .github/workflows/ci.yml && git commit --amend --no-edit" ]] || fail "R105 fix names the worktree and removes the files: $fix"
(cd "$tmp" && eval "$fix") >/dev/null 2>&1 || fail "the R105 fix runs"
[[ -z "$(git -C "$wt" status --porcelain)" ]] || fail "after the R105 fix the worktree must be clean, got: $(git -C "$wt" status --porcelain)"
[[ -z "$(git -C "$wt" diff --name-only main...HEAD | grep '^\.github/workflows/' || true)" ]] || fail "after the R105 fix no workflow file is in the diff"
echo "ok: the R105 fix removes the files from the worktree and leaves it clean (no untracked leftovers)"

# R97 for a commit made with the commit hooks skipped: an attribution trailer, a file over 20000 bytes.
git -C "$repo" switch -q -c feat/9-ok main
echo a >"$repo/a.txt"; git -C "$repo" add a.txt; git -C "$repo" commit -q -m "feat: a"
head -c 30000 /dev/zero | tr '\0' 'x' >"$repo/gen.bin"; head -c 30000 /dev/urandom >"$repo/rand.bin"
printf 'gen.bin linguist-generated\n' >"$repo/.gitattributes"
git -C "$repo" add -A; git -C "$repo" commit -q -m "feat: generated and binary files may be large"
printf '#!/usr/bin/env bash\nset -euo pipefail\n. "%s/lib/result.sh"\n. "%s/lib/rules.sh"\nresult_begin merge-pr 5\ncd "%s"\nrule_commits_hooked main "$1" "${2:-}" "${3:-}"\nresult_ok fine\n' "$here" "$here" "$repo" >"$tmp/c.sh"
hooked() { set +e; bash "$tmp/c.sh" "$@" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e; }
hooked HEAD; [[ $code -eq 0 ]] || fail "clean commits, a generated file and a binary file pass"
git -C "$repo" commit -q --allow-empty -m "feat: b" -m "Generated-""with: a tool"
hooked HEAD "$repo"; [[ $code -eq 1 ]] && grep -q "Fix: cd $repo && git reset --soft" "$tmp/err" || fail "an attribution trailer in a commit is refused with the fix"
# The fix runs as written: it squashes the branch onto origin/main with the last subject, drops the trailer, and pushes.
fix=$(sed -n 's/^Fix: //p' "$tmp/err")
git init -q --bare "$tmp/origin.git" && git -C "$repo" remote add origin "$tmp/origin.git"
git -C "$repo" update-ref refs/remotes/origin/main main
git -C "$repo" switch -q -c feat/9-trailer && git -C "$repo" push -q -u origin feat/9-trailer
(cd "$tmp" && heavy() { shift; "$@"; } && eval "$fix") >/dev/null 2>&1 || fail "the trailer fix runs: $fix"
[[ "$(git -C "$repo" log -1 --format=%s)" == "feat: b" && -z "$(git -C "$repo" log -1 --format=%B | grep -i 'generated-with' || true)" ]] || fail "the trailer fix recommits with the subject and no trailer"
[[ "$(git --git-dir="$tmp/origin.git" rev-parse refs/heads/feat/9-trailer)" == "$(git -C "$repo" rev-parse HEAD)" ]] || fail "the trailer fix pushes the branch"
hooked HEAD; [[ $code -eq 0 ]] || fail "after the trailer fix the commits pass"
git -C "$repo" switch -q feat/9-ok
git -C "$repo" reset -q --hard HEAD~1
head -c 25000 /dev/zero | tr '\0' 'y' >"$repo/big.txt"; git -C "$repo" add big.txt; git -C "$repo" commit -q -m "feat: big"
hooked HEAD "$repo" push; [[ $code -eq 1 ]] && grep -q 'big.txt (25000 bytes)' "$tmp/err" || fail "a text file over 20000 bytes is refused"
fix=$(sed -n 's/^Fix: //p' "$tmp/err")
[[ "$fix" == "cd $repo && git add -A && git commit -m \"fix: split oversize files under the 20000-byte limit\" && heavy -- git push origin HEAD" ]] || fail "the oversize fix is a command that commits and pushes: $fix"
# The fix runs once the file is split: it commits, pushes to the remote, and the check then passes.
git -C "$repo" rm -q --cached big.txt && rm "$repo/big.txt"; head -c 12000 /dev/zero | tr '\0' 'y' >"$repo/big-1.txt"; head -c 13000 /dev/zero | tr '\0' 'y' >"$repo/big-2.txt"
(cd "$tmp" && heavy() { shift; "$@"; } && eval "$fix") >/dev/null 2>&1 || fail "the oversize fix runs"
[[ -z "$(git -C "$repo" status --porcelain)" ]] || fail "after the oversize fix the worktree is clean"
[[ "$(git --git-dir="$tmp/origin.git" rev-parse refs/heads/feat/9-ok)" == "$(git -C "$repo" rev-parse HEAD)" ]] || fail "the oversize fix pushes the branch"
hooked HEAD; [[ $code -eq 0 ]] || fail "after the split the net change has no oversize file, so the check passes"
echo "ok: a trailer or an oversize text file in a commit is refused; generated and binary files pass"

# R68 and the rest of the checks that run in the main checkout.
printf '#!/usr/bin/env bash\nset -euo pipefail\n. "%s/lib/result.sh"\n. "%s/lib/rules.sh"\nresult_begin merge-pr 5\nrule_main_clean "$1"\nresult_ok fine\n' "$here" "$here" >"$tmp/m.sh"
git -C "$repo" switch -q main; git -C "$repo" switch -q --detach
set +e; bash "$tmp/m.sh" "$repo" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
[[ $code -eq 1 ]] && grep -q 'detached HEAD' "$tmp/err" || fail "a detached main checkout is refused"
git -C "$repo" switch -q main
set +e; bash "$tmp/m.sh" "$tmp/not-a-repo" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
[[ $code -eq 1 ]] && grep -q 'Fix: git -C' "$tmp/err" || fail "an unreadable main checkout ends with the message and fix, not silently"
git -C "$repo" ls-files --error-unmatch README.md >/dev/null 2>&1 || { echo base >"$repo/README.md"; git -C "$repo" add README.md; git -C "$repo" commit -q -m readme; }
echo edit >>"$repo/README.md"
set +e; bash "$tmp/m.sh" "$repo" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
fix=$(sed -n 's/^Fix: //p' "$tmp/err")
[[ $code -eq 1 && "$fix" == "git -C '$repo' diff HEAD > ~/tmp/main-checkout-edits-"[0-9]*".patch && git -C '$repo' restore --staged --worktree ."* ]] || fail "the R68 fix saves the edits before it restores: $fix"
echo "ok: R68 refuses a detached or unreadable main checkout, and its fix saves the edits first"

echo "all rules tests passed"
