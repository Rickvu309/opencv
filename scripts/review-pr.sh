#!/usr/bin/env bash
# review-pr.sh: the review agent's gate. Verifies a PR against the workflow and runs the checks
# in a throwaway worktree. It never approves. OK means the PR may merge once the change is verified locally and an
# independent review has no open finding; no human approval is needed.
#
# Usage (from the main checkout):
#   scripts/review-pr.sh <pr#> [--keep] [--no-install] [--no-cache]
#
# The checks run on the merge of origin/main and the PR head, which is what a squash merge lands, so a branch behind
# main needs no rebase. Only a merge conflict does. A passing check is cached by the tested tree (--no-cache reruns it).
# After check.sh passes, the worktree builds the API and web. A failed build is a FAIL. The cache covers both.
# A PR that touches apps/web, apps/api, packages/ui, packages/domain or a verify skill then runs both UI checkers at the
# invariant tier (VERIFY_TIER=invariant). The allowed FAILs are each skill's known-findings.json on origin/main minus the
# entries the PR deletes, so a fix PR removes its entry and no PR excuses its own FAIL. A PR may add an entry only when it
# changes nothing but known-findings.json files (the tier is then skipped, with a note). Any other FAIL (a NEW FAIL must
# fail in two runs), a listed finding that now passes, a STALE or a checker error is a FAIL of the review. No skip flag.
# The cache covers it and keys on main's copies of both lists, both checkers' scripts/ trees and scripts/lib/verify-{gate,tier}.
# The patch id it prints is stable across a rebase that leaves the diff text unchanged; record it with the independent
# review and the verify evidence so they stay valid for the same patch on a new base. Needs git 2.39 or later.
#
# Exit code:
#   0  OK to merge (after you confirm the verify-opencv evidence and the independent review is clean)
#   1  FAIL: request changes
#   2  HUMAN REQUIRED: do not merge. Only for super important changes: the needs-human-review label (a big
#      decision) or a mass deletion (the PR deletes MASS_DELETE_PCT% or more of the files tracked on main, or
#      APP_DELETE_PCT% or more of one app or package with at least 5 files)
set -euo pipefail

# shellcheck source=scripts/lib/result.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/result.sh"
# shellcheck source=scripts/lib/conflict-report.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/conflict-report.sh"
# shellcheck source=scripts/lib/rules.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/rules.sh"
# shellcheck source=scripts/lib/verify-tier.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/verify-tier.sh"
result_begin review-pr

BRANCH_RE='^(feat|fix|hotfix|refactor|chore|docs)/([0-9]+)-[a-z0-9]+(-[a-z0-9]+)*$'
BOT_RE='^(dependabot|renovate)/'
TITLE_RE='^(feat|fix|hotfix|refactor|chore|docs)(\([a-z0-9-]+\))?!?: [^ ].* \(#([0-9]+)\)$'
MASS_DELETE_PCT=25
APP_DELETE_PCT=80
# A real env file (not a template) committed by mistake. Templates such as .env.example stay allowed.
ENV_FILE_RE='(^|/)(\.env|[A-Za-z0-9_-]+\.env)(\.[A-Za-z0-9_-]+)*$'   # matched case-insensitively
ENV_TEMPLATE_RE='\.(example|sample|template)$'
# Paths whose change the review reads for a real secret: env files, env loading code, anything named secret.
SECRET_PATH_RE='(^|/)(\.env[^/]*|[^/]*\.env|env\.[^/]*|[^/]*secret[^/]*)(/|$)|(^|/)env/|^config/env'
# Anything that feeds the stack the app-ui checker drives (web, api, domain, ui), the checkers, and the script that starts the stack.
VERIFY_RE='^(apps/(web|api)/|packages/(ui|domain)/|\.claude/skills/verify-(app-ui|landing)/|\.claude/skills/verify-opencv/scripts/)'
VERIFY_EDIT_RE='^\.claude/skills/verify-(app-ui|landing|opencv)/(known-findings\.json|scripts/)'
VERIFY_LIST_RE='^\.claude/skills/verify-(app-ui|landing)/known-findings\.json$'

die() { result_fail "${DIE_CAUSE:-other}" "$*"; echo "error: $*" >&2; exit 1; }
fails=(); humans=(); notes=()
ok()    { echo "  ok    $*"; }
bad()   { echo "  FAIL  $*"; fails+=("$*"); }
# A soft FAIL clears without a new push (a review thread, a requested change), so the checks still run and get cached.
soft_fails=0
soft_bad() { bad "$*"; soft_fails=$((soft_fails + 1)); }
human() { echo "  HUMAN $*"; humans+=("$*"); }
note()  { echo "  note  $*"; notes+=("$*"); }

