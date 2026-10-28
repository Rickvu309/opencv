# verify-tier.sh: the invariant verify tier of scripts/review-pr.sh. Source it. It uses the script's globals (pr, wt, tree,
# main_checkout, bad, ok, note) and the result.sh helpers, and classifies each checker run with lib/verify-gate.mjs.
verify_lib=$(dirname "${BASH_SOURCE[0]}")
verify_lock_dir=${VERIFY_LOCK_DIR:-${HOME:-.}/tmp/verify-ports}
VERIFY_TIMEOUT=${VERIFY_TIMEOUT:-900}

# verify_tier_key hashes what a cached result depends on besides the tested tree (which holds the PR's own lists and
# checkers): main's copy of each skill's known-findings.json and scripts/ tree, and the classifier and this wiring.
verify_tier_key() {
  local skill path
  {
    for skill in verify-app-ui verify-landing; do
      for path in "known-findings.json" "scripts"; do
        git -C "$main_checkout" rev-parse --verify --quiet "origin/main:.claude/skills/$skill/$path" || echo none
      done
    done
    git hash-object "$verify_lib/verify-gate.mjs" "$verify_lib/verify-tier.sh"
  } | git hash-object --stdin
}
verify_browser_ok() {
  { [[ -n "${CHROME_BIN:-}" ]] && command -v "$CHROME_BIN" >/dev/null 2>&1; } ||
    compgen -G "${HOME:-/nonexistent}/.cache/ms-playwright/chromium-*/chrome-linux*/chrome" >/dev/null
}

# verify_list_adds prints "<skill> ADDED <id>" for each known finding the merge tree lists and origin/main does not,
# and "<skill> ERROR ..." for a list that does not parse.
verify_list_adds() {
  local skill path m p out line
  m=$(mktemp) p=$(mktemp) out=$(mktemp)
  for skill in verify-app-ui verify-landing; do
    path=".claude/skills/$skill/known-findings.json"
    git -C "$main_checkout" show "origin/main:$path" >"$m" 2>/dev/null || : >"$m"
    git -C "$main_checkout" show "$tree:$path" >"$p" 2>/dev/null || : >"$p"
    while IFS= read -r line; do [[ -z "$line" ]] || echo "$skill $line"; done < <(node "$verify_lib/verify-gate.mjs" list "$m" "$p" "$out" || true)
  done
  rm -f "$m" "$p" "$out"
}

