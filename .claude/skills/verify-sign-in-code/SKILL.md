---
name: verify-sign-in-code
description: Check the sign-in code budget under concurrent guesses, that a code allows at most 3 wrong guesses however many requests race, is accepted at most once, and is never accepted after it expires. Use after any change to apps/api/src/auth.ts (the emailOTP options), to apps/api/src/auth-routes.ts or the auth mount in apps/api/src/app.ts, to the better-auth version, or when asked whether someone can guess a sign-in code with parallel requests or take over an account.
---

# verify-sign-in-code

## The property

For one sign-in code, however many requests overlap, through the real api (`createApp` and the real better-auth routes):

- **A1.** At most 3 wrong guesses are ever evaluated per code, on every code route the api answers (`sign-in/email-otp`, `email-otp/change-email`, and any other route that stops answering 404), and across two routes together.
- **A2.** A code is accepted at most once. `sign-in/email-otp` consumes it, so N racing correct codes create one session.
- **A3.** An expired code (older than `expiresIn`, 300 seconds) is never accepted.

## The harm

Account takeover. A 6 digit code has a million values. The 3 guess budget is what makes guessing it hopeless. If parallel requests can each be evaluated before any of them counts, an attacker tests a whole batch per attempt, learns the code, and signs in as the victim.

## Why this tool

The promise is about requests that overlap, and it lives in a library (better-auth `email-otp`) that reads the attempt count, compares, and writes the count back. A hand model of that would only check itself, so there are two tools, as in `verify-command-registry`:

- **A vitest harness on the real code.** `apps/api/src/auth.otp.formal.test.ts` sends `Promise.all` of 2 to 16 wrong guesses through the real app on a real SQL engine. The rule is literal: it counts how many guesses the library actually compared, by watching the SHA-256 digest of each guess (the code is stored hashed, so every comparison hashes the guess first). It never reads the count back from the library.
- **A TLA+ model of the counter.** `apps/api/src/AuthOtp.tla` is the read, compare, write-back protocol. It shows why the bug exists and that a lock removes it. It does not touch the code.

There are two database engines, as in the registry skill:

- **PGlite (default).** One connection, but the route handlers still interleave at each `await`, so the lost update shows here.
- **A real Postgres server (`FORMAL_DATABASE_URL`).** The same result with truly overlapping queries. Use it before merging a change to a lock or a transaction.

## How to run

```bash
pnpm --filter api test:formal
```

- About 20 seconds. It also runs the registry and Apply scan checks. Run only this file with `pnpm --filter api exec vitest run --config vitest.formal.config.ts src/auth.otp.formal.test.ts`.
- Expected output: `13 passed` for this file, and a printed `max evaluated` line per route and caller count (`signIn N=16 max evaluated 3`, `changeEmail N=16 max evaluated 3`, and `0` for `check`, `verifyEmail` and `resetPassword`, which answer 404).
- `FORMAL_SEED=<n>` changes the start-order seed (default 241).
- The route guard `apps/api/src/auth-routes.test.ts` runs with `pnpm --filter api test`.
- Add a route to the harness table (`ROUTES` in the test) whenever the api starts answering a code route again: the A1 test runs once per table entry.

Real Postgres: use the recipe in `verify-command-registry` (embedded-postgres in a scratch folder, nothing added to the repo), then:

```bash
FORMAL_DATABASE_URL=postgres://postgres@127.0.0.1:54329/postgres pnpm --filter api test:formal
```

The TLA+ model (Java and the TLC jar are installed under `~/.local`; a TLC runner script wraps this once the toolchain unit lands):

```bash
cd apps/api/src
~/.local/jdk/bin/java -cp ~/.local/tla/tla2tools.jar tlc2.TLC -workers 1 -config AuthOtp.cfg AuthOtp.tla
~/.local/jdk/bin/java -cp ~/.local/tla/tla2tools.jar tlc2.TLC -workers 1 -config AuthOtp.mutant.cfg AuthOtp.tla
```

Run TLC from a scratch copy of the three files, because it writes a `states` folder next to where you run it. The first command must print `No error has been found` (115 distinct states). The second, `AuthOtp.mutant.cfg`, must fail with `Invariant A1 is violated` (exit 12). Read the result with /statechart (read `~/.claude/skills/statechart/SKILL.md` by path; it is user-invoked) to draw the bug path.

## Tests

