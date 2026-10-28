# The invariant verify tier cases of scripts/test-review-pr.sh. Sourced by it: uses its helpers, stubs and the throwaway repos.
# A PR that touches the stack runs both stub checkers at VERIFY_TIER=invariant from apps/web, classified against main's
# known-findings.json minus the entries the PR deletes (here: app-ui lists 20; landing has no file, so an empty list).
export REVIEW_TEST_VERIFY_CALLS=$tmp/verify-calls
export VERIFY_TIMEOUT=60
passing="$tmp/pass.txt"
printf 'PASS 01 [invariant] a: ok | rule: r\nPASS 20 [invariant] b: ok | rule: r\n2 PASS, 0 FAIL, 0 STALE [tier invariant]\n' >"$passing"
known_fail="$tmp/known-fail.txt"
printf 'PASS 01 [invariant] a: ok | rule: r\nFAIL 20 [invariant] text-contrast: 8 of 455 text nodes fail | rule: r\n1 PASS, 1 FAIL, 0 STALE: 20 [tier invariant]\n' >"$known_fail"
new_fail="$tmp/new-fail.txt"
printf 'PASS 01 [invariant] a: ok | rule: r\nFAIL 20 [invariant] text-contrast: known | rule: r\nFAIL 21 [invariant] alerts-have-role: %s | rule: r\n1 PASS, 1 FAIL, 0 STALE: 21 [tier invariant]\n' "$(printf 'z%.0s' {1..200})" >"$new_fail"
export REVIEW_TEST_APP_UI_OUT=$known_fail REVIEW_TEST_LANDING_OUT=$passing
export REVIEW_TEST_APP_UI_EXIT=1 REVIEW_TEST_LANDING_EXIT=0
calls() { grep -c . "$REVIEW_TEST_VERIFY_CALLS" || true; }
mark() { calls_before=$(calls); }
want_calls() { local got=$(( $(calls) - calls_before )); [[ $got -eq "$2" ]] || fail "$1" "verify checkers ran $got times, want $2"; }
verify_result() { local f=$PR_RESULT_DIR/opencv-review-pr-1.json; grep -qF -- "$1" "$f" || fail "result file" "no '$1' in $(cat "$f")"; }
fresh_pr() { git -C "$work" checkout -q "$REVIEW_TEST_BRANCH"; git -C "$work" reset -q --hard main; }
web_n=0
touch_web() { web_n=$((web_n + 1)); mkdir -p "$work/apps/web"; echo "ui$web_n" >"$work/apps/web/page.txt"; }
app_list() { printf '%s\n' "$1" >"$work/.claude/skills/verify-app-ui/known-findings.json"; }
entry20='{"id":"20","issue":553,"since":"2026-10-29","note":"contrast"}'
entry21='{"id":"21","issue":9,"since":"2026-10-29","note":"own"}'

fresh_pr
mkdir -p "$work/docs" && echo notes >"$work/docs/notes.md"
pr_commit "docs only"
: >"$REVIEW_TEST_VERIFY_CALLS"
mark
run --no-install
expect "a docs-only PR skips the verify tier" 0 "the verify tier is skipped" "RESULT: OK"
want_calls "docs only" 0

touch_web
pr_commit "touch the web app"
mark
run --no-install
expect "a known FAIL passes" 0 "verify-app-ui invariant tier: pass" "verify-landing invariant tier: pass" "RESULT: OK"
want_calls "known fail" 2
grep -qE '^app-ui PORT=445[02468] VERIFY_TIER=invariant cwd=apps/web$' "$REVIEW_TEST_VERIFY_CALLS" || fail "ports" "app-ui call: $(cat "$REVIEW_TEST_VERIFY_CALLS")"
grep -qE '^landing PORT=[0-9]+ VERIFY_TIER=invariant cwd=apps/web$' "$REVIEW_TEST_VERIFY_CALLS" || fail "ports" "landing call: $(cat "$REVIEW_TEST_VERIFY_CALLS")"
[[ -f $PR_RESULT_DIR/review-pr-1-verify-app-ui.log ]] || fail "logs" "no app-ui log under the result directory"
mark
run --no-install
expect "a passing verify tier is cached" 0 "verify invariant tier passed for this exact tree" "RESULT: OK"
want_calls "verify cached" 0
run --no-install --no-cache
expect "--no-cache reruns the verify tier" 0 "verify-app-ui invariant tier: pass"
want_calls "verify no-cache" 2