[[ $# -ge 1 && "$1" =~ ^#?([0-9]+)$ ]] || { awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 1; }
rule_args=; (( $# )) && rule_args=$(printf '%q ' "$@")
pr=${BASH_REMATCH[1]}; shift
result_id "$pr"
export PR_RESULT_ID=$pr
RULE_ARGS=$rule_args rule_heavy scripts/review-pr.sh
keep=0; install=1; use_cache=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep) keep=1; shift ;;
    --no-install) install=0; shift ;;
    --no-cache) use_cache=0; shift ;;
    *) die "unknown option: $1" ;;
  esac
done

if ! { command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; }; then DIE_CAUSE=env die "gh must be installed and logged in"; fi
common_dir=$(git rev-parse --path-format=absolute --git-common-dir)
main_checkout=$(dirname "$common_dir")
repo_name=$(basename "$main_checkout")
wt_root="$(dirname "$main_checkout")/${repo_name}.worktrees"

view() { gh pr view "$pr" --json "$1" --jq "$2"; }
state=$(view state .state)
base=$(view baseRefName .baseRefName)
branch=$(view headRefName .headRefName)
title=$(view title .title)
body=$(view body .body)
draft=$(view isDraft .isDraft)
labels=$(view labels '.labels[].name')
git -C "$main_checkout" fetch --quiet origin main || DIE_CAUSE=env die "cannot fetch origin/main"
git -C "$main_checkout" fetch --quiet origin "pull/$pr/head:refs/remotes/origin/pr/$pr" --force || DIE_CAUSE=env die "cannot fetch the head of PR #$pr"
head_ref="refs/remotes/origin/pr/$pr"
# --no-renames lists both sides of a rename, so moving a secret path away still counts; -z keeps odd names whole and is not capped at 100 files like `gh pr view --json files`.
files=$(git -C "$main_checkout" diff --name-only -z --no-renames "origin/main...$head_ref" | tr '\0' '\n')

echo "PR #$pr  $title"
echo "  $branch -> $base"
echo

echo "Workflow"
[[ "$state" == "OPEN" ]] || bad "PR is $state"
if [[ "$base" == "main" ]]; then ok "base is main"; else bad "base is '$base', must be main"; fi
[[ "$draft" == "false" ]] || note "PR is a draft; review only when it is marked ready"

is_bot=0
if [[ "$branch" =~ $BOT_RE ]]; then
  is_bot=1; ok "bot branch ($branch): no issue needed"
elif [[ "$branch" =~ $BRANCH_RE ]]; then
  issue=${BASH_REMATCH[2]}; ok "branch name $branch"
else
  bad "branch '$branch' is not type/<issue#>-short-description"
fi

if (( ! is_bot )); then
  if [[ "$title" =~ $TITLE_RE ]]; then
    t_issue=${BASH_REMATCH[3]}
    if [[ -n "${issue:-}" && "$t_issue" != "$issue" ]]; then
      bad "title references #$t_issue but branch is for #$issue"
    else
      ok "title format"
    fi
  else
    bad "title must be 'type: description (#<issue>)'"
  fi
  if [[ -n "${issue:-}" ]]; then
    if grep -qiE "(^|[^A-Za-z])closes #${issue}([^0-9]|$)" <<<"$body"; then ok "body has Closes #$issue"
    else bad "body must contain 'Closes #$issue'"; fi
    istate=$(gh issue view "$issue" --json state --jq .state 2>/dev/null || echo MISSING)
    if [[ "$istate" == "OPEN" ]]; then ok "issue #$issue is open"; else bad "issue #$issue is $istate"; fi
  fi
  if grep -q 'SKIP_CHECKS=1' <<<"$body"; then note "author skipped checks; they run below"; fi
fi

echo
echo "Human approval (only for super important changes)"
if grep -qx 'needs-human-review' <<<"$labels"; then
  human "label needs-human-review is set (a big decision)"
else
  ok "no needs-human-review label"
fi
# Paths unquoted (core.quotePath=false) and no rename detection, so a delete hidden as a rename still counts.
tracked_list=$(git -C "$main_checkout" -c core.quotePath=false ls-tree -r --name-only origin/main)
deleted_list=$(git -C "$main_checkout" -c core.quotePath=false diff --no-renames --name-only --diff-filter=D "origin/main...$head_ref")
tracked=$(grep -c . <<<"$tracked_list" || true)
deleted=$(grep -c . <<<"$deleted_list" || true)
if (( tracked > 0 && deleted * 100 >= tracked * MASS_DELETE_PCT )); then
  human "mass deletion: removes $deleted of $tracked files tracked on main (>= ${MASS_DELETE_PCT}%)"
