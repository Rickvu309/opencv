#!/usr/bin/env bash
# cleanup-worktree.sh: remove worktrees whose PR has been merged, then prune.
#
# Usage:
#   scripts/cleanup-worktree.sh              remove all merged worktrees
#   scripts/cleanup-worktree.sh <issue#>     only the worktree for that issue
#   scripts/cleanup-worktree.sh --dry-run    show what would be removed
#   scripts/cleanup-worktree.sh --force      also remove worktrees with uncommitted changes
#
# "Merged" means: gh reports a merged PR for the branch. Without gh, a branch whose
# remote branch was deleted (auto-delete after merge) is treated as merged.
# Squash-merges are not visible to `git branch --merged`, so that is not used.
set -euo pipefail

die()  { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }
warn() { echo "warning: $*" >&2; }

dry=0; force=0; only_issue=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) dry=1; shift ;;
    --force) force=1; shift ;;
    -h|--help) awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 0 ;;
    *) [[ "$1" =~ ^#?([0-9]+)$ ]] || die "unknown argument: $1"; only_issue=${BASH_REMATCH[1]}; shift ;;
  esac
done

git rev-parse --git-dir >/dev/null 2>&1 || die "run this inside the repository"
common_dir=$(git rev-parse --path-format=absolute --git-common-dir)
main_checkout=$(dirname "$common_dir")
repo_name=$(basename "$main_checkout")
wt_root="$(dirname "$main_checkout")/${repo_name}.worktrees"

have_gh=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then have_gh=1; fi
(( have_gh )) || warn "gh not available: using 'remote branch deleted' as the merged signal"

info "Fetching and pruning remote branches"
git -C "$main_checkout" fetch --quiet --prune origin

is_merged() {
  local branch=$1
  if (( have_gh )); then
    local n
    n=$(gh pr list --head "$branch" --state merged --json number --jq 'length' 2>/dev/null || echo 0)
    [[ "$n" -gt 0 ]]
  else
    # Branch was pushed (has/had upstream config) and the remote branch is gone.
    git -C "$main_checkout" config --get "branch.${branch}.remote" >/dev/null 2>&1 \
      && ! git -C "$main_checkout" show-ref --verify --quiet "refs/remotes/origin/${branch}"
  fi
}

removed=0
path=""; branch=""
process() {
  [[ -n "$path" && -n "$branch" ]] || return 0
  [[ "$path" == "$wt_root"/* ]] || return 0           # only our worktrees, never the main checkout
  if [[ -n "$only_issue" && "$(basename "$path")" != "${only_issue}-"* ]]; then return 0; fi

  if ! is_merged "$branch"; then
    echo "    keep   $branch (not merged)"
    return 0
  fi
  if [[ -n "$(git -C "$path" status --porcelain 2>/dev/null)" ]] && (( ! force )); then
    warn "skip $path: uncommitted changes (use --force to discard)"
    return 0
  fi
  if (( dry )); then
    echo "    would remove  $path  ($branch)"
    return 0
  fi
  local wt_args=(); (( force )) && wt_args=(--force)
  git -C "$main_checkout" worktree remove ${wt_args[@]+"${wt_args[@]}"} "$path"
  git -C "$main_checkout" branch -D "$branch" >/dev/null
  echo "    removed $path  ($branch)"
  removed=$((removed + 1))
}

while IFS= read -r line; do
  case "$line" in
    "worktree "*) path=${line#worktree } ;;
    "branch "*)   branch=${line#branch refs/heads/} ;;
    "")           process; path=""; branch="" ;;
  esac
done < <(git -C "$main_checkout" worktree list --porcelain; echo)

git -C "$main_checkout" worktree prune
[[ -d "$wt_root" ]] && rmdir "$wt_root" 2>/dev/null || true
info "Done. Removed $removed worktree(s)."
