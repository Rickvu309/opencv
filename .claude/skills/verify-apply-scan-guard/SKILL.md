---
name: verify-apply-scan-guard
description: Check the Apply scan SSRF boundary, the URL guard that decides which job-posting links the api server may fetch. Use after any change to apps/api/src/apply/fetch-posting.ts or to openableApplyJobUrl in packages/domain/src/apply.ts, before merging a fix for the guard, or when asked whether the Apply scan can reach internal hosts or refuses real employers.
---

# verify-apply-scan-guard

## The property

No URL whose resolved host is loopback, link-local, private, or a non-http(s) scheme, with or without port or userinfo, ever reaches fetch, and no public hostname is refused.

## The harm

A job-posting URL aimed at the server's own network lets a user read internal services or cloud metadata through the Apply scan, and a wrong refusal blocks scans for real employers.

## Why this tool

TypeScript has no production verifier for this code, so the tool is `fast-check` property tests over the real functions plus a bounded exhaustive sweep. The test calls `assertPublicApplyScanUrl`, `isBlockedApplyScanHost` and `createFetchJobPosting` as exported, with a spy in place of `fetch`. A pass covers the generated and enumerated inputs, not every string. The expected verdict for every host is a literal table in the test file, so the check never asks the code under test what is correct.

## How to run

```bash
pnpm --filter @workspace/domain build   # the api imports the built domain package
pnpm --filter api test:formal
```

- One command, a few seconds, `fast-check` 4.x pinned by `pnpm-lock.yaml`.
- Exit 0 means every test passed. A non-zero exit lists the failing tests and prints evidence for each.
- `pnpm --filter api test` skips the file on purpose (`**/*.formal.test.ts` is excluded in `apps/api/vitest.config.ts`). The exclusion is there because the check is red on trunk while the findings below are open. The PR that fixes them deletes the exclusion line.
- `FORMAL_SEED=<n>` changes the fast-check seed (default 241). Run a few seeds after a change to the guard. Runs per property: 400.

Four tests, each one slice of the same grammar. A scheme from `http`, `https`, `HTTPS`, `ftp`, `file`, `javascript`, `data`; userinfo none, `user@`, `user:pw@`; port none, `:80`, `:8443`; tail empty, `/x`, `?q=1`, `#f`; and 28 fixed hosts (21 blocked, 7 public). That is 7056 sweep tuples, split across the tests as 756 + 2016 + 252 + 4032. The tuple counts print as `[formal] <name>: sweep N tuples, M failing`.

| Test | Covers |
| --- | --- |
| F1: no public hostname is refused | http(s) to the 7 public hosts, any shape, plus random DNS names and public IPv4 quads |
| F2: no blocked host reaches fetch when it carries a port or userinfo | http(s) to the 21 blocked hosts with a port or userinfo, with and without a lenient lookup |
| no bare blocked host reaches fetch | the same hosts with no port and no userinfo |
| no non-http(s) scheme reaches fetch | `ftp`, `file`, `javascript`, `data` and others to every host |

"Reaches fetch" means the `fetchImpl` spy was called or `createFetchJobPosting` returned `ok:true`. It is checked twice: with `lookupImpl: null`, and with a lookup that always answers the public address `93.184.216.34`.

## How to read a counterexample

The failure prints witness lines, the first failing sweep tuples, and the `fast-check` counterexample as `[scheme, userinfo, host, port, tail]`. Rebuild the URL as `scheme://userinfo host port tail` and trace it.

- `isBlockedApplyScanHost("fda.gov") -> true` or `https://fda.gov/jobs/1 -> ok:false` (test F1): a public host was refused. Open `isPrivateIPv6` at `fetch-posting.ts` line 44. `host.startsWith("fc")` and `host.startsWith("fd")` run on a hostname, so any name that starts with `fc` or `fd` matches. A counterexample that has a userinfo or port in front of the host does not hit this; those start with `user@`.
- `http://user@127.0.0.1/x reached fetch (no lookup, lenient lookup)` (test F2): a blocked host passed because of its shape. Open `hostFromHttpUrl` at line 63. It strips the scheme and splits on `/`, `?`, `#`, so the host it hands to `isBlockedApplyScanHost` is `user@127.0.0.1` or `localhost:3000`, which matches no rule. With no lookup the URL goes straight to fetch. With a real lookup only a failing `dns.lookup("user@127.0.0.1")` stops it.
- A failure in "no bare blocked host reaches fetch" names a host class. Find its clause: `isPrivateIPv4` (line 24) for dotted quads, `isPrivateIPv6` (line 41) for bracketed addresses, `isBlockedApplyScanHost` (line 52) for names and suffixes.
- A failure in "no non-http(s) scheme reaches fetch" with an `ftp:`, `file:`, `javascript:` or `data:` URL points at the scheme test `/^https?:\/\//i` in `openableApplyJobUrl` (`packages/domain/src/apply.ts` line 139), or at `normalizeApplyJobUrl`.
- A counterexample that matches neither F1 nor F2 and fails on an unchanged guard means the test table is wrong. Check the host row against the guard's documented ranges before editing code.

