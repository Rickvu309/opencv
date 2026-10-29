# Architecture alternatives and adoption gate

Part of the [OpenCV stack assessment](index.md).

All sketches below describe possible future work. They are not current exported APIs or new contract entries.

### Baseline: retain the modular monolith

Keep the current typed reads/commands, feature adapters, product-module ownership and deployment split. Improve one query, cache policy or build layer only after finding its limiting cost. This has the lowest migration cost and preserves the existing executable boundaries. It lacks measurements needed to select a particular optimization.

### Candidate A: bounded reads within the current architecture

Start with an owner-local query change that leaves its public contract intact. For example, `apps/api/src/job/store.ts` currently filters selected Jobs in JavaScript; moving supported predicates into SQL is a smaller pilot than adding a summary contract. Preserve exact matching, null handling and ordering, and add an index only when PostgreSQL plans justify its read benefit and write/storage cost. Delete the replaced filtering in the same implementation; rollback is a code revert without stored-data reconciliation.

A shell caller should ask for exactly what it displays, without learning SQL or assembling several full lists. Keep commands and their registry effects unchanged. A hypothetical caller and contract shape are:

```ts
// Proposed shape only; final query name/schema follows a measured experiment.
const summary = useQuery(shellSummaryOptions())
// summary: recent Chats, favorite Paper/Jobs, unread Inbox count

type ShellSummary = {
  recentChats: readonly ChatSummary[]
  favorites: readonly FavoriteSummary[]
  unreadInboxCount: number
}
```

The domain owns the read schema/reference; `apps/web/src/lib` owns its key and transport; surface adapters expose the result to the shell. On the API, each product module exposes its bounded projection through its public index. A read coordinator composes those projections without writing their tables. No second command path, materialized cache or new service is required. Introduce a coordinator only if existing read ownership cannot express the composition clearly.

Register every command invalidation that can change this summary. Migrate shell callers together, then remove their obsolete full-list subscriptions; retain full-list reads for actual list screens. Test the visible ordering/counts and refresh after both person and Coach commands. Reject the design if composition increases total requests or duplicates policy. A large byte reduction is useful evidence but earns a latency claim only when the complete navigation improves.

Bounded Coach context is a separate, wider experiment. Preserve the current chronological last-40 window, recorded actions and regeneration through the latest person message; do not silently truncate the visible Chat history. Its selection/attachment and receipt semantics must match before replacing full-history admission reads.

### Candidate B: consolidate web rendering and API hosting

Move routes into a React framework such as TanStack Start, using static/server rendering where needed and server functions for reads. The caller still consumes domain data; authenticated actions still enter the registry:

```text
route loader/server function -> authenticated read -> product module
person/Coach command -> existing registry -> product module transaction
```

The route server would own session/cookie handling, read transport and public HTML. The pure domain contract, table ownership, command access/confirmation/idempotency and Coach stream protocol remain authoritative. A framework server function must not become a competing command implementation.

The proposed browser read interface is `readContract<N extends QueryName>(name: N, input: QueryInput<N>): Promise<QueryOutput<N>>`, hidden inside the web transport boundary. Server input remains untrusted: authenticate and parse against the existing contract, derive the actor from the session, and never accept actor or confirmation-bypass options from the browser. Exact Start APIs, adapter compatibility and component SSR behavior were not researched or prototyped; these must be verified against current official documentation before implementation.

The pilot would be one public route with equivalent content, followed only if justified by one authenticated read. Delete replaced route/transport/deployment code in each completed migration; do not operate two authoritative auth or command systems. Rollback must restore the static route without a data migration. A full consolidation also needs SSE proxy behavior, cookie origins, shutdown/cancellation, deployment and design-parity verification. Its broader migration cost is currently unsupported by an observed requirement or benchmark. No Start-specific performance claim is made here; React's framework guidance alone is insufficient.

### Selection

| Criterion                           | Baseline                 | Candidate A                                      | Candidate B                                                  |
| ----------------------------------- | ------------------------ | ------------------------------------------------ | ------------------------------------------------------------ |
| Shared person/Coach writes and auth | Preserved                | Preserved if summary stays read-only             | Must deliberately preserve registry and cookie policy        |
| Relevant measured 5× gain           | Not established          | Not established                                  | Not established                                              |
| Interface complexity                | Existing tested contract | One bounded read; invalidation work              | Rendering, server-function and hosting responsibilities move |
| Migration/reversal                  | No migration             | Migrate shell subscribers; no stored-data change | Route pilot reversible; whole-platform move much larger      |
| Release-one/deployment fit          | Existing fit             | Same processes and database                      | Adds migration and streaming verification cost               |

Select the baseline now. Candidate A begins with owner-local query work if database time dominates; its summary design is conditional on shell payload costs. Candidate B survives as an option for a proven rendering/hosting requirement; it is not selected. No new ADR supersedes the existing architecture because no new architecture is accepted.

## Evidence gate for implementation

1. Select one scenario and metric before tuning: Job detail p95, shell-ready time, Coach first token/completion, full delivery time or cost per successful turn. Capture current traces and representative data sizes.
2. Identify the limiter. If a change affects fraction f of elapsed time, eliminating that part gives at most `1 / (1 - f)` total speedup. Reaching 5× requires at least 80% of baseline time to be affected, and more when the replacement still costs time.
3. Build the smallest candidate beside the best current-stack fix. Use identical fixtures, outputs, network, hardware, concurrency and provider/model. Interleave repeated runs; separate cold/warm caches and include errors, variation and raw logs. A busy development host is not a production benchmark.
4. Verify behavior: ownership, confirmation, exactly one command effect/replay, Undo, person/Coach invalidation, Stop and route/design behavior as applicable. Use real PostgreSQL for concurrency and database-performance conclusions; a fake model cannot prove provider latency or output quality.
5. Apply only when the defined ratio reaches 5× with equivalent quality and acceptable migration/operating cost. Otherwise retain the baseline and record the bounded result. Do not turn a cache-hit microbenchmark into a whole-app claim.

## Verification performed

At the recorded baseline, the API boundary/ownership/name/command-coverage selection passed: four files, eight tests. The web contract-client/request-boundary/feature-import/UI-kit selection passed: four files, 22 tests. These 30 passing tests confirm selected existing architecture guards; they are neither exhaustive product verification nor performance evidence.

Commands run:

```sh
pnpm --filter api exec vitest run src/registry/boundaries.test.ts src/registry/ownership.test.ts src/registry/names.test.ts src/registry/coverage.test.ts
pnpm --filter web exec vitest run src/lib/contract-client.test.tsx src/test/request-boundary.test.ts src/test/feature-imports.test.ts src/test/ui-kit-contract.test.ts
```

No production benchmark, framework prototype, UI change, data migration or infrastructure change was performed. The application remains on its current architecture because the conditional implementation threshold was not established.
