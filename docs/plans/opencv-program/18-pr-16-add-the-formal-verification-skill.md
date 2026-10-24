## Add the formal verification skill for the Apply scan URL guard (PR-16)

**Depends on.** PR-15.

**Files.**

- [ ] Create `.claude/skills/verify-apply-scan-guard/SKILL.md`.
- [ ] Create `apps/api/src/apply/fetch-posting.formal.test.ts`.
- [ ] Create `apps/api/vitest.formal.config.ts`.
- [ ] Edit `apps/api/vitest.config.ts` (add `**/*.formal.test.ts` to `exclude`, lines 4-10).
- [ ] Edit `apps/api/package.json` (add the `test:formal` script beside `test` at line 15 and the dev dependency `fast-check`).
- [ ] Edit `pnpm-lock.yaml`.

**Build.**

- [ ] Write `fetch-posting.formal.test.ts` against the real exports `assertPublicApplyScanUrl` (`apps/api/src/apply/fetch-posting.ts` line 69), `isBlockedApplyScanHost` (line 52) and `createFetchJobPosting` (line 97). The private `hostFromHttpUrl` (line 63) is reached through them, so no product export is added and no product code changes.
- [ ] Property 1, no bad URL reaches fetch. Build the real `createFetchJobPosting({ fetchImpl: spy, lookupImpl: null })` and also a variant with a lenient `lookupImpl` that always resolves to the public address `93.184.216.34`. With `fast-check`, generate a scheme from `http`, `https`, `ftp`, `file`, `javascript`, `data`, a userinfo from none, `user@` and `user:pw@`, an optional port, a path, and a host from loopback, link-local, private, CGNAT and `.localhost`, `.local`, `.internal` names plus the literals in `BLOCKED_HOSTS` (line 17). Assert `spy` was never called and the result is `ok:false`.
- [ ] Property 2, no public hostname is refused. Generate http and https URLs with any port and userinfo and a host from random DNS labels and random public IPv4 quads outside the private ranges in `isPrivateIPv4` (lines 24-39). Include the named regression hosts `fda.gov`, `fdic.gov` and `fcbarcelona.com`. Assert `assertPublicApplyScanUrl(url)` returns `ok:true`.
- [ ] Bounded exhaustive sweep. Enumerate the full product of 7 schemes, 3 userinfos, 3 ports (none, `:80`, `:8443`), 4 path tails (empty, `/x`, `?q=1`, `#f`) and a fixed host list of about 28 entries (21 blocked, 7 public). Assert the expected verdict for every tuple. The expected verdict is written once as a small table in the test, not derived from the code under test.
- [ ] Add `vitest.formal.config.ts` that includes only `src/**/*.formal.test.ts`, and exclude that glob from `vitest.config.ts` so `pnpm --filter api test` stays green on trunk while the check is red. The script is `"test:formal": "vitest run --config vitest.formal.config.ts"`. PR-5 deletes the exclusion when it turns the check green.
- [ ] Write `SKILL.md` with frontmatter `name: verify-apply-scan-guard` and a `description` naming the Apply scan SSRF boundary and when to use it (any change to `fetch-posting.ts` or to `openableApplyJobUrl` in `packages/domain/src/apply.ts` line 131). Sections are the property in one plain sentence, the harm in one sentence, why the tool was chosen, how to run, how to read a counterexample, bounds and assumptions, the coverage record, known findings, and the rule for moving the sync commit.
- [ ] Say in the skill that TypeScript has no production verifier for this code, so the tool is `fast-check` property tests over the real functions plus a bounded exhaustive sweep, and that a pass covers the generated and enumerated inputs, not every string.
- [ ] State the property as "No URL whose resolved host is loopback, link-local, private, or a non-http(s) scheme, with or without port or userinfo, ever reaches fetch, and no public hostname is refused." State the harm as "A job-posting URL aimed at the server's own network lets a user read internal services or cloud metadata through the Apply scan, and a wrong refusal blocks scans for real employers."
- [ ] Record two findings with counterexamples in the code's terms, not as weakened properties. F1 maps to api-quality finding 3. `isBlockedApplyScanHost("fda.gov")` returns true because `isPrivateIPv6` at line 44 runs on every hostname and `startsWith("fd")` matches, so `assertPublicApplyScanUrl("https://fda.gov/jobs/1")` returns `ok:false`. F2 maps to api-quality finding 4. `hostFromHttpUrl` (lines 63-67) keeps userinfo and port, so `assertPublicApplyScanUrl("http://user@127.0.0.1/x")` returns `ok:true` with no lookup, and with a lookup only a failing `dns.lookup("user@127.0.0.1")` stops it.
- [ ] Write the coverage record. Files `apps/api/src/apply/fetch-posting.ts` and `packages/domain/src/apply.ts`. Functions `isPrivateIPv4`, `isPrivateIPv6`, `isBlockedApplyScanHost`, `hostFromHttpUrl`, `assertPublicApplyScanUrl`, `createFetchJobPosting`, `openableApplyJobUrl`. Sync commit is the trunk SHA the PR branch was cut from (`git rev-parse origin/main` at PR time; `d722d6b0a4036abdf5bcdf37e2a14277803cc7b0` at planning time). The rule says to move the sync commit forward only after rereading the covered functions at the new commit, rerunning the check, and confirming every table row still describes the code.
- [ ] List what is not covered. DNS rebinding and single-address lookup (api-quality finding 6), the unbounded `arrayBuffer()` read (finding 5), redirect hops after the first, decimal or octal IPv4 forms such as `2130706433`, and IPv4-mapped IPv6 in hex form such as `::ffff:7f00:1`. If a later run probes one of these and it fails, it is a new finding, not a reason to shrink the grammar.
- [ ] Prove the skill on a scratch mutation per its own step. Delete the `a === 192 && b === 168` line (line 36) and confirm the check names a `192.168.x.y` counterexample. Revert and confirm the check is back to exactly F1 and F2. Repeat with the `.localhost` clause in `isBlockedApplyScanHost` and with the `https?` scheme test in `openableApplyJobUrl`.