else
  ok "no mass deletion ($deleted of $tracked files removed)"
fi
# Deleting most of one app or package (for example all of apps/server) is a big decision even below the repo-wide share.
while read -r unit; do
  [[ -n "$unit" ]] || continue
  in_unit=$(awk -v u="$unit/" 'index($0, u) == 1' <<<"$tracked_list" | grep -c . || true)
  gone=$(awk -v u="$unit/" 'index($0, u) == 1' <<<"$deleted_list" | grep -c . || true)
  if (( in_unit >= 5 && gone * 100 >= in_unit * APP_DELETE_PCT )); then
    human "mass deletion: removes $gone of $in_unit files in $unit (>= ${APP_DELETE_PCT}%)"
  fi
done < <(grep -E '^(apps|packages)/[^/]+/' <<<"$deleted_list" | cut -d/ -f1-2 | sort -u)

changes=$(gh pr view "$pr" --json reviews --jq '[.reviews[] | select(.state != "COMMENTED" and .state != "PENDING")] | group_by(.author.login) | map(last) | map(select(.state == "CHANGES_REQUESTED")) | length')
if (( changes > 0 )); then soft_bad "a reviewer has requested changes"; else ok "no reviewer has requested changes"; fi
slug=$(gh repo view --json owner,name --jq '.owner.login + " " + .name')
read -r repo_owner repo_short <<<"$slug"
open_threads=$(gh api graphql -F n="$pr" -f o="$repo_owner" -f r="$repo_short" -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){pageInfo{hasNextPage} nodes{isResolved}}}}}' --jq '.data.repository.pullRequest.reviewThreads | ([.nodes[] | select(.isResolved == false)] | length) + (if .pageInfo.hasNextPage then 100 else 0 end)') || die "cannot read review threads"
if (( open_threads > 0 )); then soft_bad "$open_threads unresolved review thread(s)"; else ok "no unresolved review threads"; fi

protected=$(grep -E "$SECRET_PATH_RE" <<<"$files" | tr '\n' ' ' || true)
if [[ -n "$protected" ]]; then
  note "touches env/secrets paths, check no real secret is added: ${protected% }"
else
  ok "no env/secrets paths touched"
fi
added=$(git -C "$main_checkout" -c core.quotePath=false diff --no-renames --name-only --diff-filter=AM "origin/main...$head_ref")
env_files=$(grep -Ei "$ENV_FILE_RE" <<<"$added" | grep -Evi "$ENV_TEMPLATE_RE" || true)
if [[ -n "$env_files" ]]; then bad "commits a real env file (secrets): $(tr '\n' ' ' <<<"$env_files")"; else ok "no real env file committed"; fi

gate=$(grep -E '^(package\.json|scripts/|\.githooks/|\.github/)' <<<"$files" || true)
[[ -z "$gate" ]] || note "changes workflow/check files, review them closely: $(tr '\n' ' ' <<<"$gate")"
verify_edits=$(grep -E "$VERIFY_EDIT_RE" <<<"$files" || true)
[[ -z "$verify_edits" ]] || note "edits a verify known-findings.json or checker script, so the review must read that diff: $(tr '\n' ' ' <<<"$verify_edits")"
verify_scripts=$(git -C "$main_checkout" diff --no-color --no-ext-diff -U0 "origin/main...$head_ref" -- apps/web/package.json apps/api/package.json | grep -E '^[+-].*"(verify:[^"]*|dev)"' || true)
[[ -z "$verify_scripts" ]] || note "edits a verify:* or dev script in apps/web/package.json or apps/api/package.json (the verify launcher runs them), so the review must read that diff"
verify_needed=0
if grep -qE "$VERIFY_RE" <<<"$files"; then verify_needed=1; else note "touches no apps/web, apps/api, packages/ui, packages/domain or verify skill file; the verify tier is skipped"; fi

