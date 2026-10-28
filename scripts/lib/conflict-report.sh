#!/usr/bin/env bash
# conflict-report.sh: say which change on main a merge conflict comes from. Source scripts/lib/result.sh first.
#
#   conflict_report <repo> <merge_base> <main_ref> <branch> <file>...
#
# For each conflicting file it prints the most recent commit on <main_ref> (since <merge_base>) that touched it:
# sha, subject and the PR number from a "(#N)" in the subject. It then records in result.json: the files, blockedBy
# (the commit that touched the most conflicting files, the newest on a tie) and `next`, the rebase command, which starts
# with a cd to the branch's worktree when this clone has one. Sets CR_NEXT to that command.

conflict_report() {
  local repo=$1 base=$2 ref=$3 branch=$4; shift 4
  local f line sha subj pr best="" best_n=0 best_t=0 n t wt detail="" git=(git --literal-pathspecs -C "$repo" -c core.quotePath=false)
  declare -A of_sha=() n_of=() pr_of=()
  local shas=()
  for f in "$@"; do
    [[ -n "$f" ]] || continue
    line=$("${git[@]}" log -1 --format='%H%x09%s' "$base..$ref" -- "$f" 2>/dev/null || true)
    if [[ -z "$line" ]]; then echo "  $f: not changed on main since the merge base"; continue; fi
    sha=${line%%$'\t'*}; subj=${line#*$'\t'}
    pr=""; [[ "$subj" =~ \(#([0-9]+)\)[[:space:]]*$ ]] && pr=${BASH_REMATCH[1]}
    echo "  $f: changed on main in ${sha:0:9} \"$subj\"${pr:+ (PR #$pr)}"
    detail+="${detail:+; }$f <- ${sha:0:9}${pr:+ (#$pr)}"
    if [[ -z "${n_of[$sha]:-}" ]]; then shas+=("$sha"); n_of[$sha]=0; pr_of[$sha]=$pr; fi
    n_of[$sha]=$(( ${n_of[$sha]} + 1 ))
    of_sha[$sha]+="${of_sha[$sha]:+$'\n'}$f"
  done
  for sha in "${shas[@]}"; do
    n=${n_of[$sha]}; t=$("${git[@]}" log -1 --format=%ct "$sha" 2>/dev/null || echo 0)
    if (( n > best_n || (n == best_n && t > best_t) )); then best=$sha; best_n=$n; best_t=$t; fi
  done
  wt=$("${git[@]}" worktree list --porcelain 2>/dev/null | awk -v b="refs/heads/$branch" '/^worktree /{p=substr($0,10)} $1=="branch" && $2==b {print p}' | head -1 || true)
  # Double quotes keep the usual path readable; a path with a quote, $, backtick or backslash is shell-escaped instead.
  local cd_to=""
  if [[ -n "$wt" ]]; then
    if [[ "$wt" == *[\"\$\`\\]* ]]; then printf -v cd_to 'cd %q && ' "$wt"; else cd_to="cd \"$wt\" && "; fi
  fi
  CR_NEXT="${cd_to}git fetch origin && git rebase origin/main"
  echo "  Rebase, resolve these files, then push: $CR_NEXT && heavy -- git push --force-with-lease"
  result_file "$@"
  if [[ -n "$best" ]]; then
    local blocked=()
    mapfile -t blocked <<<"${of_sha[$best]}"
    result_blocked_by "${pr_of[$best]}" "$best" "${blocked[@]}"
  fi
  CR_DETAIL="does not merge cleanly with main: ${detail:-$*}"
  result_fail merge-conflict "$CR_DETAIL" "$CR_NEXT"
}