# Another review holds the lock files of the first pair, so this one takes the next pair.
mkdir -p "$tmp/locks"
exec 8>"$tmp/locks/4450.lock"
flock -n 8
mark
run --no-install --no-cache
exec 8>&-
expect "a locked port pair is skipped" 0 "verify-app-ui invariant tier: pass"
grep -qE '^app-ui PORT=(4452|4454|4456|4458) ' <(tail -2 "$REVIEW_TEST_VERIFY_CALLS") || fail "lock" "app-ui used a locked pair: $(tail -2 "$REVIEW_TEST_VERIFY_CALLS")"

# Any feed to the stack runs the tier, not only apps/web.
fresh_pr
mkdir -p "$work/apps/api" && echo api >"$work/apps/api/x.txt"
pr_commit "touch the api"
mark
run --no-install
expect "an api change runs the verify tier" 0 "verify-app-ui invariant tier: pass"
want_calls "api change" 2

# A NEW FAIL is rerun once and counts only when it fails in both runs. Both runs' text is printed.
fresh_pr; touch_web; pr_commit "a new tree for the failing cases, so no cached pass answers them"
mark
REVIEW_TEST_APP_UI_OUT=$new_fail run --no-install
expect "a consistent new FAIL fails the review" 1 "rerunning once" "NEW FAIL 21 alerts-have-role: zzzz" "| run 1: zzzz" "review-pr-1-verify-app-ui-run2.log" "RESULT: FAIL"
absent "new fail" "$(printf 'z%.0s' {1..170})"
want_calls "consistent new fail" 3
result status=fail cause=test
verify_result "review-pr-1-verify-app-ui.log"

mark
REVIEW_TEST_APP_UI_OUT=$passing REVIEW_TEST_APP_UI_EXIT=0 run --no-install
expect "a fixed finding that is still listed fails" 1 "FIXED, still listed in known-findings.json 20 b" "RESULT: FAIL"
want_calls "fixed" 2

printf 'PASS 01 [invariant] a: ok | rule: r\nSTALE 04 [invariant] stub: not judged: coach turn | rule: r\n1 PASS, 0 FAIL, 1 STALE: 04 [tier invariant]\n' >"$tmp/stale.txt"
mark
REVIEW_TEST_APP_UI_OUT=$tmp/stale.txt REVIEW_TEST_APP_UI_EXIT=3 run --no-install
expect "a STALE fails the review and is not retried" 1 "STALE 04 stub: not judged: coach turn" "RESULT: FAIL"
want_calls "stale" 2

printf 'PASS 01 [invariant] a: ok | rule: r\nFAIL 20 [invariant] text-contrast: still bad | rule: r\nFAIL 33 [invariant] landing-only: bad | rule: r\n' >"$tmp/landing-fail.txt"
mark
REVIEW_TEST_LANDING_OUT=$tmp/landing-fail.txt REVIEW_TEST_LANDING_EXIT=1 run --no-install
expect "the landing list is its own (20 is not listed there)" 1 "verify-app-ui invariant tier: pass" "verify-landing invariant tier: NEW FAIL 20" "verify-landing invariant tier: NEW FAIL 33"
want_calls "landing own list" 3

printf 'PASS 01 [invariant] a: ok | rule: r\n' >"$tmp/missing.txt"
REVIEW_TEST_LANDING_OUT=$tmp/missing.txt run --no-install
expect "an invariant check main expects but the run did not report fails" 1 "verify-landing invariant tier: MISSING 20: the checker did not report this invariant check"

