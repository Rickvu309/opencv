# verify-tier.sh: the invariant verify tier of scripts/review-pr.sh. Source it. It uses the script's globals (pr, wt,
# main_checkout, bad, ok, note) and the result.sh helpers, and classifies each checker run with lib/verify-gate.mjs.

# verify_tier_key hashes what a cached result depends on besides the tested tree: main's copy of
# each skill's known-findings.json and scripts/ tree, and the classifier. Never the PR's copies, so a PR cannot excuse its own FAIL.
verify_tier_key() {
  local skill path
  {
    for skill in verify-app-ui verify-landing; do
      for path in "known-findings.json" "scripts"; do
        git -C "$main_checkout" rev-parse --verify --quiet "origin/main:.claude/skills/$skill/$path" || echo none
      done
    done
    git hash-object "$(dirname "${BASH_SOURCE[0]}")/verify-gate.mjs"
  } | git hash-object --stdin
}
verify_browser_ok() {
  { [[ -n "${CHROME_BIN:-}" ]] && command -v "$CHROME_BIN" >/dev/null 2>&1; } ||
    compgen -G "${HOME:-/nonexistent}/.cache/ms-playwright/chromium-*/chrome-linux*/chrome" >/dev/null
}
port_answers() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
# app-ui needs the first pair PORT, PORT+1 in 4450 to 4458 where neither answers; landing takes any free port.
verify_port() {
  local p
  if [[ "$1" == app-ui ]]; then
    for p in 4450 4451 4452 4453 4454 4455 4456 4457 4458; do
      if ! port_answers "$p" && ! port_answers "$((p + 1))"; then echo "$p"; return 0; fi
    done
    return 1
  fi
  node -e 'const s = require("net").createServer(); s.listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close() })'
}
# verify_one <app-ui|landing>: run that checker in $wt at the invariant tier and classify its result against main's list.
verify_log_set=0
verify_one() {
  local name=$1 skill="verify-$1" dir log known port rc=0 try out
  dir="${PR_RESULT_DIR:-${HOME:-.}/tmp/pr-results}"
  mkdir -p "$dir"
  log="$dir/review-pr-$pr-verify-$name.log"
  known="$dir/review-pr-$pr-verify-$name.known.json"
  git -C "$main_checkout" show "origin/main:.claude/skills/$skill/known-findings.json" >"$known" 2>/dev/null || echo '[]' >"$known"
  for try in 1 2 3; do
    port=$(verify_port "$name") || { bad "$skill: no free port pair in 4450 to 4458"; result_fail env "$skill: no free port pair in 4450 to 4458"; return; }
    rc=0
    (cd "$wt" && PORT=$port VERIFY_TIER=invariant pnpm --filter web "verify:$name") >"$log" 2>&1 || rc=$?
    [[ $rc -eq 2 ]] && grep -q 'is in use' "$log" || break
  done
  out=$(node "$(dirname "${BASH_SOURCE[0]}")/verify-gate.mjs" "$log" "$rc" "$known" 2>&1) || true
  local line problems=0
  while IFS= read -r line; do
    [[ -n "$line" && "$line" != gate:* ]] || continue
    problems=$((problems + 1))
    bad "$skill invariant tier: $line (log: $log)"
    result_fail test "$skill invariant tier: $line" "read $log"
  done <<<"$out"
  if (( problems == 0 )) && [[ "$out" == gate:\ pass* ]]; then
    ok "$skill invariant tier: ${out#gate: } (log: $log)"
  elif (( problems == 0 )); then
    bad "$skill invariant tier: gate printed no verdict: ${out:0:160} (log: $log)"
    result_fail test "$skill invariant tier: gate printed no verdict" "read $log"
  fi
  if (( problems > 0 && ! verify_log_set )); then verify_log_set=1; result_log "$log"; fi
}
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
