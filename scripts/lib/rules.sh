#!/usr/bin/env bash
# rules.sh: mechanical checks for the PR-workflow rules in AGENTS.md (sections 2 to 6). Source scripts/lib/result.sh first.
# Each check prints one line that names the fix, records cause "hygiene" with that fix as `next`, and exits 1.
# The rule table in AGENTS.md pairs every rule with its enforcer; a rule with no check there is a judgment rule.
#
#   rule_heavy <command>            R90  heavy commands run through heavy (heavy exports HEAVY_SLOT)
#   rule_main_clean <main_checkout> R68  the main checkout stays on main with no edited tracked file
#   rule_port <worktree>            R76  the worktree's .env still has the port new-task.sh assigned
#   rule_not_ready_for_human <labels> R103 the issue is not labeled ready-for-human
#   rule_no_workflows <files>       R105 no file under .github/workflows/
#   rule_skip_declared              R98  SKIP_CHECKS=1 needs SKIP_CHECKS_DECLARED_BY=<human>
#   rule_stamp_dir                  R97/R98 where pre-push records each pushed sha (ok | skip)
#   rule_skip_said <sha> <pr#> <body> R98 a head pushed with SKIP_CHECKS=1 says so in the PR body
#   rule_pushed_through_hook <sha>  R97  the sha was pushed through the pre-push hook (not with the hook-skip flag)

rule_fail() {  # rule_fail <message> <fix command>
  result_fail hygiene "$1" "$2"
  echo "error: $1" >&2
  echo "Fix: $2" >&2
  exit 1
}

rule_heavy() {
  [[ -n "${HEAVY_SLOT:-}" ]] ||
    rule_fail "$1 is a heavy command and must run through heavy (AGENTS.md section 4); it ran without a heavy slot" "heavy -- $1 ${RULE_ARGS:-}"
}

rule_main_clean() {
  local main=$1 branch dirty
  branch=$(git -C "$main" branch --show-current 2>/dev/null || true)
  [[ -z "$branch" || "$branch" == main ]] ||
    rule_fail "the main checkout ($main) is on '$branch'; it stays on main and nobody works in it" "git -C '$main' switch main"
  dirty=$(git -C "$main" status --porcelain --untracked-files=no 2>/dev/null | head -n 5 | tr '\n' ' ')
  [[ -z "$dirty" ]] ||
    rule_fail "the main checkout ($main) has edited files, and nobody edits there (AGENTS.md section 2): $dirty" "move the edit into a worktree (scripts/new-task.sh), then git -C '$main' restore --staged --worktree ."
}

rule_port() {
  local wt=$1 gitdir assigned have
  gitdir=$(git -C "$wt" rev-parse --absolute-git-dir 2>/dev/null) || return 0
  [[ -f "$gitdir/assigned-port" && -f "$wt/.env" ]] || return 0
  assigned=$(<"$gitdir/assigned-port")
  have=$(grep -E '^PORT=' "$wt/.env" | tail -n1 | cut -d= -f2 || true)
  [[ "$have" == "$assigned" ]] ||
    rule_fail "PORT in $wt/.env is '${have:-unset}', but new-task.sh assigned port $assigned to this worktree; use only your assigned port" "sed -i -E 's/^PORT=.*/PORT=$assigned/' '$wt/.env'"
}

rule_not_ready_for_human() {
  grep -qx 'ready-for-human' <<<"$1" || return 0
  rule_fail "the issue is labeled ready-for-human: it is a decision for a human, never an agent task" "pick another issue (gh issue list --search 'no:assignee -label:ready-for-human')"
}

rule_no_workflows() {
  local bad
  bad=$(grep -E '^\.github/workflows/' <<<"$1" | head -n 3 | tr '\n' ' ' || true)
  [[ -z "$bad" ]] ||
    rule_fail "the change adds GitHub Actions workflow files (the account has no Actions budget): $bad" "git rm --cached -r .github/workflows && git commit --amend --no-edit"
}

rule_skip_declared() {
  [[ "${SKIP_CHECKS:-}" == 1 ]] || return 0
  [[ -n "${SKIP_CHECKS_DECLARED_BY:-}" ]] ||
    rule_fail "SKIP_CHECKS=1 is for a production emergency a human declared; no human is named" "SKIP_CHECKS=1 SKIP_CHECKS_DECLARED_BY=<who declared the emergency> heavy -- scripts/open-pr.sh ... (or drop SKIP_CHECKS=1)"
}

rule_stamp_dir() { printf '%s/pre-push-stamps' "$(git rev-parse --path-format=absolute --git-common-dir)"; }

rule_skip_said() {  # rule_skip_said <sha> <pr#> <pr body>: a head pushed with SKIP_CHECKS=1 must say so in the PR
  local sha=$1 pr=$2 body=$3 f
  f="$(rule_stamp_dir)/$sha"
  [[ -f "$f" && "$(<"$f")" == skip ]] || return 0
  grep -q 'SKIP_CHECKS' <<<"$body" ||
    rule_fail "head ${sha:0:9} was pushed with SKIP_CHECKS=1 (only for an emergency a human declared) and PR #$pr does not say so" "gh pr edit $pr --body \"SKIP_CHECKS=1: emergency declared by <who>. \$(gh pr view $pr --json body --jq .body)\""
}

rule_pushed_through_hook() {
  local sha=$1 dir
  dir=$(rule_stamp_dir)
  [[ -d "$dir" ]] || return 0   # a clone whose hook never stamped: nothing to compare with
  [[ -f "$dir/$sha" ]] ||
    rule_fail "commit ${sha:0:9} has no pre-push stamp: it was pushed without the pre-push hook (the hook-skip flag, or core.hooksPath unset)" "git commit --amend --no-edit && heavy -- git push --force-with-lease   # the push runs the hook; the patch id stays the same"
}
