#!/usr/bin/env bash
# new-task.sh: start work on an issue in its own branch + worktree.
#
# Usage:
#   scripts/new-task.sh <type> <issue#>        [-d "short description"] [options]
#   scripts/new-task.sh <type> "<issue title>" [-d "short description"] [-b "issue body"] [options]
#
#   <type>   feat | fix | hotfix | refactor | chore | docs
#   <issue#> existing GitHub issue number. If you pass a title instead, the issue
#            is created with `gh issue create`, labeled <type>, and assigned to you.
#
# Options:
#   -d, --desc TEXT    short description for the branch (default: from the issue title)
#   -b, --body TEXT    body for a newly created issue (default: placeholder)
#   --no-install       skip installing dependencies in the worktree
#   --no-assign        don't assign the issue to yourself
#   --take             start even if the issue is assigned to someone else
#   -h, --help         show this help
#
# Result:
#   branch    <type>/<issue#>-short-description   (from the latest origin/main, no upstream yet)
#   worktree  ../opencv.worktrees/<issue#>-short-description
#   .env      copied from .env.example, with PORT set
#   hooks     git config core.hooksPath .githooks (pre-push + commit-msg guardrails)
#   port      4000 + (issue# mod 1000), or the next free port above it
set -euo pipefail

# shellcheck source=scripts/lib/result.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/result.sh"
# shellcheck source=scripts/lib/disk.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/disk.sh"
# shellcheck source=scripts/lib/rules.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/rules.sh"
result_begin new-task

TYPES="feat fix hotfix refactor chore docs"
BRANCH_RE='^(feat|fix|hotfix|refactor|chore|docs)/[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$'
MAX_WORDS=5

die()  { result_fail "${DIE_CAUSE:-hygiene}" "$*"; echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }
warn() { echo "warning: $*" >&2; }
usage() { [[ "${1:-0}" == 0 ]] || result_fail hygiene "usage error"; awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit "${1:-0}"; }

slugify() {
  # lowercase, non-alphanumerics -> '-', squeeze, trim, keep first MAX_WORDS words
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -d- -f1-"$MAX_WORDS"
}

