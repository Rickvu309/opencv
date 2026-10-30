#!/usr/bin/env bash
# result.sh: one JSON result per workflow script run. Source it, then:
#
#   result_begin <script> [id]      script: new-task | open-pr | merge-pr | check. Installs the EXIT trap.
#   result_id <id>                  set the id later (PR number, else the branch; "/" becomes "-")
#   result_fail <cause> <detail> [next]    status fail, first call wins (cause: see CAUSES)
#   result_human <detail> [next]    status human
#   result_ok [detail] [next]
#   result_file <path>...           files involved (conflicting files, failing test files)
#   result_retried <path>...        test files that passed only on a retry
#   result_blocked_by <pr|""> <commit> <path>...   the change on main that caused a conflict
#   result_next <command>           the exact single command to run next
#   result_log <path>
#
# On exit the trap calls `result_cleanup` if the script defines it, then writes
#   ${PR_RESULT_DIR:-$HOME/tmp/pr-results}/<repo>-<script>-<id>.json   (overwritten per run)
#   ...and appends the same line to history.jsonl in that directory,
# and prints `RESULT_JSON: <path>` as the last stdout line. A crash (non-zero exit with no result_fail/result_human)
# is status "error", and so is a kill by SIGINT, SIGTERM, SIGHUP or SIGPIPE (detail "killed by SIG<name>"). Writing never changes the exit code.
#
# Fields (all present, null when unknown): schema, script, repo, id, status (ok|fail|human|error),
# cause (none|behind-main|merge-conflict|test|timing-test|lint|typecheck|build|env|disk|hygiene|deploy|other), detail,
# files, blockedBy {pr, commit, files}, retried, next, log, startedAt (UTC ISO-8601), durSec.
# PR_RESULT_REPO overrides the repo name; PR_RESULT_ID gives a nested script the id of the script that called it.

R_SCHEMA=1
R_SCRIPT=""; R_REPO=""; R_ID=""; R_STATUS=""; R_CAUSE=""; R_DETAIL=""; R_NEXT=""; R_LOG=""; R_BLOCKED=""
R_FILES=(); R_RETRIED=()
R_START_EPOCH=0; R_START_ISO=""; R_SIGNAL=""

