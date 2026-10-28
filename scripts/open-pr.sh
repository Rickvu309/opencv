#!/usr/bin/env bash
# open-pr.sh: validate the branch, run the quick check, push, and open the PR in the agreed format.
#
# Usage (inside your task worktree):
#   scripts/open-pr.sh [-d "description"] [--draft] [--dry-run]
#
#   -d, --desc TEXT   PR description part of the title (default: issue title, else branch words)
#   --draft           open as a draft PR
#   --dry-run         validate and print title/body; don't run checks, push, or create the PR
#
# Title:  type: description (#N)       e.g. feat: add login page (#42)
# Body:   .github/pull_request_template.md with "Closes #N" filled in
#
# A test file that fails in the quick check or in the pre-push check of the push is rerun once, alone. If it passes the
# run goes on with "WARN passed only on retry: <files>" and the files are in result.json (retried); a second failure fails.
# This is done with CHECK_RETRY_FAILED_TESTS=1 for this script's own check.sh runs only; scripts/review-pr.sh never retries.
#
# Emergency only, declared by a human: SKIP_CHECKS=1 SKIP_CHECKS_DECLARED_BY=<who> scripts/open-pr.sh   (the PR body says so)
# Heavy: run it as heavy -- scripts/open-pr.sh (the HEAVY_SLOT check); --dry-run needs no slot.
set -euo pipefail

# shellcheck source=scripts/lib/result.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/result.sh"
# shellcheck source=scripts/lib/disk.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/disk.sh"
# shellcheck source=scripts/lib/rules.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/rules.sh"
orig_args="$*"
result_begin open-pr

BRANCH_RE='^(feat|fix|hotfix|refactor|chore|docs)/([0-9]+)-([a-z0-9]+(-[a-z0-9]+)*)$'
TITLE_RE='^(feat|fix|hotfix|refactor|chore|docs)(\([a-z0-9-]+\))?!?: [^ ].* \(#([0-9]+)\)$'

die()  { result_fail "${DIE_CAUSE:-hygiene}" "$*"; echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }

desc=""; draft=0; dry=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--desc) [[ $# -ge 2 ]] || die "$1 needs a value"; desc=$2; shift 2 ;;
    --draft) draft=1; shift ;;
    --dry-run) dry=1; shift ;;
    -h|--help) awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

top=$(git rev-parse --show-toplevel 2>/dev/null) || die "run this inside your task worktree"
cd "$top"
branch=$(git symbolic-ref --quiet --short HEAD) || die "detached HEAD; check out your task branch"

[[ "$branch" != "main" ]] || die "you are on main. Start a task: scripts/new-task.sh <type> <issue#>"
[[ "$branch" =~ $BRANCH_RE ]] || die "branch '$branch' is not type/<issue#>-short-description (see docs/git-workflow/branch-naming.md)"
type=${BASH_REMATCH[1]}; issue=${BASH_REMATCH[2]}; slug=${BASH_REMATCH[3]}
result_id "$branch"
export PR_RESULT_ID=$branch

# Before anything is pushed or created: the worktree, its siblings and the scratch dirs must have room and accept writes.
common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)
if [[ "$(basename "$common_dir")" == ".git" ]]; then main_checkout=$(dirname "$common_dir"); else main_checkout=$top; fi
disk_guard "$main_checkout" "$(dirname "$main_checkout")/$(basename "$main_checkout").worktrees" "$top"

have_gh=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then have_gh=1; fi
(( have_gh || dry )) || DIE_CAUSE=env die "the gh CLI must be installed and logged in (gh auth login)"

# Existing PR for this branch?
if (( have_gh )); then
  existing=$(gh pr list --head "$branch" --state open --json url --jq '.[0].url // empty' 2>/dev/null || true)
  if [[ -n "$existing" ]]; then
    echo "A PR is already open for $branch: $existing"
    result_id "${existing##*/}"
    result_ok "a PR is already open: $existing" "heavy -- scripts/review-pr.sh ${existing##*/}"
    exit 0
  fi
  state=$(gh issue view "$issue" --json state --jq .state 2>/dev/null) || die "issue #$issue not found"
  [[ "$state" == "OPEN" ]] || die "issue #$issue is $state"
fi

