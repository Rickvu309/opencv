---
name: verify-paper-local
description: Verify Paper input recovery, exact local completion, and the Saved gate after sync or storage changes.
---

# Verify Paper local saves

Last confirmed against `origin/main` at `89c3703c` on 2026-11-13: every command under Run printed the exit codes and pass counts this file states.

## Native D1 verification

Issue 1541 adds a private native transport. It does not activate a public editor, subscribe to authentication changes, or migrate documents. The caller must destroy the session when its owner or sign-in session changes. Every asynchronous boundary also checks that identity before exposing or acknowledging data.

The shared `openPaperSync` factory accepts either the existing legacy arguments or qualified native session options. Native behavior tests and the browser probe enter through that factory. Native credentials select the native transport without activating an editor route.

The native recovery scope contains the owner, document and format revision. It excludes the ephemeral sign-in session. Native storage uses a separate IndexedDB database and strict provenance-bearing journals. An unreadable scan or incompatible record blocks readiness and retains the original bytes. Recovery rereads orphan snapshots after acquiring their locks and keeps those locks until shutdown. Shutdown hides the client immediately and retains its own lock until already queued persistence settles.

The candidate passed 24 native behavior tests, 16 API and registry tests, and 10 native and legacy detector tests on 2026-11-15. Both source mutations failed their intended assertions: premature Saved and crediting an old local completion to the current generation. Restoring the source passed all 24 native tests. The earlier legacy verification point above remains unchanged.

Chromium used real IndexedDB transactions, localStorage and Web Locks with an internal admitted-read callback and a controlled in-browser CRDT server. Six scenarios passed: fast server receipt before exact local completion including newer input, ordinary offline reload before D, whole-browser kill after observed D and recovery in the same profile, a second live tab, session invalidation and owner isolation, and byte-identical malformed-journal refusal. Authenticated API behavior was tested separately. This is not an integrated browser-to-Hono proof. Browser transaction abort, malformed IndexedDB, lock-acquisition races, quota failures and server-reset recovery remain outside this browser run; controlled tests cover the abort, incompatible orphan and lock race.

`PaperNativeLocal.tla` is a separate bounded native model. Its canonical, orphan and shutdown configurations each passed clean, intended mutant and clean runs. All three mutants exited 12. The model checks exact local and server generations, rereading an orphan under its lock, persistence before orphan deletion, retaining locks through pending writes, and clearing only entries covered by both receipts. It abstracts owner/session invalidation into one identity flag. It does not prove strict decoding, namespace construction, CRDT merge, epoch resets, physical disk durability or eventual delivery. Its new sync commit records the verified candidate source commit; it is not a claim that this candidate has merged. Do not advance the legacy model's sync commit.

Reproduce the native checks sequentially:

```sh
pnpm --filter web exec vitest run --isolate src/lib/paper-sync-identity.test.ts src/lib/paper-sync-native.test.ts
pnpm --filter api exec vitest run src/paper/native-admission.test.ts src/paper/content-sync-native-http.test.ts src/registry/paper-contract.test.ts src/registry/transaction.test.ts
node --test scripts/paper-native-durable.test.mjs scripts/paper-local-durable.test.mjs scripts/paper-local-journal.test.mjs
node scripts/guard-ledger.mjs prove paper-journal-preservation
node scripts/tlc.mjs apps/web/src/lib/PaperNativeLocal.tla
node scripts/tlc.mjs apps/web/src/lib/PaperNativeLocal.tla --mutant
```

Repeat clean, mutant and clean for each native configuration using `--config`. The full browser probe, mutation runner and per-configuration logs are retained with the issue 1541 change report under `~/tmp/paper-autopilot`. Historical journal-erasure metadata retains introducing commit `306161ecdd4184ffbf3fd9784cf8358b2b36f46c`. Run its committed guard proof before claiming delivery.

## Rich editor qualification

Issue 1569 mounts qualified native rich CVs and Letters through the owner-only document read. `openNativePaperSync` and `openRichNativePaperSync` share `openSession`, which now owns the generations, receipts, locks and shutdown lifecycle named in the native action map. The model properties and bounds are unchanged. Rich checkpoint lineage validation and strict decoding remain outside the model; controlled CRDT and transport tests cover their refusals. Public rich creation remains gated.

The native model was checked against candidate product commit `7e25b97a` on 2026-11-16. Its sync anchor remains accepted main commit `e3b6a3fe` until the candidate reaches main. The unchanged model passed before this update. All three native configurations then passed clean, intended mutant and clean runs; each mutant exited 12. Two mutations of the real transport failed their intended assertions: premature Saved and crediting an older local completion to newer input. Restoring the source passed all 24 native behavior tests. The legacy model sync and the issue 1541 historical browser results above remain unchanged.

Authenticated Chromium against the assigned Hono and web runtime passed for both rich CV and Letter: typing and underline survived reload, the document photo decoded, phone controls and page fit, and interrupted offline input remained pending before recovery reached Saved after reload. This is integrated browser-to-Hono evidence using seeded documents and controlled network interruption, not a live-model or physical disk proof. The 38-case screen sweep passed its behavior checks. Existing shared shell contrast and fixed-size text advisories are retained in the report.

