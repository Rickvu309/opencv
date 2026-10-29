#!/usr/bin/env bash
# Runs scripts/merge-pr.sh with a stub gh, so no network is needed. The stub records every call in $MP_LOG.
# Cases assert the exit code, the output and which calls were recorded.
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/lib/merge-pr-harness.sh
. "$here/lib/merge-pr-harness.sh"

reset
run
expect "ok path merges" 0 "merged PR #5 as cafe0000cafe0000cafe0000cafe0000cafe0000" "node scripts/pr.mjs release cafe0000cafe0000cafe0000cafe0000cafe0000 --wait 600"
called "ok path" "pr merge 5 --squash --match-head-commit $head"
never "ok path" "statuses/"
result status=ok cause=none "next=node scripts/pr.mjs release cafe0000cafe0000cafe0000cafe0000cafe0000 --wait 600"

reset; MP_AUTHOR=contributor run
expect "non-author refuses" 1 "contributor" "never merged here"
never "non-author" "api repos/"; never "non-author" "pr merge"
result status=fail cause=hygiene

reset; MP_DRAFT=true run
expect "a draft refuses" 1 "is a draft" "gh pr ready 5"
no_merge "draft"
result status=fail cause=hygiene

reset; MP_PR_LABELS="needs-human-review" run
expect "needs-human-review refuses" 1 "needs-human-review" "never merges it"
no_merge "human label"
result status=fail cause=hygiene

reset; MP_PR_LABELS="chore" run
expect "another PR label does not block" 0 "merged PR #5"

reset; MP_DIFF_FAIL=1 run
expect "a failed diff listing refuses" 1 "could not list the files"
no_merge "diff failure"
result status=fail cause=hygiene

reset
run --nope
expect "unknown option" 1 "unknown option"
no_merge "unknown option"

bash "$here/test-merge-pr-gates.sh"
echo "all merge-pr cases passed"
