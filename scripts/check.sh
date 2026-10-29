#!/usr/bin/env bash
# check.sh: run lint, typecheck, and test locally (the ci workflow runs it too).
# Detects pnpm / yarn / npm from the lockfile and runs the root package.json scripts that exist (they call turbo).
#
# Usage:
#   scripts/check.sh                 full run: lint, typecheck, test (nothing runs this before a merge; ci runs --changed)
#   scripts/check.sh lint test       run only these
#   scripts/check.sh --changed       quick run scoped to what changed since origin/main (what pushes run)
#   STRICT_SCRIPTS=1 scripts/check.sh   fail if a script is missing
#   CHECK_DRY_RUN=1 scripts/check.sh ...   print the plan and commands, run nothing
#   CHECK_BASE_REF=<ref> scripts/check.sh --changed   compare with <ref> instead of origin/main
#   CHECK_CONCURRENCY=<n> scripts/check.sh   turbo --concurrency (default 2)
#   VITEST_MAX_WORKERS=<n> scripts/check.sh   vitest worker pool per package (turbo passes it through)
#   Both default to 2
#   CHECK_RETRY_FAILED_TESTS=1 scripts/check.sh --changed   rerun a failed vitest file once, alone (set by open-pr.sh only,
#     so its quick check and the pre-push check of its push; a plain run never retries). If every failed file
#     passes: warn "passed only on retry: <files>", record them in the result file's `retried`, exit 0. Else fail as before.
#     Only when `test` is the one failed task, at most CHECK_RETRY_MAX_FILES (5, digits only) files failed, turbo's
#     "Failed:" line names only packages that have a retried file, and the log has no vitest unhandled error. Turbo runs
#     with --continue then, so every package runs; a package that failed without a FAIL line keeps the run failed.
#
# --changed (pnpm only; may be combined with task names) looks at the files that differ from
# `git merge-base origin/main HEAD`: committed, staged, unstaged and untracked (not ignored). Then:
#   - lint, typecheck, test: turbo, only for the changed workspace packages and their dependents
#     (turbo run <task> --filter "...{./<dir>}"), plus prettier --check on the changed files,
#     plus the scripts/ tests when their files changed, plus the web tests when a verify-app-ui or
#     verify-landing file changed (apps/web/src/test/verify-assumptions.test.ts reads their assumptions).
#   - test always runs the root node:test guards (the .test.mjs files of the root package.json `test` script, 2.5 s),
#     because a guard reads docs, skills and config no workspace package owns; an empty list fails. scripts/open-pr.test.mjs
#     (40 s) runs only when scripts/open-pr.sh, scripts/lib/* or the test itself changed.
#   - A global file (root package.json, lockfile, workspace, turbo.json, root configs, .npmrc, check.sh)
#     or a missing origin/main falls back to the full run.
#
# The full run (no --changed) adds a whole-repo prettier --check after `lint`.
#
# Called by the pre-push hook and scripts/open-pr.sh (both with --changed). ci.yml runs the same quick check.
# Exit code: 0 all passed (or a dry run, which runs nothing), 1 something failed.
set -euo pipefail

case "${1:-}" in
  -h|--help) awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 0 ;;
esac

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# One JSON result per run (scripts/lib/result.sh). The helper is read from the tree being checked; without it the
# run still works and writes nothing.
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
: "${CHECK_CONCURRENCY:=2}"
export VITEST_MAX_WORKERS="${VITEST_MAX_WORKERS:-2}"
conc=$CHECK_CONCURRENCY

# Run a command, or only print it when CHECK_DRY_RUN=1. The output is also kept in $check_log for the result file.
run() {
  if (( dry )); then echo "[dry-run] $*"; return 0; fi
  if [[ -z "$check_log" ]]; then "$@"; return; fi
  local rc=0
  "$@" 2>&1 | tee -a "$check_log" || rc=${PIPESTATUS[0]}
  return "$rc"
}

