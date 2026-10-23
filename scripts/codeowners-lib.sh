#!/usr/bin/env bash
# codeowners-lib.sh: decide which changed files touch a protected path in .github/CODEOWNERS.
# Sourced by review-pr.sh and test-codeowners.sh; it defines functions and runs nothing.
#
# The catch-all "*" (or "**") line gives the owner every merge (owner-only merge). It says nothing about env or secrets,
# so it is skipped here. Without that, every file of every PR matches and review-pr.sh flags every file as env/secrets.

# codeowners_matches <path> <pattern>: simplified gitignore-style match, exit 0 on a match.
codeowners_matches() {
  local path=$1 pat=$2 comps c
  if [[ "$pat" == /* ]]; then
    pat=${pat#/}; pat=${pat%/}
    # shellcheck disable=SC2053
    [[ "$path" == $pat || "$path" == $pat/* ]]; return
  fi
  if [[ "$pat" == */ ]]; then           # directory name anywhere
    pat=${pat%/}
    IFS=/ read -ra comps <<<"$path"
    for c in "${comps[@]:0:${#comps[@]}-1}"; do
      # shellcheck disable=SC2053
      [[ "$c" == $pat ]] && return 0
    done
    return 1
  fi
  if [[ "$pat" == */* ]]; then          # relative path pattern
    # shellcheck disable=SC2053
    [[ "$path" == $pat || "$path" == */$pat || "$path" == $pat/* ]]; return
  fi
  IFS=/ read -ra comps <<<"$path"      # name anywhere (file or directory)
  for c in "${comps[@]}"; do
    # shellcheck disable=SC2053
    [[ "$c" == $pat ]] && return 0
  done
  return 1
}

# codeowners_protected <codeowners-text> <file-list>: print each file matched by a rule other than the catch-all.
codeowners_protected() {
  local owners=$1 files=$2 f pat _owners
  while IFS= read -r f; do
    [[ -n "$f" ]] || continue
    while read -r pat _owners; do
      [[ -z "$pat" || "$pat" == \#* || "$pat" == "*" || "$pat" == "**" ]] && continue
      if codeowners_matches "$f" "$pat"; then printf '%s\n' "$f"; break; fi
    done <<<"$owners"
  done <<<"$files"
}

# pr_changed_files <git-dir> <diff-args...>: every path a PR changes, e.g. origin/main...origin/pr/7. --no-renames lists both sides of a rename, so moving
# a protected file away still counts. Unlike `gh pr view --json files`, it is not capped at 100 files.
pr_changed_files() {
  git -C "$1" diff --name-only -z --no-renames "${@:2}" | tr '\0' '\n'
}