**You see.**

- [ ] `pnpm --filter api test:formal` exits non-zero in under 10 seconds and prints exactly two failing tests, one with the counterexample `https://fda.gov/jobs/1` and one with `http://user@127.0.0.1/x`.
- [ ] `pnpm --filter api test` does not list `fetch-posting.formal.test.ts` and still shows the trunk baseline (384 pass, 5 time out at 5000 ms).
- [ ] With the `192.168` line deleted, `pnpm --filter api test:formal` prints a third failing test whose counterexample starts with `192.168.`, and after `git checkout apps/api/src/apply/fetch-posting.ts` it is back to two.
- [ ] `.claude/skills/verify-apply-scan-guard/SKILL.md` opens with frontmatter and its coverage record cites `fetch-posting.ts` lines 41, 52, 63 and 69.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api/src/apply/fetch-posting.formal.test.ts` gains the two properties and the sweep. At trunk the file does not exist, so the first red is the missing file. Then it is red on F1 and F2 only, and the sweep reports the same two tuples. Run `pnpm --filter api test:formal`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `pnpm --filter api test` at trunk and at head. If trunk lacks the formal check, record that, and gate that head adds the `test:formal` script and that the default run lists the same 5 timeouts and no new failure. Save `default-suite-trunk-vs-head.png`. Pass when pass and fail counts match trunk apart from file totals.
- [ ] Lane 2. Run `pnpm --filter api test:formal` at head from a clean checkout. Save `formal-red-two.png`. Pass when the exit code is non-zero and the output names exactly two failing tests, labelled F1 and F2.
- [ ] Lane 3. Read the F1 counterexample as the skill says. Pass when the output contains `fda.gov` and the skill's "how to read a counterexample" section lets a reader name `isPrivateIPv6` line 44 from it. Save `counterexample-f1.png`.
- [ ] Lane 4. Read the F2 counterexample the same way. Save `counterexample-f2.png`. Pass when the output contains `user@127.0.0.1` and the result `ok:true`, and the skill points to `hostFromHttpUrl`.
- [ ] Lane 5. Time `pnpm --filter api test:formal` five times. Save `formal-timing.png`. Pass when every run is under 10 seconds wall and the sweep test reports the same tuple count each time.
- [ ] Lane 6. Scratch mutation A. Delete the `a === 192 && b === 168` line in `apps/api/src/apply/fetch-posting.ts`. Save `mutation-192-168.png`. Pass when the formal run has three failures and the new one's counterexample host starts with `192.168.`, and after `git checkout` of that file it returns to two.
- [ ] Lane 7. Scratch mutation B. Remove the `h.endsWith(".localhost")` clause in `isBlockedApplyScanHost`. Save `mutation-localhost.png`. Pass when a counterexample host ends in `.localhost`, and the revert returns the run to two failures.
- [ ] Lane 8. Scratch mutation C. In `packages/domain/src/apply.ts` change the `/^https?:\/\//i` test in `openableApplyJobUrl` to also accept `ftp://`. Save `mutation-scheme.png`. Pass when the scheme property fails with an `ftp:` counterexample, and the revert returns the run to two failures.
- [ ] Lane 9. Apply the two fixes from api-quality findings 3 and 4 on a scratch branch (call `isPrivateIPv6` only when the host contains `:`, and take the host from `new URL(openable).hostname`). Save `scratch-fix-green.png`. Pass when `pnpm --filter api test:formal` exits 0, which shows the property is satisfiable and no property was weakened. Discard the branch.
- [ ] Lane 10. Audit lane. Read `SKILL.md` cold. Run `git cat-file -e <sync SHA>`, `sed -n 41,45p`, `sed -n 52,54p`, `sed -n 63,67p` and `sed -n 69,71p` on `apps/api/src/apply/fetch-posting.ts`. Save `skill-audit.png` of the terminal. Pass when the SHA exists, every cited symbol is on its cited line, the frontmatter parses with `name` and `description`, and no placeholder text remains.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall seconds for `pnpm --filter api test:formal`, and wall seconds for `pnpm --filter api test` at trunk and at head.
- [ ] Probe. Run both commands three times each at head, and `pnpm --filter api test` three times at trunk, interleaved. Take medians. Trunk has no formal check, so the formal time is held to an absolute budget.
- [ ] Baseline. Record the trunk median of `pnpm --filter api test` first.
- [ ] Rule. Formal median above 10 seconds fails. Head `pnpm --filter api test` median more than 2 seconds above trunk fails.

**Review gate.** None. PR-16 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
