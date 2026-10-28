#!/usr/bin/env bash
# test-rules.sh: the pre-push stamps (R97, R98) that scripts/open-pr.sh and scripts/merge-pr.sh read, and scripts/lib/rules.sh.
# The checks inside open-pr.sh, merge-pr.sh, review-pr.sh and new-task.sh are asserted in their own tests
# (open-pr.test.mjs, test-merge-pr.sh, test-review-pr.sh, test-new-task.sh). Usage: scripts/test-rules.sh
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE CHECK_DRY_RUN SKIP_CHECKS PR_RESULT_ID

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
tmp=$(mktemp -d)
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
[[ $code -eq 1 ]] && grep -q 'Fix: git commit --amend --no-edit && heavy -- git push --force-with-lease' "$tmp/err" || fail "an unstamped sha is refused with the fix"
rm -rf "$repo/.git/pre-push-stamps"
set +e; bash "$tmp/r.sh" "0123456789abcdef0123456789abcdef01234567" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
[[ $code -eq 0 ]] || fail "a clone whose hook never stamped is not blocked"
echo "ok: an unstamped sha is refused with the push command; a clone with no stamps yet is not blocked"
echo "all rules tests passed"
