#!/usr/bin/env bash
# merge-pr.sh gates added with the ci runner: the required ci check (B1) and risk:high for ci.yml, check.sh and the
# ruleset (M2). Same stubs as test-merge-pr.sh (scripts/lib/merge-pr-harness.sh).
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/lib/merge-pr-harness.sh
. "$here/lib/merge-pr-harness.sh"
# The required ci check gates the merge: only a success on the reviewed head passes.
for case in "failure:{\"check_runs\":[{\"name\":\"ci\",\"conclusion\":\"failure\",\"started_at\":\"2026-01-01T00:00:00Z\"}]}:is failure" \
  "pending:{\"check_runs\":[{\"name\":\"ci\",\"conclusion\":null,\"started_at\":\"2026-01-01T00:00:00Z\"}]}:is pending" \
  "missing:{\"check_runs\":[]}:is missing" \
  "other:{\"check_runs\":[{\"name\":\"check\",\"conclusion\":\"success\",\"started_at\":\"2026-01-01T00:00:00Z\"}]}:is missing"; do
  name=${case%%:*}; rest=${case#*:}; want=${rest##*:}; json=${rest%:*}
  reset; MP_CI=$json run
  expect "B1: a $name ci check refuses the merge" 1 "$want" "gh run rerun"
  result status=fail cause=hygiene
  no_merge "ci $name"
done
reset; MP_CI='{"check_runs":[{"name":"ci","conclusion":"failure","started_at":"2026-01-01T00:00:00Z"},{"name":"ci","conclusion":"success","started_at":"2026-01-02T00:00:00Z"}]}' run
expect "B1: the latest ci run counts, a rerun that passed merges" 0 "merged PR #5"

# R105 and risk:high: ci.yml, check.sh and the ruleset attest the ci check, so the issue must carry risk:high.
reset; MP_FILES="scripts/check.sh docs/y.md" run
expect "M2: a check.sh change without risk:high refuses before the gate" 1 "risk:high" "gh issue edit"
no_merge "risk"; never_gated "risk"
reset; MP_FILES="scripts/check.sh" MP_LABELS="chore risk:normal" run
expect "M2: another risk label does not count" 1 "risk:high"
reset; MP_FILES=".github/workflows/ci.yml" run
expect "R105: deleting ci.yml refuses" 1 "deletes .github/workflows/ci.yml" "git checkout origin/main -- .github/workflows/ci.yml"
no_merge "ci delete"; never_gated "ci delete"
reset; MP_FILES=".github/rulesets/main.json" MP_LABELS="chore risk:high" run
expect "M2: risk:high lets a ruleset change through" 0 "merged PR #5"

echo "all merge-pr gate cases passed"