port_answers() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
verify_release_ports() { [[ -z "${vfd1:-}" ]] || { exec {vfd1}>&- {vfd2}>&-; vfd1=""; vfd2=""; }; }
# verify_pick_port <app-ui|landing> <last port tried, 0 for none> sets vport. app-ui needs a pair PORT, PORT+1 with PORT in
# 4450 to 4458, stepping by 2 so two runs never overlap, where neither answers and no other review holds the lock files;
# the locks stay held until verify_release_ports. landing takes any free port.
verify_pick_port() {
  local p
  vport=""
  if [[ "$1" == app-ui ]]; then
    mkdir -p "$verify_lock_dir"
    for p in 4450 4452 4454 4456 4458; do
      (( p > $2 )) || continue
      if port_answers "$p" || port_answers "$((p + 1))"; then continue; fi
      exec {vfd1}>"$verify_lock_dir/$p.lock" {vfd2}>"$verify_lock_dir/$((p + 1)).lock"
      if ! command -v flock >/dev/null 2>&1 || { flock -n "$vfd1" && flock -n "$vfd2"; }; then vport=$p; return 0; fi
      verify_release_ports
    done
    return 1
  fi
  vport=$(node -e 'const s = require("net").createServer(); s.listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close() })') && [[ -n "$vport" ]]
}
# verify_run <name> <log> <last port tried> runs the checker once from apps/web (where pnpm --filter web runs it), so its
# exit code reaches the gate unchanged. Sets vrc; returns 1 when no port is free.
verify_run() {
  verify_pick_port "$1" "$3" || return 1
  vrc=0
  (
    [[ -z "${vfd1:-}" ]] || exec {vfd1}>&- {vfd2}>&-
    cd "$wt/apps/web" && PORT=$vport VERIFY_TIER=invariant exec timeout "$VERIFY_TIMEOUT" node "../../.claude/skills/verify-$1/scripts/verify-$1.mjs"
  ) >"$2" 2>&1 || vrc=$?
  verify_release_ports
}
# verify_attempt <name> <log> runs the checker, and once more on the next free port when exit 2 says its port was taken.
verify_attempt() {
  verify_run "$1" "$2" 0 || return 1
  if [[ $vrc -eq 2 ]] && grep -qE 'is in use|already answers' "$2"; then verify_run "$1" "$2" "$vport" || return 1; fi
}
# verify_one <app-ui|landing>: run that checker in $wt at the invariant tier and classify its result. The allowed list is
# origin/main's known-findings.json minus the entries the PR deletes, so a PR never excuses its own FAIL, and a fix PR
# removes its entry. The expected ids are main's invariant ids that the PR's kinds.mjs still lists.
verify_one() {
  local name=$1 skill="verify-$1" dir log log2 main_known pr_known known expect out line problems=0 logs rc1
  dir="${PR_RESULT_DIR:-${HOME:-.}/tmp/pr-results}"
  mkdir -p "$dir"
  log="$dir/review-pr-$pr-verify-$name.log"; log2="$dir/review-pr-$pr-verify-$name-run2.log"
  main_known="$dir/review-pr-$pr-verify-$name.main.json"; pr_known="$dir/review-pr-$pr-verify-$name.pr.json"
  known="$dir/review-pr-$pr-verify-$name.known.json"; expect="$dir/review-pr-$pr-verify-$name.expect.json"
  git -C "$main_checkout" show "origin/main:.claude/skills/$skill/known-findings.json" >"$main_known" 2>/dev/null || : >"$main_known"
  cp "$wt/.claude/skills/$skill/known-findings.json" "$pr_known" 2>/dev/null || : >"$pr_known"
  node "$verify_lib/verify-gate.mjs" list "$main_known" "$pr_known" "$known" >/dev/null || echo '[]' >"$known"
  git -C "$main_checkout" show "origin/main:.claude/skills/$skill/scripts/lib/kinds.mjs" >"$dir/review-pr-$pr-verify-$name.main-kinds.mjs" 2>/dev/null || : >"$dir/review-pr-$pr-verify-$name.main-kinds.mjs"
  node "$verify_lib/verify-gate.mjs" expect "$dir/review-pr-$pr-verify-$name.main-kinds.mjs" "$wt/.claude/skills/$skill/scripts/lib/kinds.mjs" "$expect"
  if ! verify_attempt "$name" "$log"; then
    bad "$skill: no free port pair in 4450 to 4458 for the invariant tier (log: $log)"; result_fail env "$skill: no free port" "read $log"; return
  fi
  rc1=$vrc; logs=$log
  out=$(node "$verify_lib/verify-gate.mjs" check --log "$log" --exit "$rc1" --known "$known" --expect "$expect" 2>&1) || true
  if grep -q '^NEW FAIL ' <<<"$out" && ! grep -qE '^(STALE|ERROR) ' <<<"$out"; then
    note "$skill: NEW FAIL in the first run, rerunning once; it counts only when it fails in both runs"
    if ! verify_attempt "$name" "$log2"; then
      bad "$skill: no free port pair in 4450 to 4458 for the rerun (log: $log)"; result_fail env "$skill: no free port" "read $log"; return
    fi
    logs="$log, $log2"
    out=$(node "$verify_lib/verify-gate.mjs" check --log "$log" --exit "$rc1" --known "$known" --expect "$expect" --log2 "$log2" --exit2 "$vrc" 2>&1) || true
  fi
  while IFS= read -r line; do
    [[ -n "$line" && "$line" != gate:* ]] || continue
    if [[ "$line" == FLAKY\ * ]]; then note "$skill invariant tier: $line (logs: $logs)"; continue; fi
    problems=$((problems + 1))
    bad "$skill invariant tier: $line (log: $logs)"
    result_fail test "$skill invariant tier: $line" "read $log"
  done <<<"$out"
  if (( problems == 0 )) && [[ "$out" == *gate:\ pass* ]]; then
    ok "$skill invariant tier: $(grep '^gate: ' <<<"$out" | tail -1 | sed 's/^gate: //') (log: $logs)"
  elif (( problems == 0 )); then
    bad "$skill invariant tier: gate printed no verdict: ${out:0:160} (log: $log)"
    result_fail test "$skill invariant tier: gate printed no verdict" "read $log"
  fi
  if (( problems > 0 && ! verify_log_set )); then verify_log_set=1; result_log "$log"; fi
}
verify_log_set=0
run_verify_tier() {
  if ! verify_browser_ok; then
    bad "verify tier needs a browser: no CHROME_BIN and no Chromium in ~/.cache/ms-playwright (install one with 'pnpm dlx playwright install chromium', or set CHROME_BIN)"
    result_fail env "verify tier needs a browser" "pnpm dlx playwright install chromium"
    return
  fi
  note "running the invariant verify tier (app-ui, then landing)"
  verify_one app-ui
  verify_one landing
}
