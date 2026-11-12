---
name: verify-paper-local
description: Verify Paper input recovery, exact local completion, and the Saved gate after sync or storage changes.
---

# Verify Paper local saves

## Approved rules

D is observed IndexedDB transaction complete for the exact snapshot containing the current words. Input return, localStorage return, request success, and elapsed time are not D. New typing requires its own D.

Saved requires both D and a matching durable server receipt for the current words. Show Saving while either is missing. An older completion or an aborted transaction cannot cover newer input.

Ordinary close or reload preserves completed input through the synchronous per-tab journal and the pagehide flush attempt. Abrupt browser kill preserves words that crossed D. There is no pre-D kill promise.

Clear journal entries only after both IndexedDB complete and a matching server receipt cover those entries.

## Coverage and history

This model covers code scheduled for deletion. `openPaperSync` serves only the old CV and Letter editors (`apps/web/src/features/paper/paper-cv-editor.tsx`, `paper-letter.tsx`), which `apps/web/src/routes/paper-doc.tsx` opens only for an old Yjs row. The Word writing page saves through `paper.canvas` in `apps/web/src/features/paper-page/canvas-save.ts`, which this model does not cover.

`apps/web/src/lib/PaperLocal.tla` models `openPaperSync`, its journal, and `indexedDbStore`. Its action map names the implementation entry points. The approved replacement explicitly separates ordinary pagehide from abrupt kill and names `DurabilityPointD`. It replaces the earlier immediate-kill model under the coordinator's approved rule. The earlier model and the 23 lost cases out of 120 remain prior evidence; this change does not turn them into passes.

`paper-local-replay.test.ts` drives the real sync implementation with a fake server and controlled local completion. It checks fast receipt before D, older completion after newer input, transaction abort, and ordinary close recovery. `paper-sync-journal.test.ts` checks per-tab journal coverage and clearing. `scripts/paper-local-durable.test.mjs` checks the current Saved gate and old delayed-write mistakes against a main-history ancestor. These are controlled behavior checks, not physical disk proofs.

The sync commit and the covered files live in `"sync"` and `"covers"` of `apps/web/src/lib/PaperLocal.tla.json`. Run `node scripts/tlc.mjs --stale` to list every commit that touched covered files since then. Move `"sync"` forward only after you confirm the model still describes the code at the new commit, and use a commit on `main`. The historical mistake is main ancestor `a1831b78801edfac3063a7376dc46a72a08fa054`; it is not a claim that the approved model was verified at that commit.

## Run

Run sequentially with `TMPDIR=/home/quan/tmp` and the assigned heavy slot.

```sh
pnpm --filter web exec vitest run --isolate src/lib/paper-local-replay.test.ts src/lib/paper-sync-journal.test.ts
node --test scripts/paper-local-durable.test.mjs scripts/paper-local-journal.test.mjs
node scripts/tlc.mjs --all
```

All four CI-discovered safe configurations must exit 0. Their four paired mutants must exit 12. The canonical mutant drops the input journal and breaks ordinary close recovery. The other pairs independently clear the journal after only one confirmation, show Saved before D, and resolve local success before transaction complete. A mutant passing means the proof cannot see its intended mistake. Read every result with `/statechart`; keep the shortest broken paths in the report.

Follow the behavior checks on a scratch source mutation that makes `canShowSaved` always true; the fast-receipt test must fail. Restore the source and rerun. A scratch mutation that credits an older completion to the current version must fail the newer-input test. Keep source edits isolated and restore them before other checks or saving.

The browser evidence must record the observed complete event for the snapshot containing each test token, kill only after that event, and reopen the same isolated profile. Ordinary close/reload checks must include completed input whose IDB writes are held. Use fake providers. The old delay table does not measure D and cannot substitute for these checks. Keep full runtime scripts and results with the change report.

## Bounds

The model checks two cumulative edits, one document and tab, one transaction in progress, one ordinary close or kill followed by recovery, and one abort. It assumes completed snapshots are not later removed or overwritten by older writes. Prefixes abstract words and do not prove Yjs merge semantics, replacements, epochs, leases, orphan adoption, server idempotency, or multi-tab conflict policy. It checks safety, not eventual saving. Storage availability and delivery to the input subscription are assumed for ordinary lifecycle recovery. Quota denial, eviction, profile deletion, OS crashes, power loss, and browser implementation correctness are outside this model.

## When code changes

Run `/maintain-formal-verification-skill` after changes to the covered code. Confirm the code, replay, model, and browser evidence agree before recording a new verification point. Keep `ContentStore.tla` unchanged.