# Description: -d, else the issue title without a "type:" prefix, else the branch words.
if [[ -z "$desc" ]] && (( have_gh )); then
  desc=$(gh issue view "$issue" --json title --jq .title 2>/dev/null \
    | sed -E 's/^[a-zA-Z]+(\([^)]*\))?!?:[[:space:]]*//' || true)
fi
[[ -n "$desc" ]] || desc=${slug//-/ }
desc=$(printf '%s' "$desc" | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//; s/[.]$//')
desc="$(printf '%s' "${desc:0:1}" | tr '[:upper:]' '[:lower:]')${desc:1}"

title="${type}: ${desc} (#${issue})"
[[ "$title" =~ $TITLE_RE ]] || die "built an invalid title: $title"

template=".github/pull_request_template.md"
if [[ -f "$template" ]]; then
  body=$(sed -E "s/^Closes #.*$/Closes #${issue}/" "$template")
  grep -qx "Closes #${issue}" <<<"$body" || body="Closes #${issue}"$'\n\n'"$body"
else
  body="Closes #${issue}"
fi
if [[ "${SKIP_CHECKS:-}" == "1" ]]; then
  body="**Checks were skipped (SKIP_CHECKS=1), emergency declared by ${SKIP_CHECKS_DECLARED_BY:-unknown}. Reviewer: run scripts/check.sh.**"$'\n\n'"$body"
fi

echo "Title: $title"
echo "Base:  main   Head: $branch   Draft: $([[ $draft == 1 ]] && echo yes || echo no)"
if (( dry )); then
  echo "----- body -----"; echo "$body"; echo "----------------"
  echo "(dry run: nothing pushed or created)"
  result_ok "dry run, nothing pushed or created"
  exit 0
fi

# The workflow rules that a script can check (AGENTS.md rule table): heavy, SKIP_CHECKS, main checkout, port, issue label, workflows.
RULE_ARGS=$orig_args rule_heavy scripts/open-pr.sh
rule_skip_declared
rule_main_clean "$main_checkout"
rule_port "$top"
(( ! have_gh )) || rule_not_ready_for_human "$(gh issue view "$issue" --json labels --jq '.labels[].name' 2>/dev/null || true)"
rule_no_workflows "$(git diff --name-only origin/main...HEAD 2>/dev/null || true)"

[[ -z "$(git status --porcelain)" ]] || die "uncommitted changes. Commit (or stash) them first."
[[ -n "$(git rev-list origin/main..HEAD 2>/dev/null)" ]] || die "no commits on $branch beyond origin/main"

checked=0
if [[ "${SKIP_CHECKS:-}" == "1" ]]; then
  echo "WARNING: SKIP_CHECKS=1, checks skipped. Emergencies only." >&2
else
  # Quick check of what changed; the full check runs once, in scripts/review-pr.sh.
  info "Running scripts/check.sh --changed"
  checked=1
  export CHECK_RETRY_FAILED_TESTS=1
  if ! env -u CHECK_DRY_RUN scripts/check.sh --changed; then
    result_adopt "$(result_path check)" || true
    DIE_CAUSE=other die "checks failed. Fix them, commit, and run open-pr.sh again."
  fi
fi

(( ! checked )) || result_adopt_retried "$(result_path check)"
info "Pushing $branch"
git push -u origin HEAD || DIE_CAUSE=other die "push failed; no PR created. Fix the push error and retry."
rule_pushed_through_hook "$(git rev-parse HEAD)"
(( ! checked )) || result_adopt_retried "$(result_path check)"
(( ${#R_RETRIED[@]} == 0 )) || echo "WARN passed only on retry: ${R_RETRIED[*]}"

args=(--base main --head "$branch" --title "$title" --body "$body")
(( draft )) && args+=(--draft)
info "Creating PR"
pr_url=$(gh pr create "${args[@]}") || DIE_CAUSE=other die "gh pr create failed; the branch is pushed. Run open-pr.sh again."
[[ -z "$pr_url" ]] || echo "$pr_url"
if [[ "${pr_url##*/}" =~ ^[0-9]+$ ]]; then
  result_id "${pr_url##*/}"
  result_ok "opened ${pr_url}" "cd \"$(dirname "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo .)")\" && heavy -- scripts/review-pr.sh ${pr_url##*/}"
else
  result_ok "PR created"
fi
