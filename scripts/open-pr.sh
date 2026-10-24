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
# Emergency only: SKIP_CHECKS=1 scripts/open-pr.sh   (say so in the PR body)
set -euo pipefail

BRANCH_RE='^(feat|fix|hotfix|refactor|chore|docs)/([0-9]+)-([a-z0-9]+(-[a-z0-9]+)*)$'
TITLE_RE='^(feat|fix|hotfix|refactor|chore|docs)(\([a-z0-9-]+\))?!?: [^ ].* \(#([0-9]+)\)$'

die()  { echo "error: $*" >&2; exit 1; }
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

have_gh=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then have_gh=1; fi
(( have_gh || dry )) || die "the gh CLI must be installed and logged in (gh auth login)"

# Existing PR for this branch?
if (( have_gh )); then
  existing=$(gh pr list --head "$branch" --state open --json url --jq '.[0].url // empty' 2>/dev/null || true)
  if [[ -n "$existing" ]]; then
    echo "A PR is already open for $branch: $existing"
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
  body="**Checks were skipped (SKIP_CHECKS=1). Reviewer: run scripts/check.sh.**"$'\n\n'"$body"
fi

echo "Title: $title"
echo "Base:  main   Head: $branch   Draft: $([[ $draft == 1 ]] && echo yes || echo no)"
if (( dry )); then
  echo "----- body -----"; echo "$body"; echo "----------------"
  echo "(dry run: nothing pushed or created)"
  exit 0
fi

[[ -z "$(git status --porcelain)" ]] || die "uncommitted changes. Commit (or stash) them first."
[[ -n "$(git rev-list origin/main..HEAD 2>/dev/null)" ]] || die "no commits on $branch beyond origin/main"

if [[ "${SKIP_CHECKS:-}" == "1" ]]; then
  echo "WARNING: SKIP_CHECKS=1, checks skipped. Emergencies only." >&2
else
  # Quick check of what changed; the full check runs once, in scripts/review-pr.sh.
  info "Running scripts/check.sh --changed"
  env -u CHECK_DRY_RUN scripts/check.sh --changed || die "checks failed. Fix them, commit, and run open-pr.sh again."
fi

info "Pushing $branch"
git push -u origin HEAD || die "push failed; no PR created. Fix the push error and retry."

args=(--base main --head "$branch" --title "$title" --body "$body")
(( draft )) && args+=(--draft)
info "Creating PR"
gh pr create "${args[@]}"