# prettier --check on the given files (or "." for the whole repo); a failure counts as the prettier task, cause lint.
prettier_check() {
  local what=$1; shift
  echo "==> prettier --check ($what)"
  run pnpm exec prettier --check --ignore-unknown -- "$@" || failed+=(prettier)
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

# Directories of the packages turbo reports as failed ("Failed:    web#test, @workspace/domain#test"), one per line.
# Prints nothing and returns 1 when the log has no such line or a name maps to no workspace package.
failed_test_dirs() {
  [[ -n "$check_log" && -s "$check_log" ]] || return 1
  local list tok pkg d found=0
  list=$(sed $'s/\033\\[[0-9;]*m//g' "$check_log" | sed -nE 's/^[[:space:]]*Failed:[[:space:]]+//p' | tr ',' '\n')
  while read -r tok; do
    [[ -n "$tok" ]] || continue
    [[ "$tok" == *"#test" ]] || return 1
    pkg=${tok%"#test"}; found=0
    for d in apps/*/package.json packages/*/package.json; do
      [[ -f "$d" ]] || continue
      if [[ "$(node -p "require('./$d').name" 2>/dev/null)" == "$pkg" ]]; then dirname "$d"; found=1; break; fi
    done
    (( found )) || return 1
  done <<<"$list"
  [[ -n "$list" ]]
}

# Count of lines in the log, color codes stripped, that match an extended regex. grep reads the whole stream (never -q on
# a pipe: it exits at the first match, sed gets SIGPIPE on a long log, and pipefail then reports no match).
log_count() {
  [[ -n "$check_log" && -s "$check_log" ]] || { echo 0; return 0; }
  sed $'s/\033\\[[0-9;]*m//g' "$check_log" | grep -cE "$@" || true
}

# True when the log shows vitest's own unhandled error report ("Vitest caught 1 unhandled error", the "Unhandled Errors"
# header): that run failed without a FAIL line for it. An app log line that says "unhandled error" does not count.
has_unhandled_errors() {
  (( $(log_count -i 'Vitest caught [0-9]+ unhandled|⎯ Unhandled (Errors?|Rejections?) ⎯') > 0 ))
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

# The root guard tests: the .test.mjs files named by the root package.json `test` script, so the list lives in one place.
root_guard_tests() {
  node -e '
    const fs = require("fs");
    for (const f of require("./package.json").scripts?.test?.split(/\s+/) ?? [])
      if (f.endsWith(".test.mjs") && fs.existsSync(f)) console.log(f);
  '
}

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
          prettier_check "${#existing[@]} files" "${existing[@]}"
        fi
        ;;
      typecheck|test)
        if [[ ${#scope_dirs[@]} -gt 0 ]]; then
          echo "==> turbo $t (${#scope_dirs[@]} changed packages + dependents)"
          cont=(); [[ "$t" == test && "${CHECK_RETRY_FAILED_TESTS:-}" == 1 ]] && cont=(--continue)
          run pnpm exec turbo run "$t" --concurrency=$conc ${cont[@]+"${cont[@]}"} "${filters[@]}" || failed+=("$t")
        else
          echo "==> $t: no workspace package changed, nothing to run"
        fi
        if [[ "$t" == "test" ]]; then
          web_in_scope=0
          if [[ ${#scope_dirs[@]} -gt 0 ]]; then
            scoped=$(pnpm ls -r --depth -1 --parseable "${filters[@]}" 2>/dev/null || true)
            [[ $'\n'"$scoped"$'\n' == *"/apps/web"$'\n'* ]] && web_in_scope=1
          fi
          [[ -n "$(root_guard_tests)" ]] || { echo "check: the package.json \`test\` script names no .test.mjs files." >&2; failed+=(guard-tests); }
          mapfile -t guards < <(root_guard_tests | grep -vFx scripts/open-pr.test.mjs || true)
          if has_changed scripts/open-pr.sh 'scripts/lib/*' scripts/open-pr.test.mjs; then guards+=(scripts/open-pr.test.mjs); fi
          if [[ ${#guards[@]} -gt 0 ]]; then
            echo "==> root guard tests (${#guards[@]} files)"
            run node --test "${guards[@]}" || failed+=(guard-tests)
          fi
          if has_changed '.claude/skills/verify-app-ui/*' '.claude/skills/verify-landing/*' && (( ! web_in_scope )); then
            echo "==> web tests (verify-assumptions reads the verify skills' assumptions)"
            run "$pm" --filter web test || failed+=(verify-assumptions)
          fi
          # label | script | files whose change runs it (globs allowed)
          script_tests=(
            "commit-msg-tests|scripts/test-commit-msg.sh|.githooks/commit-msg scripts/test-commit-msg.sh"
            "pre-commit-tests|scripts/test-pre-commit.sh|.githooks/pre-commit scripts/test-pre-commit.sh .gitattributes"
            "rules-tests|scripts/test-rules.sh|scripts/lib/rules.sh scripts/test-rules.sh .githooks/pre-push"
            "check-retry-tests|scripts/test-check-retry.sh|scripts/check.sh scripts/test-check-retry.sh scripts/lib/result.sh scripts/lib/result-check.mjs scripts/fixtures/check-flaky-*.txt"
            "check-guards-tests|scripts/test-check-guards.sh|scripts/test-check-guards.sh scripts/lib/result.sh"
            "disk-tests|scripts/test-disk-preflight.sh|scripts/lib/disk.sh scripts/test-disk-preflight.sh"
            "result-tests|scripts/test-result.sh|scripts/lib/result.sh scripts/lib/result-check.mjs scripts/test-result.sh"
            "merge-pr-tests|scripts/test-merge-pr.sh|scripts/merge-pr.sh scripts/test-merge-pr*.sh scripts/lib/*.sh"
          )
          for entry in "${script_tests[@]}"; do
            IFS="|" read -r label script inputs <<<"$entry"
            read -ra inputs <<<"$inputs"
            if has_changed "${inputs[@]}"; then
              echo "==> $script"
              run "$script" || failed+=("$label")
            fi
          done
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
      if [[ "$t" == lint && "$pm" == pnpm ]]; then prettier_check "whole repo" .; fi
    elif [[ "${STRICT_SCRIPTS:-0}" == "1" ]]; then
      echo "check: package.json has no '$t' script (STRICT_SCRIPTS=1)." >&2
      failed+=("$t")
    else
      echo "check: warning: package.json has no '$t' script." >&2
    fi
  done

  if [[ " ${tasks[*]} " == *" test "* ]]; then
    for t in test-commit-msg test-pre-commit test-merge-pr test-result test-disk-preflight test-check-retry test-check-guards test-rules; do
      echo "==> scripts/$t.sh"
      run "scripts/$t.sh" || failed+=("$t")
    done
  fi
fi

# Retry (CHECK_RETRY_FAILED_TESTS=1, see the header): sets failed=() when every failed file passes alone.
retry_attempted=0; still_failing=(); passed_on_retry=()
retry_failed_tests() {
  [[ "${CHECK_RETRY_FAILED_TESTS:-}" == 1 && ${#failed[@]} -eq 1 && "${failed[0]}" == test ]] || return 0
  (( changed_mode && ! dry )) || return 0
  local files=() f d rel max=${CHECK_RETRY_MAX_FILES:-5} failed_dirs=() covered=" " dirs_out
  [[ "$max" =~ ^[0-9]+$ ]] || max=5
  mapfile -t files < <(failed_test_files)
  [[ ${#files[@]} -gt 0 ]] || return 0
  if has_unhandled_errors; then
    echo "check: the test output has an unhandled error; not retrying, a retry of the failed files would not cover it."
    return 0
  fi
  for f in "${files[@]}"; do covered+="$(cut -d/ -f1-2 <<<"$f") "; done
  if ! dirs_out=$(failed_test_dirs); then
    echo "check: turbo's failed packages are not known; not retrying."
    return 0
  fi
  mapfile -t failed_dirs <<<"$dirs_out"
  for d in "${failed_dirs[@]}"; do
    if [[ "$covered" != *" $d "* ]]; then
      echo "check: $d failed without a failed test file to retry; not retrying."
      return 0
    fi
  done
  if (( ${#files[@]} > max )); then
    echo "check: ${#files[@]} test files failed (more than $max); not retrying, this looks like a real failure."
    return 0
  fi
  retry_attempted=1
  for f in "${files[@]}"; do
    case "$f" in
      apps/*/*|packages/*/*) d=$(cut -d/ -f1-2 <<<"$f"); rel=${f#"$d/"} ;;
      *) still_failing+=("$f"); continue ;;
    esac
    echo "==> retry once: $f"
    if run pnpm --dir "$d" run test "$rel"; then passed_on_retry+=("$f"); else still_failing+=("$f"); fi
  done
  if [[ ${#still_failing[@]} -eq 0 ]]; then
    failed=()
    echo "WARN passed only on retry: ${passed_on_retry[*]}"
    result_retried "${passed_on_retry[@]}"
  else
    echo "check: failed again on retry: ${still_failing[*]}" >&2
  fi
}
retry_failed_tests

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
  if [[ "$cause" == test ]] && (( $(log_count '^([A-Za-z0-9@/_.-]+:test: )? *Error: (Hook|Test) timed out in [0-9]+ ?ms') > 0 )); then cause=timing-test; fi
  mapfile -t failing_files < <(failed_test_files)
  if (( retry_attempted )); then failing_files=("${still_failing[@]}"); fi
  [[ ${#failing_files[@]} -eq 0 ]] || result_file "${failing_files[@]}"
  [[ -z "$check_log" ]] || result_log "$check_log"
  rerun="scripts/check.sh"; (( ! changed_mode )) || rerun+=" --changed"
  result_fail "$cause" "failed: ${failed[*]}" "$rerun ${tasks[*]}"
  exit 1
fi
result_ok "all passed ($mode_desc)$( (( ! dry )) || echo ', dry run')$( (( ${#passed_on_retry[@]} == 0 )) || echo ", passed only on retry: ${passed_on_retry[*]}")"
if (( dry )); then echo "check: dry run, nothing ran ($mode_desc)"; else echo "check: all passed ($mode_desc)"; fi
