---
name: verify-apply-scan-guard
description: Check the Apply scan SSRF boundary, the URL guard that decides which job-posting links the api server may fetch. Use after any change to apps/api/src/job/fetch-posting.ts or to openableApplyJobUrl in packages/domain/src/job-posting.ts, before merging a fix for the guard, or when asked whether the Apply scan can reach internal hosts or refuses real employers.
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
pnpm --filter api test:formal
```

- One command, a few seconds, `fast-check` 4.x pinned by `pnpm-lock.yaml`.
- Exit 0 means every test passed. A non-zero exit lists the failing tests and prints evidence for each.
- `pnpm --filter api test` also runs the file, because `apps/api/vitest.config.ts` no longer excludes `**/*.formal.test.ts`.
- `FORMAL_SEED=<n>` changes the fast-check seed (default 241). Run a few seeds after a change to the guard. Runs per property: 400.

Four tests, each one slice of the same grammar. A scheme from `http`, `https`, `HTTPS`, `ftp`, `file`, `javascript`, `data`; userinfo none, `user@`, `user:pw@`; port none, `:80`, `:8443`; tail empty, `/x`, `?q=1`, `#f`; and 33 fixed hosts (26 blocked, 7 public). That is 8316 sweep tuples, split across the tests as 756 + 2496 + 312 + 4752. The tuple counts print as `[formal] <name>: sweep N tuples, M failing`.

| Test                                                                 | Covers                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| F1: no public hostname is refused                                    | http(s) to the 7 public hosts, any shape, plus random DNS names and public IPv4 quads      |
| F2: no blocked host reaches fetch when it carries a port or userinfo | http(s) to the 21 blocked hosts with a port or userinfo, with and without a lenient lookup |
| no bare blocked host reaches fetch                                   | the same hosts with no port and no userinfo                                                |
| no non-http(s) scheme reaches fetch                                  | `ftp`, `file`, `javascript`, `data` and others to every host                               |

"Reaches fetch" means the `fetchImpl` spy was called or `createFetchJobPosting` returned `ok:true`. It is checked twice: with `lookupImpl: null`, and with a lookup that always answers the public address `93.184.216.34`.

## How to read a counterexample

The failure prints witness lines, the first failing sweep tuples, and the `fast-check` counterexample as `[scheme, userinfo, host, port, tail]`. Rebuild the URL as `scheme://userinfo host port tail` and trace it.

- `isBlockedApplyScanHost("fda.gov") -> true` or `https://fda.gov/jobs/1 -> ok:false` (test F1): a public host was refused. Open `isPrivateIPv6` at `fetch-posting.ts` line 63 and `isBlockedApplyScanHost` at line 75. A hostname that is not an IPv6 literal must never reach a prefix test.
- `http://user@127.0.0.1/x reached fetch (no lookup, lenient lookup)` (test F2): a blocked host passed because of its shape. Open `hostFromHttpUrl` at line 90. The host must come from `new URL(url).hostname`, never from string splitting, so userinfo, port and brackets are normalised the way `fetch` normalises them.
- A failure in "no bare blocked host reaches fetch" names a host class. Find its clause: `isPrivateIPv4` (line 25) for dotted quads, `isPrivateIPv6` (line 63) for bracketed addresses including IPv4-mapped ones in dotted or hex form, `isBlockedApplyScanHost` (line 75) for names and suffixes.
- A failure in "no non-http(s) scheme reaches fetch" with an `ftp:`, `file:`, `javascript:` or `data:` URL points at the scheme test `/^https?:\/\//i` in `openableApplyJobUrl` (in `packages/domain/src/job-posting.ts`), or at `normalizeApplyJobUrl`.
- A counterexample that matches neither F1 nor F2 and fails on an unchanged guard means the test table is wrong. Check the host row against the guard's documented ranges before editing code.

## Bounds and assumptions

- Host space: the fixed list above, random DNS names, random public IPv4 quads outside `0/8`, `10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `100.64/10`, and a small set of bracketed IPv6 literals, including IPv4-mapped loopback, private and link-local addresses in dotted and hex form. Not every string.
- `lookupImpl` is a stub. The check does not do real DNS.
- Ports `1` to `65535`, userinfo from a fixed set of four, paths from a fixed set plus random labels.
- `jobs.example.com` is the demo seed host that `openableApplyJobUrl` refuses on purpose (`DEMO_APPLY_JOB_HOST`), so it is not a public-host example.
- The 2000 character limit (`APPLY_JOB_URL_MAX`), whitespace rejection and trimming in `openableApplyJobUrl` are not probed.

## Coverage record

| Item                       | Where                                        |
| -------------------------- | -------------------------------------------- |
| `isPrivateIPv4`            | `apps/api/src/job/fetch-posting.ts` line 25  |
| `isPrivateIPv6`            | `apps/api/src/job/fetch-posting.ts` line 63  |
| `isBlockedApplyScanHost`   | `apps/api/src/job/fetch-posting.ts` line 75  |
| `hostFromHttpUrl`          | `apps/api/src/job/fetch-posting.ts` line 90  |
| `assertPublicApplyScanUrl` | `apps/api/src/job/fetch-posting.ts` line 98  |
| `createFetchJobPosting`    | `apps/api/src/job/fetch-posting.ts` line 154 |
| `openableApplyJobUrl`      | `packages/domain/src/job-posting.ts` line 42 |

Check file: `apps/api/src/job/fetch-posting.formal.test.ts`. Runner: `apps/api/vitest.formal.config.ts`.

Sync commit: `2ea68545978b96c2490ebccc4039295158cb8228`. This is the trunk commit the check was last confirmed against. The guard files moved from the api apply folder to the api job folder, and the domain `openableApplyJobUrl` moved from apply.ts to `job-posting.ts`, since the earlier sync (`49debddf`); their content is unchanged, and every line number above still matches.

## What is not covered

- DNS rebinding and single-address lookup (api-quality finding 6).
- The body read cap (finding 5), covered by `fetch-posting.test.ts`.
- Redirect hops after the first.
- Decimal or octal IPv4 forms such as `2130706433`.
- IPv6 forms other than loopback, unspecified, link-local, unique-local, IPv4-compatible and IPv4-mapped, such as NAT64 `64:ff9b::/96`.

If a later run probes one of these and it fails, it is a new finding. Do not shrink the grammar to hide it.

## When the guard changes

1. Run `pnpm --filter api test:formal`. It is green on trunk, so any failure is a new finding or a wrong table row.
2. Fix the guard, never the property or the host table, unless the table row disagrees with the documented ranges.
3. A new rule (a new blocked range, a new scheme) needs a row in the `HOSTS` or `SCHEMES` table in the test and a matching generator in the same commit.
4. Prove the check still bites. Make a scratch change that breaks the guard, confirm a named counterexample, then `git checkout` the file and confirm the run is back to where it started. Useful breaks: delete the `a === 192 && b === 168` line (line 37), remove the `.localhost` clause in `isBlockedApplyScanHost`, make the scheme test in `openableApplyJobUrl` also accept `ftp://`.
5. Move the sync commit only after you reread every covered function at the new commit, rerun the check, and confirm every row of the coverage record still describes the code. Then set it to `git rev-parse origin/main` and fix any line numbers.
