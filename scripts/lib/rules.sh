#!/usr/bin/env bash
# rules.sh: mechanical checks for the PR-workflow rules in AGENTS.md (sections 2 to 6). Source scripts/lib/result.sh first.
# Each check prints one line that names the fix, records cause "hygiene" with that fix as `next`, and exits 1.
# The rule table in docs/git-workflow/rule-enforcement.md pairs every rule with its enforcer; a rule with no check there is a judgment rule.
# A fix that changes a branch starts with cd <worktree>: merge-pr.sh runs in the main checkout, which nobody edits.
#
#   rule_heavy <command>                  R90  heavy commands run through heavy (heavy exports HEAVY_SLOT)
#   rule_main_clean <main_checkout>       R68  the main checkout stays on main with no edited tracked file
#   rule_port <worktree>                  R76  the worktree's .env still has the port new-task.sh assigned
#   rule_not_ready_for_human <labels>     R103 the issue is not labeled ready-for-human
#   rule_no_workflows <files> [wt] [push] R105 no file under .github/workflows/
#   rule_skip_declared                    R98  SKIP_CHECKS=1 needs SKIP_CHECKS_DECLARED_BY=<human>
#   rule_stamp_dir                        R97/R98 where pre-push records each pushed sha (ok | skip)
#   rule_skip_said <sha> <pr#> <body>     R98  a head pushed with SKIP_CHECKS=1 has "emergency declared by <name>" in the PR body
#   rule_pushed_through_hook <sha> [wt]   R97  the sha was pushed through the pre-push hook (not with the hook-skip flag)
#   rule_commits_hooked <base> <tip> [wt] [push] R97  the commits pass what commit-msg and pre-commit refuse (not made with the hook-skip flag)
#   rule_wt_of <branch>                   the worktree that has <branch> checked out

rule_fail() {  # rule_fail <message> <fix command>
  result_fail hygiene "$1" "$2"
  echo "error: $1" >&2
  echo "Fix: $2" >&2
  exit 1
}

rule_cd() { if [[ -n "${1:-}" ]]; then printf 'cd %q && ' "$1"; else printf 'cd <the worktree of this branch> && '; fi; }

rule_wt_of() {
  git worktree list --porcelain 2>/dev/null |
    awk -v b="refs/heads/$1" '/^worktree /{w=substr($0,10)} $0=="branch " b {print w; exit}' || true
}

rule_heavy() {  # RULE_ARGS is the original argument list, shell-quoted with printf '%q '
  [[ -n "${HEAVY_SLOT:-}" ]] ||
    rule_fail "$1 is a heavy command and must run through heavy (AGENTS.md section 4); it ran without a heavy slot" "heavy -- $1${RULE_ARGS:+ ${RULE_ARGS% }}"
}

rule_main_clean() {
  local main=$1 branch dirty stamp
  git -C "$main" rev-parse --git-dir >/dev/null 2>&1 ||
    rule_fail "the main checkout ($main) cannot be read as a git checkout; it stays on main and nobody works in it" "git -C '$main' switch main"
  branch=$(git -C "$main" branch --show-current 2>/dev/null || true)
  [[ "$branch" == main ]] ||
    rule_fail "the main checkout ($main) is on '${branch:-a detached HEAD}'; it stays on main and nobody works in it" "git -C '$main' switch main"
  stamp=$(date +%Y%m%d-%H%M%S)
  dirty=$(git -C "$main" status --porcelain --untracked-files=no 2>/dev/null | head -n 5 | tr '\n' ' ') || true
  [[ -z "$dirty" ]] ||
    rule_fail "the main checkout ($main) has edited files, and nobody edits there (AGENTS.md section 2): $dirty" "git -C '$main' diff HEAD > ~/tmp/main-checkout-edits-$stamp.patch && git -C '$main' restore --staged --worktree .   # saves the edits first; apply the patch in a worktree (scripts/new-task.sh)"
}

rule_port() {
  local wt=$1 gitdir assigned have
  gitdir=$(git -C "$wt" rev-parse --absolute-git-dir 2>/dev/null) || return 0
  [[ -f "$gitdir/assigned-port" && -f "$wt/.env" ]] || return 0
  assigned=$(<"$gitdir/assigned-port")
  have=$(grep -E '^[[:space:]]*(export[[:space:]]+)?PORT=' "$wt/.env" | tail -n1 |
    sed -E 's/\r$//; s/^[^=]*=//; s/[[:space:]]+#.*$//; s/[[:space:]]+$//; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/' || true)
  [[ "$have" == "$assigned" ]] ||
    rule_fail "PORT in $wt/.env is '${have:-unset}', but new-task.sh assigned port $assigned to this worktree; use only your assigned port" "sed -i -E 's/^PORT=.*/PORT=$assigned/' '$wt/.env'"
}

rule_not_ready_for_human() {
  grep -qx 'ready-for-human' <<<"$1" || return 0
  rule_fail "the issue is labeled ready-for-human: it is a decision for a human, never an agent task" "pick another issue (gh issue list --search 'no:assignee -label:ready-for-human')"
}