# The exit code of the checker reaches the gate unchanged: 2, 130 and a timeout are errors, never a pass.
printf 'verify-app-ui error: chrome did not start\n' >"$tmp/error.txt"
mark
REVIEW_TEST_APP_UI_OUT=$tmp/error.txt REVIEW_TEST_APP_UI_EXIT=2 run --no-install
expect "a checker exit 2 fails the review and is not retried" 1 "ERROR -: checker exited 2: verify-app-ui error: chrome did not start" "RESULT: FAIL"
want_calls "exit 2" 2
REVIEW_TEST_APP_UI_OUT=$tmp/error.txt REVIEW_TEST_APP_UI_EXIT=130 run --no-install
expect "a checker exit 130 reaches the gate unchanged" 1 "ERROR -: checker exited 130: verify-app-ui error: chrome did not start"
REVIEW_TEST_SLEEP=5000 VERIFY_TIMEOUT=1 run --no-install
expect "a hung checker is an error, not a hold on the slot" 1 "checker timed out"

# A taken port (exit 2 saying so) is retried once on the next free pair; a second taken port fails.
printf 'verify-app-ui error: port 4450 is in use; stop whatever holds it or pick another PORT\n' >"$tmp/in-use.txt"
mark
REVIEW_TEST_APP_UI_OUT=$tmp/in-use.txt REVIEW_TEST_APP_UI_EXIT=2 run --no-install
expect "a second taken port fails the review" 1 "ERROR -: checker exited 2: verify-app-ui error: port 4450 is in use"
want_calls "port retry once" 3

before=$(calls)
CHROME_BIN= HOME=$tmp/nohome run --no-install
expect "a missing browser fails with the install hint" 1 "verify tier needs a browser" "playwright install chromium" "RESULT: FAIL"
[[ $(calls) -eq "$before" ]] || fail "no browser" "a checker ran without a browser"

mark
run --no-install
expect "a failed verify tier is not cached" 0 "verify-app-ui invariant tier: pass" "RESULT: OK"
absent "failed verify" "(cached;"
want_calls "failed verify rerun" 2

# Cases that pass after a rerun or a retry run uncached, so the passes do not answer the failing cases above.
mark
REVIEW_TEST_APP_UI_OUT=$new_fail REVIEW_TEST_APP_UI_OUT2=$known_fail run --no-install --no-cache
expect "a flaky new FAIL (FAIL then PASS) passes with a note" 0 "rerunning once" "FLAKY 21 alerts-have-role: NEW FAIL in run 1 only" "verify-app-ui invariant tier: pass" "RESULT: OK"
want_calls "flaky" 3

mark
REVIEW_TEST_APP_UI_OUT=$tmp/in-use.txt REVIEW_TEST_APP_UI_EXIT=2 REVIEW_TEST_APP_UI_OUT2=$known_fail REVIEW_TEST_APP_UI_EXIT2=1 run --no-install --no-cache
expect "a taken port is retried on the next pair" 0 "verify-app-ui invariant tier: pass" "RESULT: OK"
want_calls "port retry" 3
[[ $(grep '^app-ui ' "$REVIEW_TEST_VERIFY_CALLS" | tail -2 | awk '{print $2}' | sort -u | wc -l) -eq 2 ]] || fail "port retry" "same port twice: $(tail -3 "$REVIEW_TEST_VERIFY_CALLS")"

# The allowed list is main's minus what the PR deletes. A fix PR removes its entry: the check now passes and the PR is OK.
fresh_pr; touch_web; app_list '[]'
pr_commit "fix 20 and remove its entry"
mark
REVIEW_TEST_APP_UI_OUT=$passing REVIEW_TEST_APP_UI_EXIT=0 run --no-install
expect "a PR that removes its entry while the check passes is OK" 0 "verify-app-ui invariant tier: pass" "so the review must read that diff: .claude/skills/verify-app-ui/known-findings.json" "RESULT: OK"
want_calls "removes entry, check passes" 2
# ...and while the check still FAILs it is a NEW FAIL.
mark
run --no-install --no-cache
expect "a PR that removes its entry while the check still FAILs is a NEW FAIL" 1 "verify-app-ui invariant tier: NEW FAIL 20 text-contrast: 8 of 455 text nodes fail | run 1: 8 of 455" "RESULT: FAIL"
want_calls "removes entry, check fails" 3

