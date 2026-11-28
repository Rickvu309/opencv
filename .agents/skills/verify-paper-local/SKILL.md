---
name: verify-paper-local
description: Verify Paper input recovery, exact local completion, and the Saved gate after sync or storage changes.
---

# Verify Paper local saves

The rich Paper editor saves through `openRichNativePaperSync` in `apps/web/src/lib/paper-native-transport.ts`, with recovery in `paper-sync-recovery.ts` and storage in `paper-sync-store.ts`.

## Approved rules

D is observed IndexedDB transaction complete for the exact snapshot containing the current words. Input return, localStorage return, request success, and elapsed time are not D. New typing requires its own D.

Saved requires both D and a matching durable server receipt for the current words. Show Saving while either is missing. An older completion or an aborted transaction cannot cover newer input.

Ordinary close or reload preserves completed input through the synchronous per-tab journal and the pagehide flush attempt. Abrupt browser kill preserves words that crossed D. There is no pre-D kill promise.

Clear journal entries only after both IndexedDB complete and a matching server receipt cover those entries.

## Recovery

The recovery scope contains the owner, document and format revision. It excludes the ephemeral sign-in session. An unreadable scan or incompatible record blocks readiness and retains the original bytes. Recovery rereads orphan snapshots after acquiring their locks and keeps those locks until shutdown. Shutdown hides the client immediately and retains its own lock until already queued persistence settles.

## Run

Run sequentially with `TMPDIR=/home/quan/tmp`.

```sh
pnpm --filter @workspace/paper-crdt build
pnpm --filter web exec vitest run --isolate src/lib/paper-sync-identity.test.ts src/lib/paper-rich-transport.test.ts src/lib/paper-rich-editor.test.ts
pnpm --filter api exec vitest run src/registry/paper-contract.test.ts src/registry/transaction.test.ts
```

The build comes first on a fresh worktree, or the web tests fail with `Failed to resolve import "@workspace/paper-crdt"`.

Follow the behavior checks with a scratch source mutation that shows Saved before D; `paper-rich-transport.test.ts` must fail. Restore the source and rerun. Keep source edits isolated and restore them before other checks or saving.
