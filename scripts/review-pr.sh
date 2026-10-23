#!/usr/bin/env bash
# review-pr.sh: the review agent's gate. Verifies a PR against the workflow and runs the checks
# in a throwaway worktree. It never approves. OK means the PR may merge once the change is verified locally and an
# independent review has no open finding; no human approval is needed.
#
# Usage (from the main checkout):
#   scripts/review-pr.sh <pr#> [--keep] [--no-install]
#
# Exit code:
#   0  OK to merge (after you confirm the verify-opencv evidence and the independent review is clean)
#   1  FAIL: request changes
#   2  HUMAN REQUIRED: do not merge. Only for super important changes: the needs-human-review label (a big
#      decision) or a mass deletion (the PR deletes MASS_DELETE_PCT% or more of the files tracked on main, or
#      APP_DELETE_PCT% or more of one app or package with at least 5 files)
set -euo pipefail

BRANCH_RE='^(feat|fix|hotfix|refactor|chore|docs)/([0-9]+)-[a-z0-9]+(-[a-z0-9]+)*$'
BOT_RE='^(dependabot|renovate)/'
TITLE_RE='^(feat|fix|hotfix|refactor|chore|docs)(\([a-z0-9-]+\))?!?: [^ ].* \(#([0-9]+)\)$'
MASS_DELETE_PCT=25
APP_DELETE_PCT=80
# A real env file (not a template) committed by mistake. Templates such as .env.example stay allowed.
ENV_FILE_RE='(^|/)(\.env|[A-Za-z0-9_-]+\.env)(\.[A-Za-z0-9_-]+)*$'   # matched case-insensitively
ENV_TEMPLATE_RE='\.(example|sample|template)$'

die() { echo "error: $*" >&2; exit 1; }
fails=(); humans=(); notes=()
ok()    { echo "  ok    $*"; }
bad()   { echo "  FAIL  $*"; fails+=("$*"); }
human() { echo "  HUMAN $*"; humans+=("$*"); }
note()  { echo "  note  $*"; notes+=("$*"); }

[[ $# -ge 1 && "$1" =~ ^#?([0-9]+)$ ]] || { awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 1; }
pr=${BASH_REMATCH[1]}; shift
keep=0; install=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep) keep=1; shift ;;
    --no-install) install=0; shift ;;
    *) die "unknown option: $1" ;;
  esac
done

# shellcheck source=scripts/codeowners-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/codeowners-lib.sh"

if ! { command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; }; then die "gh must be installed and logged in"; fi
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
git -C "$main_checkout" fetch --quiet origin main || die "cannot fetch origin/main"
git -C "$main_checkout" fetch --quiet origin "pull/$pr/head:refs/remotes/origin/pr/$pr" --force || die "cannot fetch the head of PR #$pr"
head_ref="refs/remotes/origin/pr/$pr"
files=$(pr_changed_files "$main_checkout" "origin/main...$head_ref")

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
if (( changes > 0 )); then bad "a reviewer has requested changes"; else ok "no reviewer has requested changes"; fi
slug=$(gh repo view --json owner,name --jq '.owner.login + " " + .name')
read -r repo_owner repo_short <<<"$slug"
open_threads=$(gh api graphql -F n="$pr" -f o="$repo_owner" -f r="$repo_short" -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){pageInfo{hasNextPage} nodes{isResolved}}}}}' --jq '.data.repository.pullRequest.reviewThreads | ([.nodes[] | select(.isResolved == false)] | length) + (if .pageInfo.hasNextPage then 100 else 0 end)') || die "cannot read review threads"
if (( open_threads > 0 )); then bad "$open_threads unresolved review thread(s)"; else ok "no unresolved review threads"; fi

# CODEOWNERS from origin/main (not the PR's copy). The catch-all line is ignored; see codeowners-lib.sh.
owners=$(git -C "$main_checkout" show origin/main:.github/CODEOWNERS 2>/dev/null || true)
[[ -n "$owners" ]] || note "no .github/CODEOWNERS on main"
mapfile -t protected < <(codeowners_protected "$owners" "$files")
if [[ ${#protected[@]} -gt 0 ]]; then
  note "touches env/secrets paths, check no real secret is added: ${protected[*]}"
else
  ok "no env/secrets paths touched"
fi
added=$(git -C "$main_checkout" -c core.quotePath=false diff --no-renames --name-only --diff-filter=AM "origin/main...$head_ref")
env_files=$(grep -Ei "$ENV_FILE_RE" <<<"$added" | grep -Evi "$ENV_TEMPLATE_RE" || true)
if [[ -n "$env_files" ]]; then bad "commits a real env file (secrets): $(tr '\n' ' ' <<<"$env_files")"; else ok "no real env file committed"; fi

gate=$(grep -E '^(package\.json|scripts/|\.githooks/|\.github/)' <<<"$files" || true)
[[ -z "$gate" ]] || note "changes workflow/check files, review them closely: $(tr '\n' ' ' <<<"$gate")"

echo
echo "Up to date and checks"
if git -C "$main_checkout" merge-base --is-ancestor origin/main "$head_ref"; then
  ok "branch is up to date with main"
else
  bad "branch is behind main; author must rebase (git rebase origin/main)"
fi

wt="$wt_root/review-pr-$pr"
[[ ! -e "$wt" ]] || git -C "$main_checkout" worktree remove --force "$wt"
mkdir -p "$wt_root"
git -C "$main_checkout" worktree add --quiet --detach "$wt" "$head_ref"
[[ -f "$wt/.env.example" ]] && cp "$wt/.env.example" "$wt/.env"
if (( install )) && [[ -f "$wt/package.json" ]]; then
  if   [[ -f "$wt/pnpm-lock.yaml" ]];    then cmd=(pnpm install --frozen-lockfile)
  elif [[ -f "$wt/yarn.lock" ]];         then cmd=(yarn install)
  elif [[ -f "$wt/package-lock.json" ]]; then cmd=(npm ci)
  else cmd=(npm install); fi
  (cd "$wt" && "${cmd[@]}") >/dev/null 2>&1 || bad "dependency install failed (${cmd[*]})"
fi
# Use check.sh from main, not the PR's copy, so a PR can't weaken its own gate.
checker=$(mktemp)
if git -C "$main_checkout" show origin/main:scripts/check.sh >"$checker" 2>/dev/null; then
  chmod +x "$checker"
  # A stray CHECK_DRY_RUN, CHECK_BASE_REF in the reviewer shell must not turn the full run into a no-op.
  if (cd "$wt" && env -u CHECK_DRY_RUN -u CHECK_BASE_REF "$checker"); then ok "lint, typecheck, test passed"; else bad "scripts/check.sh failed"; fi
else
  note "no scripts/check.sh on main; run the project's checks by hand"
fi
rm -f "$checker"
if (( keep )); then note "review worktree kept at $wt"; else git -C "$main_checkout" worktree remove --force "$wt"; fi

echo
echo "Verification"
note "check the verify-opencv evidence on the PR (.claude/skills/verify-opencv); there are no preview deploys yet"

echo
if [[ ${#fails[@]} -gt 0 ]]; then
  echo "RESULT: FAIL (${#fails[@]}). Request changes: gh pr review $pr --request-changes --body \"...\""
  exit 1
elif [[ ${#humans[@]} -gt 0 ]]; then
  echo "RESULT: HUMAN REQUIRED. Do NOT merge. Comment with your findings and leave the decision to a human."
  exit 2
else
  echo "RESULT: OK. Check the verify-opencv evidence and the independent review, then: gh pr merge $pr --squash"
  exit 0
fi