rule_no_workflows() {  # rule_no_workflows <files> [wt] [push]: push adds the force push (merge-pr; open-pr pushes on its next run)
  local bad=() q
  mapfile -t bad < <(grep -E '^\.github/workflows/' <<<"$1" || true)
  (( ${#bad[@]} )) || return 0
  q=$(printf '%q ' "${bad[@]}")
  rule_fail "the change adds GitHub Actions workflow files (the account has no Actions budget): ${bad[*]:0:3}" \
    "$(rule_cd "${2:-}")git rm -rf -- ${q% } && git commit --amend --no-edit${3:+ && heavy -- git push --force-with-lease}"
}

rule_skip_declared() {
  [[ "${SKIP_CHECKS:-}" == 1 ]] || return 0
  [[ -n "${SKIP_CHECKS_DECLARED_BY:-}" ]] ||
    rule_fail "SKIP_CHECKS=1 is for a production emergency a human declared; no human is named" "SKIP_CHECKS=1 SKIP_CHECKS_DECLARED_BY=<who declared the emergency> heavy -- scripts/open-pr.sh ... (or drop SKIP_CHECKS=1)"
}

rule_stamp_dir() { printf '%s/pre-push-stamps' "$(git rev-parse --path-format=absolute --git-common-dir)"; }

rule_skip_said() {  # rule_skip_said <sha> <pr#> <pr body>: the marker open-pr.sh writes, with a real name; the PR template's own SKIP_CHECKS line does not count
  local sha=$1 pr=$2 body=$3 f who
  f="$(rule_stamp_dir)/$sha"
  [[ -f "$f" && "$(<"$f")" == skip ]] || return 0
  who=$(grep -oiE '(^|[,(*] *)emergency declared by [^[:space:]*.,;)<>]+' <<<"$body" | head -n 1 | sed -E 's/^.*emergency declared by //I' || true)
  [[ -n "$who" && "${who,,}" != unknown ]] ||
    rule_fail "head ${sha:0:9} was pushed with SKIP_CHECKS=1 (only for an emergency a human declared) and PR #$pr does not say \"emergency declared by <name>\"" "gh api -X PATCH repos/{owner}/{repo}/pulls/$pr -f body=\"SKIP_CHECKS=1: emergency declared by <who>. \$(gh pr view $pr --json body --jq .body)\""
}

rule_pushed_through_hook() {  # rule_pushed_through_hook <sha> [wt]
  local sha=$1 dir
  dir=$(rule_stamp_dir)
  [[ -d "$dir" ]] || return 0   # a clone whose hook never stamped: nothing to compare with
  [[ -f "$dir/$sha" ]] ||
    rule_fail "commit ${sha:0:9} has no pre-push stamp: it was pushed without the pre-push hook (the hook-skip flag, or a branch cut before the stamping hook landed, whose worktree still runs the old .githooks/pre-push)" \
      "$(rule_cd "${2:-}")git fetch origin main && git rebase origin/main && git commit --amend --no-edit && heavy -- git push --force-with-lease   # the rebase brings the stamping hook, the push runs it"
}

rule_commits_hooked() {  # rule_commits_hooked <base> <tip> [wt] [push]: what commit-msg and pre-commit refuse, checked again on the branch (git runs in the current directory; wt is only for the fix)
  local base=$1 tip=$2 wt=${3:-} push=${4:-} sha msg trailer="" over="" meta path blob mode size kept attr
  while read -r sha; do
    msg=$(git log -1 --format=%B "$sha")
    ! grep -qiE '^[[:space:]]*(co-authored-by|generated-with):' <<<"$msg" || trailer+="${sha:0:9} "
  done < <(git rev-list "$base..$tip")
  [[ -z "$trailer" ]] ||
    rule_fail "commit(s) ${trailer% } carry an attribution trailer, which the commit-msg hook refuses: they were made without that hook (the hook-skip flag, a cherry-pick or a rebase)" \
      "$(rule_cd "$wt")git reset --soft \"\$(git merge-base origin/main HEAD)\" && git commit -m \"\$(git log -1 --format=%s ORIG_HEAD)\" && heavy -- git push --force-with-lease"
  while IFS= read -r -d '' meta && IFS= read -r -d '' path; do
    read -r _ mode _ blob _ <<<"${meta#:}"
    [[ "$mode" == 160000 ]] && continue
    size=$(git cat-file -s "$blob")
    (( size > 20000 )) || continue
    kept=$(head -c 8000 < <(git cat-file blob "$blob") | tr -d '\0' | wc -c)
    (( kept < 8000 )) && continue
    attr=$(git check-attr --source="$tip" linguist-generated -- "$path")
    [[ "$attr" == *": set" || "$attr" == *": true" ]] && continue
    over+="$path ($size bytes) "
  done < <(git diff --raw --no-renames --no-abbrev -z --diff-filter=ACMR "$base...$tip")
  [[ -z "$over" ]] ||
    rule_fail "file(s) over the 20000-byte pre-commit limit: ${over% }; a commit this size passes only with the hook-skip flag. Split each file as .githooks/pre-commit says, then run the fix" \
      "$(rule_cd "$wt")git add -A && git commit -m \"fix: split oversize files under the 20000-byte limit\"${push:+ && heavy -- git push origin HEAD}"
}