## Bounds and assumptions

- Host space: the fixed list above, random DNS names, random public IPv4 quads outside `0/8`, `10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `100.64/10`, and a small set of bracketed IPv6 literals. Not every string.
- `lookupImpl` is a stub. The check does not do real DNS.
- Ports `1` to `65535`, userinfo from a fixed set of four, paths from a fixed set plus random labels.
- `jobs.example.com` is the demo seed host that `openableApplyJobUrl` refuses on purpose (`DEMO_APPLY_JOB_HOST`), so it is not a public-host example.
- The 2000 character limit (`APPLY_JOB_URL_MAX`), whitespace rejection and trimming in `openableApplyJobUrl` are not probed.

## Coverage record

| Item | Where |
| --- | --- |
| `isPrivateIPv4` | `apps/api/src/apply/fetch-posting.ts` line 24 |
| `isPrivateIPv6` | `apps/api/src/apply/fetch-posting.ts` line 41 |
| `isBlockedApplyScanHost` | `apps/api/src/apply/fetch-posting.ts` line 52 |
| `hostFromHttpUrl` | `apps/api/src/apply/fetch-posting.ts` line 63 |
| `assertPublicApplyScanUrl` | `apps/api/src/apply/fetch-posting.ts` line 69 |
| `createFetchJobPosting` | `apps/api/src/apply/fetch-posting.ts` line 97 |
| `openableApplyJobUrl` | `packages/domain/src/apply.ts` line 131 |

Check file: `apps/api/src/apply/fetch-posting.formal.test.ts`. Runner: `apps/api/vitest.formal.config.ts`.

Sync commit: `2c0c95829be0ae7c8eb2bf0242e0889e7f9e74a6`. This is the trunk commit the check was last confirmed against.

## Known findings

Both are open at the sync commit. The check is red on exactly these two, so a red run with only F1 and F2 is the expected baseline.

- F1, api-quality finding 3. `isBlockedApplyScanHost("fda.gov")` returns true because `isPrivateIPv6` (line 41) runs on every hostname and `startsWith("fd")` on line 44 matches. `assertPublicApplyScanUrl("https://fda.gov/jobs/1")` returns `ok:false`. `fdic.gov` and `fcbarcelona.com` fail the same way. Fix direction: call `isPrivateIPv6` only when the host contains `:`.
- F2, api-quality finding 4. `hostFromHttpUrl` keeps userinfo and port. `assertPublicApplyScanUrl("http://user@127.0.0.1/x")` returns `ok:true` with no lookup, and `http://localhost:3000/x` the same. With a lookup, only a failing `dns.lookup("user@127.0.0.1")` stops the request. Fix direction: take the host from `new URL(openable).hostname`.

## What is not covered

- DNS rebinding and single-address lookup (api-quality finding 6).
- The unbounded `arrayBuffer()` read (finding 5).
- Redirect hops after the first.
- Decimal or octal IPv4 forms such as `2130706433`.
- IPv4-mapped IPv6 in hex form such as `::ffff:7f00:1`.

Hazard for the F2 fix, found while proving the check on a scratch fix and not part of the grid. `new URL("http://[::ffff:127.0.0.1]/").hostname` is `[::ffff:7f00:1]`, the hex form that `isPrivateIPv6` (line 41) does not match. A fix that takes the host from `new URL(...).hostname` and nothing else would let `http://[::ffff:127.0.0.1]/` reach fetch, which trunk blocks today. Add the dotted-mapped hosts to the table in the same change as that fix.

If a later run probes one of these and it fails, it is a new finding. Do not shrink the grammar to hide it.

## When the guard changes

1. Run `pnpm --filter api test:formal`. Compare the failing tests to the known findings.
2. A fix for F1 or F2 should turn that test green without editing the property or the host table. Delete the matching entry under Known findings, and when both are gone delete the `**/*.formal.test.ts` line from `apps/api/vitest.config.ts` so the default suite runs the check.
3. A new rule (a new blocked range, a new scheme) needs a row in the `HOSTS` or `SCHEMES` table in the test and a matching generator in the same commit.
4. Prove the check still bites. Make a scratch change that breaks the guard, confirm a named counterexample, then `git checkout` the file and confirm the run is back to where it started. A scratch edit in `packages/domain` only bites after `pnpm --filter @workspace/domain build`, and again after you revert it. Useful breaks: delete the `a === 192 && b === 168` line (line 36), remove the `.localhost` clause in `isBlockedApplyScanHost`, make the scheme test in `openableApplyJobUrl` also accept `ftp://`.
5. Move the sync commit only after you reread every covered function at the new commit, rerun the check, and confirm every row of the coverage record and the Known findings still describes the code. Then set it to `git rev-parse origin/main` and fix any line numbers.
