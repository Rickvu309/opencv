#!/usr/bin/env bash
# merge-pr.sh gates: the required ci check, and risk:high for ci.yml, check.sh and the ruleset.
# Same stubs as test-merge-pr.sh (scripts/lib/merge-pr-harness.sh).
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/lib/merge-pr-harness.sh
. "$here/lib/merge-pr-harness.sh"

reset; MP_MERGE_FAIL=1 run
expect "refused merge says so" 1 "GitHub refused the merge/enqueue" "allow_auto_merge=true" "Never add --admin"
called "refused merge" "pr merge 5 --squash --match-head-commit $head"
never "refused merge" "statuses/"

# The required ci check gates the merge: only a success on the head passes.
for case in "failure:{\"check_runs\":[{\"name\":\"ci\",\"conclusion\":\"failure\",\"started_at\":\"2026-01-01T00:00:00Z\"}]}:is failure" \
  "pending:{\"check_runs\":[{\"name\":\"ci\",\"conclusion\":null,\"started_at\":\"2026-01-01T00:00:00Z\"}]}:is pending" \
  "missing:{\"check_runs\":[]}:is missing" \
  "other:{\"check_runs\":[{\"name\":\"check\",\"conclusion\":\"success\",\"started_at\":\"2026-01-01T00:00:00Z\"}]}:is missing"; do
  name=${case%%:*}; rest=${case#*:}; want=${rest##*:}; json=${rest%:*}
  reset; MP_CI=$json run
  expect "a $name ci check refuses the merge" 1 "$want" "gh run rerun"
  result status=fail cause=hygiene
  no_merge "ci $name"
done
reset; MP_CI='{"check_runs":[{"name":"ci","conclusion":"failure","started_at":"2026-01-01T00:00:00Z"},{"name":"ci","conclusion":"success","started_at":"2026-01-02T00:00:00Z"}]}' run
expect "the latest ci run counts, a rerun that passed merges" 0 "merged PR #5"
# A newer queued ci run has no start time yet; it must still beat an older success (latest = highest id).
reset; MP_CI='{"check_runs":[{"id":2,"name":"ci","status":"queued","conclusion":null,"started_at":null},{"id":1,"name":"ci","status":"completed","conclusion":"success","started_at":"2026-01-01T00:00:00Z"}]}' run
expect "a newer queued ci run beats an older success" 1 "is pending" "gh run rerun"
no_merge "newer queued ci"

# ci.yml, check.sh and the ruleset attest the ci check, so the issue must carry risk:high.
reset; MP_FILES="scripts/check.sh docs/y.md" run
expect "a check.sh change without risk:high refuses" 1 "risk:high" "gh issue edit"
no_merge "risk"
reset; MP_FILES="scripts/check.sh" MP_LABELS="chore risk:normal" run
expect "another risk label does not count" 1 "risk:high"
no_merge "risk normal"
reset; MP_FILES=".github/workflows/ci.yml" run
expect "deleting ci.yml refuses" 1 "deletes .github/workflows/ci.yml" "git checkout origin/main -- .github/workflows/ci.yml"
no_merge "ci delete"
reset; MP_FILES=".github/rulesets/main.json" MP_LABELS="chore risk:high" run
expect "risk:high lets a ruleset change through" 0 "merged PR #5"

reset; MP_FILES=".github/actions/setup/action.yml" run
expect "an action change without risk:high refuses" 1 "risk:high"
no_merge "action risk"
reset; MP_FILES=".github/actions/setup/action.yml" MP_LABELS="chore risk:high" run
expect "risk:high lets an action change through" 0 "merged PR #5"

echo "all merge-pr gate cases passed"