Reproduce the targeted native behavior checks and each native model configuration with the commands above. Issue 1569 adds `src/lib/paper-rich-transport.test.ts`, `src/lib/paper-rich-editor.test.ts` and `src/routes/paper-doc-open.isolated.test.tsx` to the web check. The finite clean/mutant/clean runner, real-source mutation runner, authenticated browser script and full logs are retained under `~/tmp/paper-autopilot/1569-*`. This run does not rerun the issue 1541 whole-browser kill scenarios or establish new physical durability guarantees.

## When this file is stale

Run `node scripts/tlc.mjs --stale` first. When it lists `apps/web/src/lib/PaperLocal.tla` as STALE, or `git log --oneline 89c3703c..origin/main -- .agents/skills scripts/tlc.mjs` prints commits, rerun every command under Run before trusting a claim here. If a command fails or prints something else, believe the command, fix this file in the same PR, and move the commit above.

## Approved rules

D is observed IndexedDB transaction complete for the exact snapshot containing the current words. Input return, localStorage return, request success, and elapsed time are not D. New typing requires its own D.

Saved requires both D and a matching durable server receipt for the current words. Show Saving while either is missing. An older completion or an aborted transaction cannot cover newer input.

Ordinary close or reload preserves completed input through the synchronous per-tab journal and the pagehide flush attempt. Abrupt browser kill preserves words that crossed D. There is no pre-D kill promise.

Clear journal entries only after both IndexedDB complete and a matching server receipt cover those entries.

## Coverage and history

This model covers code scheduled for deletion. The old CV and Letter editors it served are deleted (#1952), so `openPaperSync` has no screen left; it goes with the old formats.

`apps/web/src/lib/PaperLocal.tla` models `openPaperSync`, its journal, and `indexedDbStore`. Its action map names the implementation entry points. The approved replacement explicitly separates ordinary pagehide from abrupt kill and names `DurabilityPointD`. It replaces the earlier immediate-kill model under the coordinator's approved rule. The earlier model and the 23 lost cases out of 120 remain prior evidence; this change does not turn them into passes.

`paper-local-replay.isolated.test.ts` drives the real sync implementation with a fake server and controlled local completion. It checks fast receipt before D, older completion after newer input, transaction abort, and ordinary close recovery. `paper-sync-journal.test.ts` checks per-tab journal coverage and clearing. `scripts/paper-local-durable.test.mjs` checks the current Saved gate and old delayed-write mistakes against a main-history ancestor. These are controlled behavior checks, not physical disk proofs.

The sync commit and the covered files live in `"sync"` and `"covers"` of `apps/web/src/lib/PaperLocal.tla.json`. Run `node scripts/tlc.mjs --stale` to list every commit that touched covered files since then. Move `"sync"` forward only after you confirm the model still describes the code at the new commit, and use a commit on `main`. The historical mistake is main ancestor `a1831b78801edfac3063a7376dc46a72a08fa054`; it is not a claim that the approved model was verified at that commit.

## Run

Run sequentially with `TMPDIR=/home/quan/tmp` and the assigned heavy slot.

```sh
pnpm --filter @workspace/paper-crdt build
pnpm --filter web exec vitest run --isolate src/lib/paper-local-replay.isolated.test.ts src/lib/paper-sync-journal.test.ts
node --test scripts/paper-local-durable.test.mjs scripts/paper-local-journal.test.mjs
node scripts/tlc.mjs apps/web/src/lib/PaperLocal.tla
node scripts/tlc.mjs apps/web/src/lib/PaperLocal.tla --mutant
```

The build comes first on a fresh worktree: without `packages/paper-crdt/dist` both web tests fail with `Failed to resolve import "@workspace/paper-crdt"`. Then the web tests print `Tests 20 passed (20)`, the node tests `pass 4`, the clean model exits 0 and the mutant exits 12. List the other pairs with `ls apps/web/src/lib/PaperLocal.*.cfg` and run each by name with `--config`; never run `node scripts/tlc.mjs --all` on this machine, CI runs it. All four CI-discovered safe configurations must exit 0. Their four paired mutants must exit 12. The canonical mutant drops the input journal and breaks ordinary close recovery. The other pairs independently clear the journal after only one confirmation, show Saved before D, and resolve local success before transaction complete. A mutant passing means the proof cannot see its intended mistake. Read every result with `/statechart`; keep the shortest broken paths in the report.

Follow the behavior checks on a scratch source mutation that makes `canShowSaved` always true; the fast-receipt test must fail. Restore the source and rerun. A scratch mutation that credits an older completion to the current version must fail the newer-input test. Keep source edits isolated and restore them before other checks or saving.

The browser evidence must record the observed complete event for the snapshot containing each test token, kill only after that event, and reopen the same isolated profile. Ordinary close/reload checks must include completed input whose IDB writes are held. Use fake providers. The old delay table does not measure D and cannot substitute for these checks. Keep full runtime scripts and results with the change report.

## Bounds

The model checks two cumulative edits, one document and tab, one transaction in progress, one ordinary close or kill followed by recovery, and one abort. It assumes completed snapshots are not later removed or overwritten by older writes. Prefixes abstract words and do not prove Yjs merge semantics, replacements, epochs, leases, orphan adoption, server idempotency, or multi-tab conflict policy. It checks safety, not eventual saving. Storage availability and delivery to the input subscription are assumed for ordinary lifecycle recovery. Quota denial, eviction, profile deletion, OS crashes, power loss, and browser implementation correctness are outside this model.

## When code changes

Run `/maintain-formal-verification-skill` after changes to the covered code. Confirm the code, replay, model, and browser evidence agree before recording a new verification point. Keep `ContentStore.tla` unchanged.
