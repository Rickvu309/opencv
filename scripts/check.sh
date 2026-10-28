#!/usr/bin/env bash
# check.sh: run lint, typecheck, and test locally (this repo runs no CI).
# Detects pnpm / yarn / npm from the lockfile and runs the root package.json scripts that exist (they call turbo).
#
# Usage:
#   scripts/check.sh                 full run: lint, typecheck, test (what scripts/review-pr.sh runs, once per PR)
#   scripts/check.sh lint test       run only these
#   scripts/check.sh --changed       quick run scoped to what changed since origin/main (what pushes run)
#   STRICT_SCRIPTS=1 scripts/check.sh   fail if a script is missing (recommended once all exist)
#   CHECK_DRY_RUN=1 scripts/check.sh ...   print the plan and the commands, run nothing
#   CHECK_BASE_REF=<ref> scripts/check.sh --changed   compare with <ref> instead of origin/main
#   CHECK_CONCURRENCY=<n> scripts/check.sh   turbo task concurrency (--concurrency; default: turbo's own for the full run, 2 for --changed)
#   VITEST_MAX_WORKERS=<n> scripts/check.sh   vitest worker pool per package (vitest reads it itself; turbo passes it through)
#   `heavy -- scripts/check.sh` sets both to 2 (see AGENTS.md section 4)
#
# --changed (pnpm only; may be combined with task names) looks at the files that differ from
# `git merge-base origin/main HEAD`: committed, staged, unstaged and untracked (not ignored). Then:
#   - lint, typecheck, test: turbo, only for the changed workspace packages and their dependents
#     (turbo run <task> --filter "...{./<dir>}"), plus prettier --check on the changed files,
#     plus the scripts/ tests when their files changed, plus the web tests when a verify-app-ui or
#     verify-landing file changed (apps/web/src/test/verify-assumptions.test.ts reads their assumptions).
#   - A global file (root package.json, lockfile, workspace, turbo.json, root configs, .npmrc, check.sh)
#     or a missing origin/main falls back to the full run.
#
# Called by the pre-push hook and scripts/open-pr.sh (both with --changed), and by scripts/review-pr.sh (full).
# Exit code: 0 all passed (or a dry run, which runs nothing), 1 something failed.
set -euo pipefail

case "${1:-}" in
  -h|--help) awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 0 ;;
esac

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# One JSON result per run (scripts/lib/result.sh). review-pr.sh runs a copy of this file from main, so the helper is read
# from the tree being checked; without it the run still works and writes nothing.
if [[ -f scripts/lib/result.sh ]]; then
  # shellcheck source=scripts/lib/result.sh
  . scripts/lib/result.sh
else
  result_begin() { :; }; result_id() { :; }; result_ok() { :; }; result_fail() { :; }; result_file() { :; }
  result_log() { :; }; result_next() { :; }; result_retried() { :; }
fi
result_begin check "${PR_RESULT_ID:-$(git symbolic-ref --quiet --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo detached)}"
check_log=""
if [[ "${CHECK_DRY_RUN:-}" != "1" ]]; then
  check_log="${PR_RESULT_DIR:-${HOME:-.}/tmp/pr-results}/logs/check-$$.log"
  mkdir -p "$(dirname "$check_log")" 2>/dev/null && : >"$check_log" 2>/dev/null || check_log=""
fi

changed_mode=0
tasks=()
for a in "$@"; do
  if [[ "$a" == "--changed" ]]; then changed_mode=1; else tasks+=("$a"); fi