| Test in `auth.otp.formal.test.ts`                                                                                                    | Covers                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 each code route (`check`, `signIn`, `verifyEmail`, `resetPassword`, `changeEmail`): N racing wrong guesses then sequential probes | N is 2, 3, 4, 8, 16, 3 start orders each. Racing wrong guesses, then 4 more one by one. Distinct guesses compared must be 3 or fewer in total, no wrong guess is accepted, and the real code is refused afterwards with no session |
| A1: guesses split across both routes                                                                                                 | N is 4, 8, 16, odd callers use `check`, even callers use `sign-in`. One budget for the code                                                                                                                                        |
| A1 control: three sequential wrong guesses                                                                                           | Exactly the first 3 are compared, the 4th is not, the code is locked. Proves the counter reads what the rule says                                                                                                                  |
| A2: N racing correct codes on sign-in                                                                                                | Exactly one 200, exactly one session row, a replay is refused                                                                                                                                                                      |
| A2: check and sign-in racing with the correct code                                                                                   | At most one session                                                                                                                                                                                                                |
| A3: N racing correct codes after expiry (both routes)                                                                                | The clock is moved to `expiresIn` plus 1 second. No 200, no session. Fails if `expiresIn` grows                                                                                                                                    |
| A3 control: sign-in just before expiry                                                                                               | Accepted at `expiresIn` minus 5 seconds, so the expiry test is not vacuous                                                                                                                                                         |
| Harness reaches the real rows                                                                                                        | A sent code is one hashed row for `sign-in-otp-<email>`                                                                                                                                                                            |

Route guard `apps/api/src/auth-routes.test.ts`: it lists every better-auth endpoint with a path and no `SERVER_ONLY` flag (the ones the router answers over HTTP). Each one must be in `SERVED_AUTH_PATHS` in `apps/api/src/auth-routes.ts` or answer 404 for every spelling (trailing slash, upper case, percent-encoded, query string, dot segments) and every method. `WEB_CALLED_AUTH_PATHS` must equal the paths derived from the `authClient` calls in `apps/web/src`, so a new web call or a new library route forces a decision. The rest of the library's routes (sign-up, password, update-user, delete-user, list-accounts, `reset-password`, `verify-email`, `request-password-reset`, `forget-password`, `request-email-change`, `check-verification-otp`) answer 404.

## The finding (fixed, issue #918)

`POST /api/auth/email-otp/check-verification-otp` is mounted by `app.all("/api/auth/*")` in `apps/api/src/app.ts` but the web never calls it. `email-otp/reset-password` has the same leak by another path: it calls `matchesUsableStoredOTP` (routes.mjs line 589), which compares the guess without counting it, before `atomicVerifyOTP`. In better-auth 1.7.14 it reads the stored `<hash>:<attempts>`, compares, and on a miss writes `attempts + 1` computed from what it read. Requests that read before any write all write the same number, so a burst is never counted.

Measured on main, before the fix (PGlite and Postgres alike):

- `check N=16` evaluated 17 (PGlite) and 18 (Postgres) wrong guesses against one code. N=2 already gives 4.
- `sign-in/email-otp` stayed at exactly 3 for every N. It uses `atomicVerifyOTP`, which deletes the row first (`consumeVerificationValue`), so a second racer finds no row and is not compared. A2 and A3 held everywhere.
- `reset-password`, with the app guard off: `N=16` evaluated 17 wrong guesses (N=2 evaluated 7). `verify-email` and `change-email` held at 3.
- Mixed traffic on both routes together evaluated up to 10.

The rate limit does not make this safe. Production logs show `Rate limiting could not determine a client IP and is falling back to a single shared per-path bucket`, so each auth path has one site-wide bucket of 3 per 60 seconds. A forged forwarding header lands in that same bucket and is no use to an attacker. That shared bucket is a separate problem (one client can lock every user out of sign-in) and is filed in its own issue. The attempt budget has to hold on its own.

The fix follows Q6 of the program plan, widened. Every auth path the web does not call answers 404 before the auth handler (`isServedAuthPath` in `apps/api/src/auth-routes.ts`, applied in `apps/api/src/app.ts`). That blocks `check-verification-otp` and `reset-password`, and the other routes that take a code. `account.requestEmailChange` still sends its code, because it calls `auth.api.requestEmailChangeEmailOTP` on the server. No advisory lock was added. The two code routes the web calls (`sign-in/email-otp`, `email-otp/change-email`) use `atomicVerifyOTP`.

If a later change needs the check route, do not unblock it as is. Put the read, compare, write inside a lock (`pg_advisory_xact_lock(hashtext(identifier))`) or one conditional `UPDATE`, which is the `Locked = TRUE` model in `AuthOtp.cfg`, and rerun the harness on a real server.

## How to read a counterexample

The failing message names the scenario: `check N=16 seed=241 backend=pglite evaluated 17`, `both-routes N=8 seed=242 ...`, `signIn N=2 seed=241 ... the real code still signs in`.

- `runs that evaluated more than 3 wrong guesses` (A1): a route lets overlapping requests each be compared. Open the route in better-auth dist/plugins/email-otp/routes.mjs (`checkVerificationOTP`, `signInEmailOTP`, `atomicVerifyOTP`) and check that the attempt count is read and written under one atomic step. On `signIn` also check `allowedAttempts` in `apps/api/src/auth.ts` (line 77) and `consumeVerificationValue` in the library's internal adapter.
- `runs where the real code still worked` (A1): the budget was not spent, so a guesser keeps a live code. Same causes.
- `expected 1 to be ...` or `accepted` not 1 (A2): consume is no longer atomic, or a duplicate verification row was written. Look at `createVerificationValue` in `atomicVerifyOTP`.
- `[ 200 ]` after expiry (A3): `expiresIn` in `apps/api/src/auth.ts` (line 74) grew, or the library's expiry check moved. The test moves only `Date`, so a library that reads the database clock for expiry would also show here.
- `spellings the auth library answered` (route guard): a path reaches the library again. Check the `app.use("/api/auth/*")` line in `apps/api/src/app.ts` and `normalizedPath` in `apps/api/src/auth-routes.ts`.
- A failure with unchanged code means a rule is wrong. Check it against the library source above before editing code.