_r_json_str() {
  local s=$1
  s=${s//\\/\\\\}; s=${s//\"/\\\"}; s=${s//$'\n'/\\n}; s=${s//$'\r'/\\r}; s=${s//$'\t'/\\t}
  s=$(printf '%s' "$s" | LC_ALL=C tr -d '\000-\010\013\014\016-\037')
  printf '"%s"' "$s"
}
_r_json_or_null() { if [[ -n "$1" ]]; then _r_json_str "$1"; else printf 'null'; fi; }
_r_json_array() {
  local out="[" sep="" x
  for x in "$@"; do out+="$sep$(_r_json_str "$x")"; sep=","; done
  printf '%s]' "$out"
}
_r_oneline() { local s=${1//$'\n'/ }; s=${s//$'\r'/ }; printf '%s' "${s:0:300}"; }
_r_slug() { local s=${1//\//-}; s=${s//[^A-Za-z0-9._#-]/-}; printf '%s' "$s"; }

_r_repo_name() {
  [[ -z "${PR_RESULT_REPO:-}" ]] || { printf '%s' "$PR_RESULT_REPO"; return; }
  local common
  if common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) && [[ "$common" == /* ]]; then
    basename "$(dirname "$common")"
  else
    basename "$PWD"
  fi
}

result_begin() {
  R_SCRIPT=$1
  # PR_RESULT_ID is for a check.mjs run by another script; any other script names its own id.
  R_ID=$(_r_slug "${2:-$([[ "$1" != check ]] || echo "${PR_RESULT_ID:-}")}")
  R_REPO=$(_r_repo_name)
  R_START_EPOCH=$(date +%s)
  R_START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  trap '_result_exit' EXIT
  local sig n
  for sig in INT:130 TERM:143 HUP:129 PIPE:141; do
    n=${sig#*:}
    # shellcheck disable=SC2064
    trap "R_SIGNAL=${sig%:*}; exit $n" "${sig%:*}"
  done
}
result_id() { R_ID=$(_r_slug "$1"); }
result_fail() {
  [[ "$R_STATUS" != fail && "$R_STATUS" != human ]] || return 0
  R_STATUS=fail; R_CAUSE=${1:-other}; R_DETAIL=$(_r_oneline "${2:-}")
  [[ -z "${3:-}" ]] || R_NEXT=$3
}
result_human() {
  [[ "$R_STATUS" != fail && "$R_STATUS" != human ]] || return 0
  R_STATUS=human; R_CAUSE=hygiene; R_DETAIL=$(_r_oneline "${1:-}")
  [[ -z "${2:-}" ]] || R_NEXT=$2
}
result_ok() { R_STATUS=ok; R_CAUSE=none; R_DETAIL=$(_r_oneline "${1:-}"); [[ -z "${2:-}" ]] || R_NEXT=$2; }
result_file() { R_FILES+=("$@"); }
result_retried() {
  local f x
  for f in "$@"; do
    for x in ${R_RETRIED[@]+"${R_RETRIED[@]}"}; do [[ "$x" != "$f" ]] || continue 2; done
    R_RETRIED+=("$f")
  done
}
result_next() { R_NEXT=$1; }
result_log() { R_LOG=$1; }
result_blocked_by() {
  local pr=$1 commit=$2; shift 2
  local prj=null; [[ "$pr" =~ ^[0-9]+$ ]] && prj=$pr
  R_BLOCKED="{\"pr\":$prj,\"commit\":$(_r_json_str "$commit"),\"files\":$(_r_json_array "$@")}"
}

# Take cause, detail, files, next and log from the result file of a script this one ran (a failed check.mjs, say).
# Returns 1 when the file is missing, unreadable or older than this run (a leftover from an earlier run), so the caller
# can report its own cause.
result_adopt() {
  local f=$1 lines
  [[ -f "$f" ]] || return 1
  mapfile -t lines < <(node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
    if (typeof r.startedAt !== "string" || r.startedAt < process.argv[2]) process.exit(1)
    const one = (v) => String(v ?? "").replace(/\s+/g, " ")
    console.log(one(r.cause)); console.log(one(r.detail)); console.log(one(r.next)); console.log(one(r.log))
    for (const f of r.files ?? []) console.log(f)
    for (const f of r.retried ?? []) console.log("retried:" + f)
  ' "$f" "$R_START_ISO" 2>/dev/null) || return 1
  [[ ${#lines[@]} -ge 4 ]] || return 1
  local cause=${lines[0]}; [[ "$cause" != none && -n "$cause" ]] || cause=other
  result_fail "$cause" "${lines[1]}" "${lines[2]}"
  [[ -z "${lines[3]}" ]] || R_LOG=${lines[3]}
  local l
  for l in "${lines[@]:4}"; do
    case "$l" in retried:*) R_RETRIED+=("${l#retried:}") ;; *) R_FILES+=("$l") ;; esac
  done
}

# Add the `retried` files of a nested script's result file (the check.mjs that open-pr.sh ran) to this one.
result_adopt_retried() {
  local x
  [[ -f "$1" ]] || return 0
  while IFS= read -r x; do [[ -z "$x" ]] || result_retried "$x"; done < <(node -e '
    for (const f of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).retried ?? []) console.log(f)
  ' "$1" 2>/dev/null)
}

# Build the JSON line for exit code $1 and settle the status of a script that never reported one.
result_json() {
  local rc=${1:-0} now status=$R_STATUS cause=$R_CAUSE detail=$R_DETAIL
  now=$(date +%s)
  if [[ -n "$R_SIGNAL" ]]; then
    status=error; cause=other; detail="killed by SIG$R_SIGNAL"
  elif [[ -z "$status" || ( "$status" == ok && "$rc" != 0 ) ]]; then
    if [[ "$rc" == 0 ]]; then status=ok; cause=none
    else status=error; cause=other; detail="exited with code $rc before reporting a result"; fi
  fi
  [[ "$status" != ok || -n "$cause" ]] || cause=none
  printf '{"schema":%s,"script":%s,"repo":%s,"id":%s,"status":%s,"cause":%s,"detail":%s,"files":%s,"blockedBy":%s,"retried":%s,"next":%s,"log":%s,"startedAt":%s,"durSec":%s}' \
    "$R_SCHEMA" "$(_r_json_str "$R_SCRIPT")" "$(_r_json_or_null "$R_REPO")" "$(_r_json_or_null "$R_ID")" \
    "$(_r_json_str "$status")" "$(_r_json_str "$cause")" "$(_r_json_or_null "$detail")" \
    "$(_r_json_array ${R_FILES[@]+"${R_FILES[@]}"})" "${R_BLOCKED:-null}" "$(_r_json_array ${R_RETRIED[@]+"${R_RETRIED[@]}"})" \
    "$(_r_json_or_null "$R_NEXT")" "$(_r_json_or_null "$R_LOG")" "$(_r_json_str "$R_START_ISO")" "$((now - R_START_EPOCH))"
}

# Path of this run's result file; result_path check gives the one a nested check.mjs wrote for the same id.
result_path() {
  printf '%s/%s-%s-%s.json' "${PR_RESULT_DIR:-${HOME:-.}/tmp/pr-results}" "${R_REPO:-unknown}" "${1:-$R_SCRIPT}" "${R_ID:-unknown}"
}

result_write() {
  local json file dir
  json=$(result_json "${1:-0}") || return 0
  file=$(result_path); dir=$(dirname "$file")
  if mkdir -p "$dir" 2>/dev/null && printf '%s\n' "$json" >"$file.tmp.$$" 2>/dev/null && mv -f "$file.tmp.$$" "$file" 2>/dev/null; then
    printf '%s\n' "$json" >>"$dir/history.jsonl" 2>/dev/null || true
    printf 'RESULT_JSON: %s\n' "$file"
  else
    rm -f "$file.tmp.$$" 2>/dev/null || true
    printf 'RESULT_JSON: none (could not write %s)\n' "$file"
  fi
}

_result_exit() {
  local rc=$?
  trap - EXIT
  trap '' INT TERM HUP PIPE # a second signal must not skip the write
  set +e +u
  if declare -F result_cleanup >/dev/null; then result_cleanup; fi
  result_write "$rc" || true
  if [[ -n "$R_SIGNAL" ]]; then
    # Re-raise so the parent sees a death by signal, not a plain exit code.
    trap - "$R_SIGNAL"
    kill -s "$R_SIGNAL" $$
  fi
  exit "$rc"
}