# A list-only PR that adds an entry is OK and skips the tier. The same entry in a PR that changes anything else fails.
fresh_pr; app_list "[$entry20,$entry21]"
pr_commit "list 21"
mark
run --no-install
expect "a list-only PR that adds an entry is OK and skips the tier" 0 "adds known finding(s) (verify-app-ui:21 ) and changes nothing else, so the verify tier is skipped" "RESULT: OK"
want_calls "list only adds" 0
fresh_pr; touch_web; app_list "[$entry20,$entry21]"
pr_commit "list 21 and change the web app"
mark
run --no-install
expect "a PR that adds an entry and changes anything else fails" 1 "adds known finding(s) (verify-app-ui:21 ) and changes other files; land the entry in its own PR, with its issue, that changes only known-findings.json" "RESULT: FAIL"
absent "mixed list PR" "web build passed"
want_calls "mixed adds" 0
# A list-only PR that only removes an entry still runs the tier.
fresh_pr; app_list '[]'
pr_commit "unlist 20 only"
mark
REVIEW_TEST_APP_UI_OUT=$passing REVIEW_TEST_APP_UI_EXIT=0 run --no-install
expect "a list-only PR that removes an entry runs the tier" 0 "verify-app-ui invariant tier: pass"
want_calls "list only removes" 2

# A PR that edits a verify:* script in apps/web/package.json, or the stack launcher, is noted and runs the tier.
fresh_pr; touch_web
printf '{\n  "scripts": {\n    "verify:app-ui": "echo FAIL"\n  }\n}\n' >"$work/apps/web/package.json"
pr_commit "redefine verify:app-ui"
GIT_CONFIG_PARAMETERS="'color.ui=always'" run --no-install
expect "a verify:* script edit is noted" 0 "edits a verify:* script in apps/web/package.json, so the review must read that diff"
fresh_pr
mkdir -p "$work/.claude/skills/verify-opencv/scripts" && echo ': launch' >"$work/.claude/skills/verify-opencv/scripts/launch.sh"
pr_commit "edit the stack launcher"
mark
run --no-install
expect "a launcher edit runs the tier and is noted" 0 "edits a verify known-findings.json or checker script" "verify-app-ui invariant tier: pass"
want_calls "launcher" 2

# A PR that drops a check from its own kinds.mjs is not expected to report it, and the edit is noted.
fresh_pr; touch_web
printf '{\n  "01": "invariant",\n  "30": "design",\n}\n' >"$work/.claude/skills/verify-landing/scripts/lib/kinds.mjs"
pr_commit "drop landing check 20 from its kinds"
REVIEW_TEST_LANDING_OUT=$tmp/missing.txt run --no-install
expect "a PR that drops a check from kinds.mjs is not held to it, and the edit is noted" 0 "verify-landing invariant tier: pass" "so the review must read that diff: .claude/skills/verify-landing/scripts/lib/kinds.mjs"

# A new known-findings.json on main reruns a verify tier that was cached.
fresh_pr
mark
touch_web
pr_commit "touch the web app again"
run --no-install
want_calls "reset" 2
run --no-install
expect "cached before main's list changes" 0 "verify invariant tier passed for this exact tree"
git -C "$work" checkout -q main
echo "[$entry20]" >"$work/.claude/skills/verify-app-ui/known-findings.json"
sed -i 's/contrast/reworded/' "$work/.claude/skills/verify-app-ui/known-findings.json"
git -C "$work" add -A && git -C "$work" commit -q -m "main edits the list" && git -C "$work" push -q origin main
git -C "$work" checkout -q "$REVIEW_TEST_BRANCH"
mark
run --no-install
expect "a changed list on main reruns the verify tier" 0 "verify-app-ui invariant tier: pass" "RESULT: OK"
want_calls "list changed" 2