## Mutants (confirmed at the sync commit)

- `allowedAttempts: 3` to `100` in `apps/api/src/auth.ts`: the `signIn` A1 test and the sequential control fail (`signIn N=2` evaluated 5, N=3 evaluated 6).
- `expiresIn: 300` to `1e6`: `signIn: N racing correct codes after expiry are all refused` fails (`expected [ 200 ] to deeply equal []`).
- Remove the `app.use("/api/auth/*")` block in `apps/api/src/app.ts`: the `check` A1 test fails (N=16 evaluated 17), the `resetPassword` A1 test fails (N=16 evaluated 17), the both-routes test fails, and the route guard fails on the plain path.
- `Locked = FALSE` in `AuthOtp.mutant.cfg`: TLC reports `Invariant A1 is violated` after 15 steps with two requests, with `evals = 4`.

## Bounds and assumptions

- The rate limiter is off in the harness (`createAuthedApp` default), so the budget is measured on its own. One run with the limiter on was done by hand (see above).
- Callers per race: 2 to 16 on PGlite and Postgres. Start orders: 3 seeds, each caller delayed 0 to 2 event-loop turns. A pass covers those cases, not every interleaving.
- One user and one fresh code per scenario. The user exists before the code is sent, because `check-verification-otp` refuses an unknown address.
- A guess counts as evaluated when its SHA-256 digest is taken. This holds while `storeOTP` is `"hashed"`. If it changes to `"plain"` or `"encrypted"`, replace `countGuessEvaluations` in the test.
- The TLA+ model: 2 requests, up to 3 tries each, `Allowed = 3`. `Locked` stands for one atomic step (a lock, or the library's delete-first consume). A pass covers that bound.

## Coverage record

| Item                                                            | Where                                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `emailOTP` options (`allowedAttempts`, `expiresIn`, `storeOTP`) | `apps/api/src/auth.ts` lines 72-80                                                        |
| auth mount and the block                                        | `apps/api/src/app.ts` lines 157-163                                                       |
| served route lists                                              | `apps/api/src/auth-routes.ts`                                                             |
| `checkVerificationOTP` (read, compare, write back)              | better-auth 1.7.14 dist/plugins/email-otp/routes.mjs lines 222-263, read only             |
| `signInEmailOTP`, `atomicVerifyOTP`                             | better-auth 1.7.14 dist/plugins/email-otp/routes.mjs lines 386-410 and 770-790, read only |
| `verifyStoredOTP`, `defaultKeyHasher`                           | better-auth 1.7.14 dist/plugins/email-otp/otp-token.mjs and utils.mjs, read only          |

Check files: `apps/api/src/auth.otp.formal.test.ts`, `apps/api/src/auth-routes.test.ts`, `apps/api/src/AuthOtp.tla`, `AuthOtp.cfg`, `AuthOtp.mutant.cfg`, `AuthOtp.tla.json`. Runner: `apps/api/vitest.formal.config.ts`.

Sync commit: `4d674be96d840957100265da3fc30a2af896768e`. This is the trunk commit the check was last confirmed against.

## What is not covered

- The routes the api answers 404 are driven by the harness too, and evaluate 0 guesses. The code they would run is not under test: if one is served again, its A1 result decides.
- The send path (`send-verification-otp`) and its 3 per minute limit, the single shared rate-limit bucket per path (no client address is seen in production), and rate-limit storage in a multi-instance deployment.
- Google sign-in and session handling.
- Guessing speed through a real network, a proxy that does not set the client address, and `X-Forwarded-For` spoofing on the host.

If a later run probes one of these and it fails, it is a new finding. Do not shrink the property to hide it.

## When the sign-in code changes

1. Run `pnpm --filter api test:formal`, then `pnpm --filter api test` for the route guard. A failure is a new finding or a wrong rule.
2. Fix the code, never the property or the 3, unless a rule disagrees with the library source.
3. A better-auth upgrade can add a route: it answers 404 until a web call adds it to `WEB_CALLED_AUTH_PATHS`. Read the new route first. Serve it only after adding it to the harness table and seeing A1 pass. A route that reads the attempt count and writes it back later stays unserved, or goes behind a lock.
4. Prove the check still bites. Make a scratch change, confirm a named failure, then `git checkout` the file and confirm the run is back to green. Use the mutants above.
5. Move the sync commit only after you reread every covered function at the new commit, rerun both engines, rerun TLC on both configs, and confirm every row of the coverage record still describes the code. Then set it to `git rev-parse origin/main` and fix any line numbers.