echo
echo "Merge with main and checks"
main_sha=$(git -C "$main_checkout" rev-parse origin/main)
head_sha=$(git -C "$main_checkout" rev-parse "$head_ref")
merge_base=$(git -C "$main_checkout" merge-base origin/main "$head_ref") || die "PR #$pr has no common ancestor with main"
# --verbatim hashes the diff text without line numbers, so the id survives a rebase that leaves every hunk's text the
# same (whitespace included) and changes with anything a reviewer would need to read again. Plain prefixes and no
# color or external diff keep the id the same on every machine.
diff_text=$(git -C "$main_checkout" -c diff.suppressBlankEmpty=false diff --no-color --no-ext-diff --no-textconv --unified=3 --src-prefix=a/ --dst-prefix=b/ "$merge_base" "$head_ref")
patch_id=$(git patch-id --verbatim <<<"$diff_text" | cut -d' ' -f1)
if [[ -n "$diff_text" && -z "$patch_id" ]]; then die "could not compute the patch id of PR #$pr"; fi
echo "  main ${main_sha:0:12}   head ${head_sha:0:12}   patch id ${patch_id:-none}"
if git -C "$main_checkout" merge-base --is-ancestor origin/main "$head_ref"; then
  ok "branch contains the latest main"
else
  note "branch is behind main; the checks run on the merge of main and the PR, no rebase needed"
fi