port_in_use() {
  local p=$1
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${p}\$"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}

# Ports already claimed by other worktrees' .env files (servers may not be running yet).
port_claimed() {
  local p=$1 wt_root=$2
  [[ -d "$wt_root" ]] || return 1
  grep -qsxE "PORT=${p}" "$wt_root"/*/.env 2>/dev/null
}

# ---- args -------------------------------------------------------------------
[[ $# -ge 1 ]] || usage 2
desc=""; body=""; do_install=1; do_assign=1; take=0
positional=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--desc) [[ $# -ge 2 ]] || die "$1 needs a value"; desc=$2; shift 2 ;;
    -b|--body) [[ $# -ge 2 ]] || die "$1 needs a value"; body=$2; shift 2 ;;
    --no-install) do_install=0; shift ;;
    --no-assign)  do_assign=0; shift ;;
    --take)       take=1; shift ;;
    -h|--help) usage 0 ;;
    -*) echo "error: unknown option: $1" >&2; usage 2 ;;
    *) positional+=("$1"); shift ;;
  esac
done
[[ ${#positional[@]} -eq 2 ]] || { echo "error: expected <type> and <issue#|title>, got ${#positional[@]} argument(s)" >&2; usage 2; }
type=${positional[0]}; target=${positional[1]}

result_id "${type}-${target}"
[[ " $TYPES " == *" $type "* ]] || die "type must be one of: $TYPES"

# ---- locate the main checkout -----------------------------------------------
git rev-parse --git-dir >/dev/null 2>&1 || die "run this inside the repository"
common_dir=$(git rev-parse --path-format=absolute --git-common-dir)
[[ "$(basename "$common_dir")" == ".git" ]] || die "expected a non-bare repo (common dir: $common_dir)"
main_checkout=$(dirname "$common_dir")
repo_name=$(basename "$main_checkout")
wt_root="$(dirname "$main_checkout")/${repo_name}.worktrees"

disk_guard "$main_checkout" "$wt_root"

main_branch=$(git -C "$main_checkout" branch --show-current || true)
[[ "$main_branch" == "main" ]] || warn "main checkout ($main_checkout) is on '$main_branch'; it should stay on main."

# ---- resolve the issue ------------------------------------------------------
have_gh=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then have_gh=1; fi

issue_title=""
if [[ "$target" =~ ^#?([0-9]+)$ ]]; then
  issue=${BASH_REMATCH[1]}
  if (( have_gh )); then
    state=$(gh issue view "$issue" --json state --jq .state 2>/dev/null) \
      || die "issue #$issue not found in this repo"
    [[ "$state" == "OPEN" ]] || die "issue #$issue is $state; pick an open issue"
    issue_title=$(gh issue view "$issue" --json title --jq .title)
    rule_not_ready_for_human "$(gh issue view "$issue" --json labels --jq '.labels[].name' 2>/dev/null || true)"
    me=$(gh api user --jq .login 2>/dev/null || true)
    others=$(gh issue view "$issue" --json assignees --jq '.assignees[].login' | grep -vxF "${me:-}" || true)
    if [[ -n "$others" ]] && (( ! take )); then
      die "issue #$issue is assigned to: $(tr '\n' ' ' <<<"$others")- pick another issue, or pass --take if this is agreed"
    fi
    if (( do_assign )); then
      gh issue edit "$issue" --add-assignee @me >/dev/null || warn "could not assign #$issue to you"
    fi
  else
    warn "gh not available or not logged in: cannot verify or assign issue #$issue"
  fi
else
  (( have_gh )) || DIE_CAUSE=env die "creating an issue needs the gh CLI, logged in (gh auth login)"
  issue_title=$target
  [[ -n "$body" ]] || body="Created with scripts/new-task.sh. Describe the goal and done criteria."
  info "Creating issue: $issue_title"
  assign_args=(); (( do_assign )) && assign_args=(--assignee @me)
  url=$(gh issue create --title "$issue_title" --body "$body" --label "$type" ${assign_args[@]+"${assign_args[@]}"}) \
    || die "gh issue create failed (does the '$type' label exist? see CONTRIBUTING.md, "Setup")"
  issue=${url##*/}
  [[ "$issue" =~ ^[0-9]+$ ]] || die "could not read issue number from: $url"
  info "Created issue #$issue: $url"
fi

# ---- build the branch name --------------------------------------------------
if [[ -z "$desc" ]]; then
  # Drop a leading "type:" / "type(scope):" from the issue title.
  desc=$(printf '%s' "$issue_title" | sed -E 's/^[a-zA-Z]+(\([^)]*\))?!?:[[:space:]]*//')
fi
[[ -n "$desc" ]] || die "no description: pass -d \"short description\""
slug=$(slugify "$desc")
[[ -n "$slug" ]] || die "description '$desc' has no usable characters; pass -d"

branch="${type}/${issue}-${slug}"
result_id "$branch"
[[ "$branch" =~ $BRANCH_RE ]] || die "built an invalid branch name: $branch"
words=$(tr '-' '\n' <<<"$slug" | grep -c . || true)
(( words >= 3 )) || warn "description has $words word(s); 3-5 is the guideline (use -d to change)"

wt_path="${wt_root}/${issue}-${slug}"
[[ ! -e "$wt_path" ]] || die "worktree path already exists: $wt_path"

# ---- create branch + worktree from the latest origin/main -------------------
info "Fetching origin/main"
git -C "$main_checkout" fetch --quiet origin main

if git -C "$main_checkout" show-ref --verify --quiet "refs/heads/$branch"; then
  die "branch $branch already exists locally (another worktree may be on it: git worktree list)"
fi
if git -C "$main_checkout" ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  die "branch $branch already exists on origin; someone is already working on it"
fi
existing=$(git -C "$main_checkout" for-each-ref --format='%(refname:short)' "refs/heads/*/${issue}-*" || true)
[[ -z "$existing" ]] || warn "other local branches already exist for #$issue: $existing"

mkdir -p "$wt_root"
info "Creating worktree $wt_path on $branch"
git -C "$main_checkout" worktree add --quiet --no-track -b "$branch" "$wt_path" origin/main

# Local guardrails (pre-push, commit-msg). The setting is shared by all worktrees of this clone.
if [[ -d "$wt_path/.githooks" ]]; then
  if [[ "$(git -C "$main_checkout" config --get core.hooksPath || true)" != ".githooks" ]]; then
    git -C "$main_checkout" config core.hooksPath .githooks
    info "Enabled local hooks: git config core.hooksPath .githooks"
  fi
else
  warn "no .githooks/ on main yet: local guardrails are not active"
fi

# ---- .env + port ------------------------------------------------------------
port=$(( 4000 + issue % 1000 ))
while port_in_use "$port" || port_claimed "$port" "$wt_root"; do
  port=$(( port + 1 ))
  (( port < 65535 )) || die "no free port found"
done

if [[ -f "$wt_path/.env.example" ]]; then
  cp "$wt_path/.env.example" "$wt_path/.env"
  if grep -qE '^PORT=' "$wt_path/.env"; then
    sed -i.bak -E "s/^PORT=.*/PORT=${port}/" "$wt_path/.env" && rm -f "$wt_path/.env.bak"
  else
    printf '\nPORT=%s\n' "$port" >> "$wt_path/.env"
  fi
  info "Created .env from .env.example (fill in real values if needed)"
else
  printf 'PORT=%s\n' "$port" > "$wt_path/.env"
  warn "no .env.example in repo; wrote .env with PORT only"
fi

# The port is recorded in the worktree's git dir so open-pr.sh can tell if .env was changed (AGENTS.md: use only your port).
echo "$port" >"$(git -C "$wt_path" rev-parse --absolute-git-dir)/assigned-port"

# ---- install ----------------------------------------------------------------
if (( do_install )) && [[ -f "$wt_path/package.json" ]]; then
  if   [[ -f "$wt_path/pnpm-lock.yaml" ]];    then cmd=(pnpm install --frozen-lockfile)
  elif [[ -f "$wt_path/yarn.lock" ]];         then cmd=(yarn install)
  elif [[ -f "$wt_path/package-lock.json" ]]; then cmd=(npm ci)
  else cmd=(npm install); fi
  info "Installing dependencies: ${cmd[*]}"
  (cd "$wt_path" && "${cmd[@]}") || warn "install failed; run '${cmd[*]}' in $wt_path"
fi

result_ok "worktree $wt_path on $branch (issue #$issue, port $port)" "cd $(printf '%q' "$wt_path") && scripts/open-pr.sh --draft"
cat <<MSG

Ready.
  issue     #$issue${issue_title:+  $issue_title}
  branch    $branch
  worktree  $wt_path
  port      $port   (pnpm dev reads .env: api on $port, web on $(( port + 1000 )))

Next:
  cd "$wt_path"
  # commit work, then open the PR (runs checks, pushes, fills title and body):
  scripts/open-pr.sh --draft
MSG
