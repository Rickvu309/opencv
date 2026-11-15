---
name: verify-paper-local
description: Verify Paper input recovery, exact local completion, and the Saved gate after sync or storage changes.
---

# Verify Paper local saves

Last confirmed against `origin/main` at `89c3703c` on 2026-11-13: every command under Run printed the exit codes and pass counts this file states.

## When this file is stale

Run `node scripts/tlc.mjs --stale` first. When it lists `apps/web/src/lib/PaperLocal.tla` as STALE, or `git log --oneline 89c3703c..origin/main -- .agents/skills scripts/tlc.mjs` prints commits, rerun every command under Run before trusting a claim here. If a command fails or prints something else, believe the command, fix this file in the same PR, and move the commit above.

## Approved rules

D is observed IndexedDB transaction complete for the exact snapshot containing the current words. Input return, localStorage return, request success, and elapsed time are not D. New typing requires its own D.

Saved requires both D and a matching durable server receipt for the current words. Show Saving while either is missing. An older completion or an aborted transaction cannot cover newer input.

Ordinary close or reload preserves completed input through the synchronous per-tab journal and the pagehide flush attempt. Abrupt browser kill preserves words that crossed D. There is no pre-D kill promise.

Clear journal entries only after both IndexedDB complete and a matching server receipt cover those entries.

## Coverage and history

`openPaperSync` serves the native CV and Letter editors (`apps/web/src/features/paper/paper-cv-editor.tsx`, `paper-letter.tsx`). It keeps independent recovery namespaces for legacy v3 and native v4 schema revision1. The Word writing page saves through `paper.canvas` in `apps/web/src/features/paper-page/canvas-save.ts`, which this model does not cover.

`apps/web/src/lib/PaperLocal.tla` models `openPaperSync`, its journal, and `indexedDbStore`. Its action map names the implementation entry points. The approved replacement explicitly separates ordinary pagehide from abrupt kill and names `DurabilityPointD`. It replaces the earlier immediate-kill model under the coordinator's approved rule. The earlier model and the 23 lost cases out of 120 remain prior evidence; this change does not turn them into passes.

`paper-local-replay.test.ts` drives the real sync implementation with a fake server and controlled local completion. It checks fast receipt before D, older completion after newer input, transaction abort, and ordinary close recovery. `paper-sync-journal.test.ts` checks per-tab journal coverage and clearing. `scripts/paper-local-durable.test.mjs` checks the current Saved gate and old delayed-write mistakes against a main-history ancestor. These are controlled behavior checks, not physical disk proofs.

The sync commit and the covered files live in `"sync"` and `"covers"` of `apps/web/src/lib/PaperLocal.tla.json`. Run `node scripts/tlc.mjs --stale` to list every commit that touched covered files since then. Move `"sync"` forward only after you confirm the model still describes the code at the new commit, and use a commit on `main`. The historical mistake is main ancestor `a1831b78801edfac3063a7376dc46a72a08fa054`; it is not a claim that the approved model was verified at that commit.

## Run

Run sequentially with `TMPDIR=/home/quan/tmp` and the assigned heavy slot.

```sh
pnpm --filter @workspace/paper-crdt build
pnpm --filter web exec vitest run --isolate src/lib/paper-local-replay.test.ts src/lib/paper-sync-journal.test.ts
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

Schema provenance, capability admission, migration races, cross-schema refusal and multiple-tab recovery require the native schema/admission/sync fixtures and browser evidence. The one-tab prefix model does not prove these obligations.

Run `/maintain-formal-verification-skill` after changes to the covered code. Confirm the code, replay, model, and browser evidence agree before recording a new verification point. Keep `ContentStore.tla` unchanged.