done
[[ ${#tasks[@]} -gt 0 ]] || tasks=(lint typecheck test)
dry=0; [[ "${CHECK_DRY_RUN:-}" == "1" ]] && dry=1
conc=${CHECK_CONCURRENCY:-2}

# Run a command, or only print it when CHECK_DRY_RUN=1. The output is also kept in $check_log for the result file.
run() {
  if (( dry )); then echo "[dry-run] $*"; return 0; fi
  if [[ -z "$check_log" ]]; then "$@"; return; fi
  local rc=0
  "$@" 2>&1 | tee -a "$check_log" || rc=${PIPESTATUS[0]}
  return "$rc"
}

# Failing test files named in the kept output, as repo-relative paths. Vitest prints "FAIL [|project|] <file> > ..."
# and turbo prefixes "<package>:test:", so the package name is mapped to its directory.
failed_test_files() {
  [[ -n "$check_log" && -s "$check_log" ]] || return 0
  local line pkg file dir seen=" "
  while IFS= read -r line; do
    pkg=""; [[ "$line" =~ ^([^:\ ]+):[a-z:-]+[[:space:]] ]] && pkg=${BASH_REMATCH[1]}
    [[ "$line" =~ FAIL[[:space:]]+(\|[^|]+\|[[:space:]]+)?([^[:space:]]+\.(test|spec)\.[a-z]+) ]] || continue
    file=${BASH_REMATCH[2]}; dir=""
    if [[ -n "$pkg" ]]; then
      for d in apps/*/package.json packages/*/package.json; do
        [[ -f "$d" ]] || continue
        if [[ "$(node -p "require('./$d').name" 2>/dev/null)" == "$pkg" ]]; then dir=$(dirname "$d")/; break; fi
      done
    fi
    [[ "$seen" == *" $dir$file "* ]] || { seen+="$dir$file "; echo "$dir$file"; }
  done < <(sed $'s/\033\\[[0-9;]*m//g' "$check_log" | grep -E 'FAIL ' | head -n 200)
}

if [[ ! -f package.json ]]; then
  echo "check: no package.json; nothing to run." >&2
  exit 0
fi

if   [[ -f pnpm-lock.yaml ]];    then pm=pnpm
elif [[ -f yarn.lock ]];         then pm=yarn
else pm=npm; fi
command -v "$pm" >/dev/null 2>&1 || { echo "check: $pm is not installed." >&2; result_fail env "$pm is not installed"; exit 1; }
command -v node  >/dev/null 2>&1 || { echo "check: node is not installed." >&2; result_fail env "node is not installed"; exit 1; }

needs_install=$(node -e "const p=require('./package.json');console.log(Object.keys({...p.dependencies,...p.devDependencies}).length>0?1:0)")
if [[ "$needs_install" == "1" && ! -d node_modules ]]; then
  echo "check: node_modules missing. Install first ($pm install)." >&2
  result_fail env "node_modules missing"
  exit 1
fi

has_script() { node -e "process.exit(require('./package.json').scripts?.[process.argv[1]] ? 0 : 1)" "$1"; }

failed=()

# --changed: work out the scope. Any reason to run everything sets changed_mode=0.
base=""; files=(); scope_dirs=()
if (( changed_mode )); then
  if [[ "$pm" != "pnpm" ]]; then
    echo "check --changed: needs pnpm; running the full check."; changed_mode=0
  elif ! base=$(git merge-base "${CHECK_BASE_REF:-origin/main}" HEAD 2>/dev/null); then
    echo "check --changed: ${CHECK_BASE_REF:-origin/main} not found; running the full check."; changed_mode=0
  fi
fi
if (( changed_mode )); then
  mapfile -d '' -t files < <({ git diff --name-only --no-renames -z "$base"; git ls-files --others --exclude-standard -z; } | tr '\0' '\n' | sort -u | tr '\n' '\0')
  for f in "${files[@]}"; do
    case "$f" in
      package.json|pnpm-lock.yaml|pnpm-workspace.yaml|turbo.json|.npmrc|.nvmrc|.node-version|.pnpmfile.cjs|vitest.*|scripts/check.sh) global="$f" ;;
      */*) global="" ;;
      *.config.*|tsconfig*.json|.eslint*|.prettier*) global="$f" ;;
      *) global="" ;;
    esac
    if [[ -n "$global" ]]; then
      echo "check --changed: $global is a global file; running the full check."
      changed_mode=0; break
    fi
  done
fi

if (( changed_mode )); then
  # Workspace packages that own changed files (apps/<x>/, packages/<x>/).
  pkgs=()
  for f in "${files[@]}"; do
    case "$f" in
      apps/*/*|packages/*/*)
        d=$(echo "$f" | cut -d/ -f1-2)
        [[ " ${scope_dirs[*]:-} " == *" $d "* ]] || scope_dirs+=("$d") ;;
    esac
  done
  for d in "${scope_dirs[@]:-}"; do
    [[ -n "$d" ]] || continue
    n=""; [[ -f "$d/package.json" ]] && n=$(node -p "require('./$d/package.json').name" 2>/dev/null || true)
    pkgs+=("${n:-$d}")
  done
  # Select by directory, not by `[base]`: pnpm's git filter ignores untracked files and would also pick
  # up the workspace root (whose `typecheck`/`test` scripts run everything) when a root file changed.
  filters=(); for d in "${scope_dirs[@]:-}"; do [[ -n "$d" ]] && filters+=(--filter "...{./$d}"); done
  if [[ ${#pkgs[@]} -gt 0 ]]; then pkg_desc="packages: ${pkgs[*]} (+dependents)"; else pkg_desc="no workspace packages"; fi
  echo "check --changed: ${#files[@]} files, $pkg_desc (base ${base:0:9})"

  has_changed() { local f p; for f in "${files[@]}"; do for p in "$@"; do [[ "$f" == $p ]] && return 0; done; done; return 1; }
  existing=()
  for f in "${files[@]}"; do
    [[ -f "$f" ]] && existing+=("$f")
  done

  for t in "${tasks[@]}"; do
    case "$t" in
      lint)
        if [[ ${#scope_dirs[@]} -gt 0 ]]; then
          echo "==> turbo lint (${#scope_dirs[@]} changed packages + dependents)"
          run pnpm exec turbo run lint --concurrency=$conc "${filters[@]}" || failed+=(lint)
        fi
        if [[ ${#existing[@]} -gt 0 ]]; then
          echo "==> prettier --check (${#existing[@]} files)"
          run pnpm exec prettier --check --ignore-unknown -- "${existing[@]}" || failed+=(prettier)
        fi
        ;;
      typecheck|test)
        if [[ ${#scope_dirs[@]} -gt 0 ]]; then
          echo "==> turbo $t (${#scope_dirs[@]} changed packages + dependents)"
          run pnpm exec turbo run "$t" --concurrency=$conc "${filters[@]}" || failed+=("$t")
        else
          echo "==> $t: no workspace package changed, nothing to run"
        fi
        if [[ "$t" == "test" ]]; then
          web_in_scope=0
          if [[ ${#scope_dirs[@]} -gt 0 ]]; then
            scoped=$(pnpm ls -r --depth -1 --parseable "${filters[@]}" 2>/dev/null || true)
            [[ $'\n'"$scoped"$'\n' == *"/apps/web"$'\n'* ]] && web_in_scope=1
          fi
          if has_changed '.claude/skills/verify-app-ui/*' '.claude/skills/verify-landing/*' && (( ! web_in_scope )); then
            echo "==> web tests (verify-assumptions reads the verify skills' assumptions)"
            run "$pm" --filter web test || failed+=(verify-assumptions)
          fi
          if has_changed scripts/codeowners-lib.sh scripts/test-codeowners.sh scripts/review-pr.sh .github/CODEOWNERS; then
            echo "==> scripts/test-codeowners.sh"
            run scripts/test-codeowners.sh || failed+=(codeowners-tests)
          fi
          if has_changed .githooks/commit-msg scripts/test-commit-msg.sh; then
            echo "==> scripts/test-commit-msg.sh"
            run scripts/test-commit-msg.sh || failed+=(commit-msg-tests)
          fi
          if has_changed scripts/new-task.sh scripts/test-new-task.sh scripts/lib/result.sh scripts/lib/disk.sh; then
            echo "==> scripts/test-new-task.sh"
            run scripts/test-new-task.sh || failed+=(new-task-tests)
          fi
          if has_changed .githooks/pre-commit scripts/test-pre-commit.sh .gitattributes; then
            echo "==> scripts/test-pre-commit.sh"
            run scripts/test-pre-commit.sh || failed+=(pre-commit-tests)
          fi
          if has_changed scripts/review-pr.sh scripts/test-review-pr.sh scripts/codeowners-lib.sh scripts/lib/result.sh; then
            echo "==> scripts/test-review-pr.sh"
            run scripts/test-review-pr.sh || failed+=(review-pr-tests)
          fi
          if has_changed scripts/lib/disk.sh scripts/test-disk-preflight.sh; then
            echo "==> scripts/test-disk-preflight.sh"
            run scripts/test-disk-preflight.sh || failed+=(disk-tests)
          fi
          if has_changed scripts/lib/result.sh scripts/lib/result-check.mjs scripts/test-result.sh; then
            echo "==> scripts/test-result.sh"
            run scripts/test-result.sh || failed+=(result-tests)
          fi
          if has_changed scripts/merge-pr.sh scripts/test-merge-pr.sh scripts/lib/result.sh; then
            echo "==> scripts/test-merge-pr.sh"
            run scripts/test-merge-pr.sh || failed+=(merge-pr-tests)
          fi
        fi
        ;;
      *)
        if has_script "$t"; then
          echo "==> $pm run $t"
          run "$pm" run "$t" || failed+=("$t")
        else
          echo "check: warning: package.json has no '$t' script." >&2
        fi
        ;;
    esac
  done
else
  for t in "${tasks[@]}"; do
    if has_script "$t"; then
      echo "==> $pm run $t"
      extra=(); [[ -n "${CHECK_CONCURRENCY:-}" ]] && extra+=("--concurrency=$CHECK_CONCURRENCY")
      if ! run "$pm" run "$t" ${extra[@]+"${extra[@]}"}; then failed+=("$t"); fi
    elif [[ "${STRICT_SCRIPTS:-0}" == "1" ]]; then
      echo "check: package.json has no '$t' script (STRICT_SCRIPTS=1)." >&2
      failed+=("$t")
    else
      echo "check: warning: package.json has no '$t' script." >&2
    fi
  done

  if [[ " ${tasks[*]} " == *" test "* ]]; then
    for t in test-commit-msg test-pre-commit test-codeowners test-new-task test-review-pr test-merge-pr test-result test-disk-preflight; do
      echo "==> scripts/$t.sh"
      run "scripts/$t.sh" || failed+=("$t")
    done
  fi
fi

mode_desc="${tasks[*]}"; (( changed_mode )) && mode_desc="$mode_desc; changed since ${base:0:9}"
if [[ ${#failed[@]} -gt 0 ]]; then
  echo "check: FAILED: ${failed[*]}" >&2
  # The first failed task names the cause. A timeout in the output makes a failed test a timing test.
  case "${failed[0]}" in
    lint|prettier) cause=lint ;;
    typecheck) cause=typecheck ;;
    build) cause=build ;;
    *) cause=test ;;
  esac
  # Only vitest's own error line counts ("Error: Hook timed out in 10000ms."), not a test that prints those words.
  if [[ "$cause" == test && -n "$check_log" ]] && sed $'s/\033\\[[0-9;]*m//g' "$check_log" | grep -qE '^([A-Za-z0-9@/_.-]+:test: )? *Error: (Hook|Test) timed out in [0-9]+ ?ms'; then cause=timing-test; fi
  mapfile -t failing_files < <(failed_test_files)
  [[ ${#failing_files[@]} -eq 0 ]] || result_file "${failing_files[@]}"
  [[ -z "$check_log" ]] || result_log "$check_log"
  rerun="heavy -- scripts/check.sh"; (( ! changed_mode )) || rerun+=" --changed"
  result_fail "$cause" "failed: ${failed[*]}" "$rerun ${tasks[*]}"
  exit 1
fi
result_ok "all passed ($mode_desc)$( (( ! dry )) || echo ', dry run')"
if (( dry )); then echo "check: dry run, nothing ran ($mode_desc)"; else echo "check: all passed ($mode_desc)"; fi
