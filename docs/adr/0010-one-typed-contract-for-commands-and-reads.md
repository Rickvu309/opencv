# One typed contract for commands and reads

**Status.** Accepted 2026-10-27. Amends `docs/adr/0009-ai-native-backend.md` items 1, 4, 11 and 12. Implemented under #382 by PRs #404 to #428.

**Context.** After ADR 0009 the registry was the one write path, but each command's name, input shape, output shape and refresh rule were written again in the api, the web client, the fake Coach and the tests. Agents kept repeating the same mistakes: a name typed wrong in one place, a screen that did not refresh after a write, a retry that ran a command twice. The temporary `compat/` routes also kept a second set of names alive.

**Decision.**

1. **The contract lives in `packages/domain`.** Each surface declares its commands and most of its reads in `<surface>-contract.ts` (`chat`, `paper`, `job`, `inbox`, `account`). The chat reads, `link.get` and `workspace.search` are declared in `queries.ts` itself. A command entry carries `description`, zod `input` and `output`, the Coach policy (`coach` and `destructive`), `idempotency` (`keyed` or `none`), the `step` label and `invalidates`, the reads the command makes stale. `contract-commands.ts` spreads every surface into one `commands` table and `queries.ts` does the same for reads.
2. **The api binds, it does not declare.** Each module's `commands.ts` calls `bindCommands(registry, <surface>Contract, { ... })` with the handler, the reversal and the activity line for every name in the contract. A missing or extra binding is a type error. Reads bind through `tableQuery`.
3. **Commands go through one client.** `apps/web/src/lib/contract-client.ts` owns `runContractCommand`, `queryKey`, `refreshQueries` and `undoActivity`. After a command it refreshes exactly the reads in `invalidates`. Reads are fetched with `apiFetch` (`lib/api.ts`) on the paths in `lib/requests.ts`. Fetch calls, API paths and query invalidation stay inside `apps/web/src/lib`.
4. **The Coach stream is typed once.** `ChatTurnEvent` in `packages/domain/src/chat-turn.ts` is the SSE contract, and `apps/web/src/lib/coach-stream.ts` is its only reader.
5. **Compat is gone.** The compat layer was deleted in #418.

**Consequences.** Adding a product action is one contract entry, one binding, one case in `apps/api/src/registry/coverage-<surface>.ts` (arrange, act, assert, and an undo assertion for a reversal) and one web call. The Coach tool, step label, activity line, Undo and screen refresh follow from the entry. A per-call option where a contract field fits is a review finding. These tests hold the structure: `apps/api/src/registry/names.test.ts`, `coverage.test.ts` (every command has a case), `ownership.test.ts`, `boundaries.test.ts`, the `*-contract.test.ts` files, `contract.type-test.ts`, and `apps/web/src/test/request-boundary.test.ts`.

## Adding a product action

1. Add a command entry to `packages/domain/src/<surface>-contract.ts`, with `invalidates` naming the reads it makes stale.
2. Bind it in `apps/api/src/<surface>/commands.ts` with its handler, reversal and activity line.
3. Add a case to `apps/api/src/registry/coverage-<surface>.ts`.
4. Call it from the web with `runContractCommand` from `apps/web/src/lib/contract-client.ts`.

## Tests that hold this shape

`CODING_STANDARDS.md` (Contract) pairs each rule with its check, and `node scripts/list-checks.mjs` lists every guard.