wt="$wt_root/review-pr-$pr"
checker=""
cleanup() {
  [[ -z "$checker" ]] || rm -f "$checker"
  if [[ -e "$wt" ]] && (( ! keep )); then git -C "$main_checkout" worktree remove --force "$wt" >/dev/null 2>&1 || true; fi
}
result_cleanup() { cleanup; }
[[ ! -e "$wt" ]] || git -C "$main_checkout" worktree remove --force "$wt"
mkdir -p "$wt_root"
# Test what a squash merge would land: main with the PR merged in, not the PR head alone. merge-tree writes no ref, no
# index and no commit, so none of the PR's hooks and no git identity take part; the tree is then checked out as is.
set +e
merge_out=$(git -C "$main_checkout" -c core.quotePath=false --attr-source=origin/main merge-tree --write-tree --name-only --no-messages origin/main "$head_ref" 2>/dev/null)
merge_rc=$?
set -e
if (( merge_rc == 0 )); then
  tree=${merge_out%%$'\n'*}
  ok "merges cleanly with main (tested tree ${tree:0:12})"
  # The allowed list is main's, minus what the PR deletes. A PR adds an entry only alone, in a PR that changes nothing but known-findings.json files.
  list_adds=$(verify_list_adds)
  if [[ -n "$list_adds" ]]; then
    if grep -q ' ERROR ' <<<"$list_adds"; then
      bad "a known-findings.json does not parse: $(grep ' ERROR ' <<<"$list_adds" | head -1)"
    elif grep -qvE "$VERIFY_LIST_RE" <<<"$files"; then
      bad "adds known finding(s) ($(sed 's/ ADDED /:/' <<<"$list_adds" | tr '\n' ' ')) and changes other files; land the entry in its own PR, with its issue, that changes only known-findings.json"
    else
      verify_list_only=1
      note "adds known finding(s) ($(sed 's/ ADDED /:/' <<<"$list_adds" | tr '\n' ' ')) and changes nothing else; the verify tier runs with the PR's whole list and fails an entry whose check passes. The review must read that diff and check each entry's issue is open"
    fi
  fi
  git -C "$main_checkout" worktree add --quiet --detach --no-checkout "$wt" origin/main
  # The checkout writes the PR's .githooks/ too; hooks stay off for this one command so none of them fires here.
  git -C "$wt" -c core.hooksPath=/dev/null read-tree -u --reset "$tree"
  if (( ${#fails[@]} > soft_fails )); then
    note "skipped the full check; fix the FAIL item(s) above first (a review thread or a requested change alone does not skip it)"
  else
    # Use check.sh from main, not the PR's copy, so a PR can't weaken its own gate. A passing run is cached by the
    # tested tree and that checker, so a rerun that lands the same tree is free. Cached only when this step adds no FAIL.
    checker_blob=$(git -C "$main_checkout" rev-parse --verify --quiet origin/main:scripts/check.sh || true)
    cache_dir="$wt_root/.review-pr-cache"
    # Older gates did not build both apps, so their cached results cannot skip these builds.
    cache_hit="$cache_dir/$tree-$checker_blob-install$install-apibuild-webbuild-verify$verify_needed-listonly$verify_list_only-$(verify_tier_key)"
    if (( use_cache )) && [[ -n "$checker_blob" && -f "$cache_hit" ]]; then
      ok "lint, typecheck, test passed for this exact tree on $(cat "$cache_hit") (cached; --no-cache reruns)"
      ok "api build passed for this exact tree (cached; --no-cache reruns)"
      ok "web build passed for this exact tree (cached; --no-cache reruns)"
      (( ! verify_needed )) || ok "verify invariant tier passed for this exact tree and these main copies of its lists and checkers (cached; --no-cache reruns)"
    else
      fails_before=${#fails[@]}
      [[ -f "$wt/.env.example" ]] && cp "$wt/.env.example" "$wt/.env"
      if (( install )) && [[ -f "$wt/package.json" ]]; then
        if   [[ -f "$wt/pnpm-lock.yaml" ]];    then cmd=(pnpm install --frozen-lockfile)
        elif [[ -f "$wt/yarn.lock" ]];         then cmd=(yarn install)
        elif [[ -f "$wt/package-lock.json" ]]; then cmd=(npm ci)
        else cmd=(npm install); fi
        (cd "$wt" && "${cmd[@]}") >/dev/null 2>&1 || { bad "dependency install failed (${cmd[*]})"; result_fail env "dependency install failed (${cmd[*]})"; }
      fi
      if [[ -n "$checker_blob" ]]; then
        checker=$(mktemp)
        git -C "$main_checkout" cat-file blob "$checker_blob" >"$checker"
        chmod +x "$checker"
        # A stray CHECK_DRY_RUN, CHECK_BASE_REF in the reviewer shell must not turn the full run into a no-op.
        if (cd "$wt" && env -u CHECK_DRY_RUN -u CHECK_BASE_REF -u CHECK_RETRY_FAILED_TESTS "$checker"); then
          ok "lint, typecheck, test passed"
          note "running pnpm --filter api... run build"
          if (cd "$wt" && pnpm --filter api... run build); then
            ok "api build passed"
          else
            bad "api build failed"; result_fail build "api build failed"
          fi
          note "running pnpm --filter web build"
          if (cd "$wt" && pnpm --filter web build); then
            ok "web build passed"
          else
            bad "web build failed"; result_fail build "web build failed"
          fi
          if (( verify_needed && ${#fails[@]} == fails_before )); then run_verify_tier; fi
          if (( ${#fails[@]} == fails_before && ! verify_flaky )); then mkdir -p "$cache_dir" && date -u +%Y-%m-%dT%H:%M:%SZ >"$cache_hit"; fi
        else
          bad "scripts/check.sh failed"
          result_adopt "$(result_path check)" || result_fail test "scripts/check.sh failed"
        fi
        rm -f "$checker"; checker=""
      else
        note "no scripts/check.sh on main; run the project's checks by hand"
      fi
    fi
  fi
elif (( merge_rc == 1 )); then
  mapfile -t conflict_files < <(tail -n +2 <<<"$merge_out" | sed '/^$/d')
  conflicts=${conflict_files[*]-}
  bad "does not merge cleanly with main; author must rebase (git rebase origin/main) and resolve: ${conflicts:-see git merge origin/main}"
  conflict_report "$main_checkout" "$merge_base" origin/main "$branch" ${conflict_files[@]+"${conflict_files[@]}"}
else
  merge_err=$(git -C "$main_checkout" --attr-source=origin/main merge-tree --write-tree --name-only --no-messages origin/main "$head_ref" 2>&1 >/dev/null | head -3 | tr '\n' ' ' || true)
  bad "merge with main failed (git merge-tree exit $merge_rc): ${merge_err:-no message}"
  result_fail other "merge with main failed (git merge-tree exit $merge_rc)"
fi
if [[ -e "$wt" ]]; then
  if (( keep )); then note "review worktree kept at $wt"; else git -C "$main_checkout" worktree remove --force "$wt"; fi
fi

echo
echo "Verification"
note "check the verify-opencv evidence on the PR (.claude/skills/verify-opencv); there are no preview deploys yet"

echo
if [[ ${#fails[@]} -gt 0 ]]; then
  result_fail hygiene "${fails[0]}"
  echo "RESULT: FAIL (${#fails[@]}). Request changes: gh pr review $pr --request-changes --body \"...\""
  exit 1
elif [[ ${#humans[@]} -gt 0 ]]; then
  result_human "${humans[0]}"
  echo "RESULT: HUMAN REQUIRED. Do NOT merge. Comment with your findings and leave the decision to a human."
  exit 2
else
  result_ok "patch id ${patch_id:-none}, main ${main_sha:0:12}, head ${head_sha:0:12}" "heavy -- scripts/merge-pr.sh $pr"
  echo "RESULT: OK (patch id ${patch_id:-none}, main ${main_sha:0:12}). Check the verify-opencv evidence and the independent review, then: gh pr merge $pr --squash --match-head-commit $head_sha"
  exit 0
fi
