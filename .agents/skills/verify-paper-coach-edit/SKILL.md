---
name: verify-paper-coach-edit
description: Check a change to Paper proposals, approval, basis validation, retries, or Undo with CoachPaper and the registry replay.
---

# Verify a Coach Paper edit

Reconciled against accepted `origin/main` at `786a35120d157e65f72f575351c91cf9cb0b627d` and the issue 1540 qualified client and Coach context candidate on 2026-11-15. The completed clean, paired-mutant, clean runs and registry replays produced the results below. The sync commit names accepted main, not an invented candidate commit.

## When this file is stale

Run `node scripts/tlc.mjs --stale` first. When it lists `apps/api/src/paper/CoachPaper.tla` as STALE, or `git log --oneline 786a35120d157e65f72f575351c91cf9cb0b627d..origin/main -- .agents/skills scripts/tlc.mjs` prints commits, rerun every command under Run before trusting a claim here. If a command fails or prints something else, believe the command, fix this file in the same PR, and move the commit above. The clean configs exit 0, the mutants exit 12, `coach-paper-replay.test.ts` prints `Tests 4 passed (4)` and `mcp-proposal-replay.test.ts` prints `Tests 2 passed (2)`.

Use this when a change touches a Coach proposal on a CV or letter, the approval of that proposal, the basis check, a retry of the same proposal, or Undo of that edit.

## Rules

The document is unchanged until approval. A stale basis does not approve, and the bytes stay as they were. Undo of that edit keeps later typing, or refuses and changes nothing. The same proposal commits once. An agent has no Undo action.

These are the five rules of `CoachPaper.tla`. Do not weaken a rule to clear a finding. A mutant that passes is a failure of this check.

## Where the code lives

Every Paper is a Yjs Paper, and `paper.edit` always takes this branch with a numeric `basedOn` (`apps/api/src/paper/operations/edit/server.ts`). The MCP Job reading at the end is live.

- `apps/api/src/paper/content-coach.ts` exports `editAsCoach`, `stalePaperBasis`, and `revertCoachEdit`. `stalePaperBasis` returns `refuse` when `basedOn` is not the current revision, and `apply` when it matches. `editAsCoach` calls it only for a coach actor, and throws before any write. Switching that return from `refuse` to `apply` is the one-line change to a clean merge. The replay and the guard `paper-coach-basis` both require `refuse`.
- `apps/api/src/paper/content/content-store.ts` exports `coachBasisOk`, `withContent`, and `syncContent`. `coachBasisOk` still allows an older basis for a legacy person edit. Native numeric edits additionally require a qualified writer and an exact canonical native basis for every actor before hydration or mutation. Do not use it as the coach approval rule. `syncContent` is the person write that raises the revision.
- `apps/api/src/registry/proposals.ts` exports `createProposal` and `lockProposal`. `createProposal` inserts a pending row and does not write the document. The basis read and the write stay one lock inside the approval transaction.
- `apps/api/src/registry/registry.ts` holds `execute`, `approve`, `undo`, and `tools` as methods. They are not separate exports, so the coverage map cannot name them. A coach actor whose policy is `confirm` calls `createProposal` and does not run the effect. `approve` returns the saved activity when that proposal is already approved. That return is the retry. A throw inside the effect rolls the bytes back and leaves the proposal pending. `undo` runs the reversal as the person.
- `apps/api/src/registry/coach-policy.ts` exports `coachRefusal`. `tools` and `execute` consult it. A refusal omits the command from the coach tools and rejects a coach execute with `COACH_NOT_ALLOWED`.
- `packages/domain/src/operations/paper/edit/operation.ts` sets the `coach` field of `paper.edit` to `confirm`. The test `packages/domain/src/paper-edit.test.ts` requires it.

`apps/api/src/paper/ContentStore.tla` models the Yjs log under both basis rules. Its `Coach` action is a coach actor: `editAsCoach` lands only on the revision it read, through `stalePaperBasis`, and the action property `CoachExact` in `ContentStore.coach.cfg` checks that rule. Its `PersonMerge` action is a signed-in person who posts `paper.edit` with a numeric `basedOn` to `createCommandRoutes` in `apps/api/src/registry/http.ts`, which runs it as `personActor`: `coachBasisOk` still lets that legacy edit merge onto an older revision. Native edits are a stricter admitted branch, not the `PersonMerge` interpretation. A delegate never takes that path: its `paper.edit` is held for the person's approval, and the `basis` read in `apps/api/src/paper/operations/edit/server.ts` refuses another person's Paper exactly as an unknown one (`apps/api/src/paper/paper-agent-isolation.test.ts`). P1, P2, P3 and P5 run with both actions. `ContentStore.coach.mutant.cfg` gives the coach actor the person rule and must exit 13 on `CoachExact`. Every other ContentStore mutant must exit 12 on its own invariant. `ContentStore.tla.json` names the code of each edit action under `"boundaries"`. `node --test scripts/tla-specs.test.mjs` fails when a `"boundaries"` entry names something its file does not define, such as an import, or a file that `"covers"` does not list.

`apps/api/src/paper/CoachPaper.tla.json` maps each model action to one export of `content-coach.ts`. Null means the action is implemented outside that file.

- `Propose` is null. The function is `createProposal` in `apps/api/src/registry/proposals.ts`.
- `PersonTypes` is null. The function is `syncContent` in `apps/api/src/paper/content/content-store.ts`.
- `Approve` is `editAsCoach`. It calls `stalePaperBasis` and then writes.
- `RetryApproval` is null. The path is the early return in `Registry.approve` when the status is already approved.
- `PersonUndo` is `revertCoachEdit`.
- `AgentTriesUndo` is null. The function is `coachRefusal` in `apps/api/src/registry/coach-policy.ts`.

## Historical failure

Commit `a5c61cac` auto-executed `paper.edit` for a Coach actor, because the contract said `coach: "auto"`. It also accepted a safely mergeable stale revision, because approval called `coachBasisOk`, which treats `basedOn` at or below the current revision as safe. Confirm the strict behavior with the registry replay, which must refuse that stale basis.

## Run

From the repository root, one heavy command at a time.

```sh
node scripts/tlc.mjs apps/api/src/paper/CoachPaper.tla
node scripts/tlc.mjs apps/api/src/paper/CoachPaper.tla --mutant
node scripts/tlc.mjs apps/api/src/paper/CoachPaper.tla
pnpm --filter api exec vitest run src/paper/coach-paper-replay.test.ts
```

The first command uses `CoachPaper.cfg`. Both `RequireApproval` and `BasisCheck` are TRUE. Exit 0.

The second command uses `CoachPaper.mutant.cfg`. `BasisCheck` is FALSE, so `StaleBasisRefusesWithoutWriting` fails. Exit 12. The runner discovers that mutant by pairing `CoachPaper.cfg` with `CoachPaper.mutant.cfg`.

The Vitest file replays the shortest path against `content-coach` and the registry. A coach `paper.edit` stays pending and the snapshot matches. After the person types, approval rejects with `CONFLICT` and the bytes match the snapshot from before the approval. One approval applies once. A second approval returns the same activity and writes nothing. Coach tools omit `activity.undo` and `paper.revertEdit`, and a coach execute of `activity.undo` rejects with `COACH_NOT_ALLOWED`. Person Undo either keeps later typing or rejects with `CONFLICT` and an unchanged snapshot.

Read every TLC result with `/statechart`. Copy none of its commands or install paths into this skill. The chart title is `Coach changes a Paper`.

Show the three results in order. Clean, then the failing mutant, then clean again. Keep that evidence. A pass on the mutant means the check can no longer see a skipped basis check.

## Bounds

One document. One immutable proposal. One person typing event. Revisions 0 through 3. One person Undo. One agent Undo attempt. Approval reads the basis and writes in one transaction. Byte sets stand in for document text. This check does not prove a Yjs merge, an auth session, or a durable task.

## Native admission reconciliation

Accepted save isolation at `876b9f7b80935dbf12709c937174f7ec1dbb039d` preserves detached hydration, a fork for each attempt, and cache promotion only after successful transaction completion. Recovery merge `e1f9be65238b08f3a77cbeba7da2418c0d27c98c` changes browser retry ownership and explicit idempotency keys; it does not change the modeled registry or numeric Paper transitions. The earlier Word routing commits keep string revision edits outside this projection. Accepted Letter compiler commit `786a35120d157e65f72f575351c91cf9cb0b627d` changes rich native Letter Word output and has no effect on these modeled approval transitions. No invariant, model, bound, clean configuration or original paired mutant changed.

For privately seeded native v4r1 documents, `withContent` admits the writer and exact `nativeBasis` against locked canonical data before hydration, reset, acknowledgement or the callback. Every numeric edit forwards `proposal: true` for this native admission, independently of the existing actor-specific `checkedBasis`. `commit` compares kind, version and native schema revision before any database write. Reversal forwards its writer. These restrictions preserve the approval projection while refusing additional native states before a modeled write can happen.

The model does not prove native canonical digests, provenance, epochs, schema identity, unknown-node refusal, Unicode offsets, marks, direct Yjs admission, authentication, per-attempt cache isolation or outer transaction rollback. Those require the concrete tests below. `ContentStore.tla.json` retains its earlier sync marker and legacy mapping; the runs here validate that bounded projection, not a claim that all ContentStore metadata is globally fresh. Public creation stays legacy, old unqualified native sync refuses, and that admission unit supplied no native browser CORS or native editor activation.

```sh
pnpm --filter api exec vitest run src/paper/native-admission.test.ts src/paper/content-store.test.ts src/paper/content-sync-native-http.test.ts
pnpm --filter api exec vitest run --config vitest.formal.config.ts src/paper/content-sync.formal.test.ts
node --test scripts/paper-content-isolation.test.mjs scripts/tla-specs.test.mjs
```

The native admission, store and real HTTP replay passed 14 tests. The sync formal replay passed 5. The detector fixture file passed 2 tests and the TLA metadata suite passed 42. The HTTP replay uses disposable private data and its own loopback server; it covers strict writer refusal before mutation, unchanged state after unauthorized or bad-basis attempts, qualified edits, stale refusal, metadata, duplicate, typed reversal and legacy create/read. It is not browser or live-model evidence.

Run every ContentStore configuration as clean, paired mutant, clean using `node scripts/tlc.mjs apps/api/src/paper/ContentStore.tla --config <configuration>`. The configurations are `ContentStore.cfg`, `ContentStore.coach.cfg`, `ContentStore.seq.cfg`, `ContentStore.version.cfg` and `ContentStore.sync.cfg` in `apps/api/src/paper`. Insert `.mutant` before `.cfg` for each paired mutant. All clean runs exited 0. The coach mutant exited 13 on `CoachExact`; the other mutants exited 12 on their invariant. Statechart extraction confirmed the counterexamples; its mutant exit is 1. The 6,701-state clean ContentStore runs exceed the 500-state drawing budget, so no full clean chart is claimed.

CoachPaper and MCP each reached 42 states and 58 steps. Their unchanged mutant counterexample is Propose, PersonTypes, Approve: the stale proposal commits when basis checking is disabled. Both clean runs on either side passed. The real Paper registry replay passed 4 tests, and the official MCP SDK loopback replay passed 2. These concrete replays preserve the original assertions and show that the modeled skipped-basis failure is refused by the implementation.

## When the code changes

After a change to the files named above, run `/maintain-formal-verification-skill`. Update this skill only after the model still matches the code and the replay still refuses a stale basis. Never weaken a rule to clear a finding.

The sync commit and the covered files live in `"sync"` and `"covers"` of `apps/api/src/paper/CoachPaper.tla.json`. Run `node scripts/tlc.mjs --stale` to list every commit that touched covered files since then. Move `"sync"` forward only after you confirm the model still describes the code at the new commit, and use a commit on `main`.

## MCP connection proposing a Job change

Use the same CoachPaper model and the same five invariants for the MCP approval path. The chart title for this interpretation is `An agent proposes a change`. The agent is one immutable MCP connection, owned by the person. The document and revision represent one Job head and its stored revision. The model does not quantify over connections, users or Jobs; ownership and live grants are concrete replay checks.

The local mapping supplements the Paper-only module map; it does not change that map's exported symbols.

| Action         | MCP and Job source                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Propose        | `createProposal` in `registry/proposals.ts` stores the delegate connection, person, immutable input and Job basis revision. `connectionRoutes` in `connections/http.ts` returns its literal proposalId and approval link. |
| PersonTypes    | `writePriority` in `job/store.ts`, bound by `job/operations/set-priority/server.ts` changes the same Job head as a person.                                                                                                |
| Approve        | `Registry.approve` in `registry/registry.ts` locks the proposal, calls `requireLiveProposalConnection`, checks the Job basis through registry execution and commits in the same transaction.                              |
| RetryApproval  | `Registry.approve` returns the already committed activity by the proposal's stable intent key.                                                                                                                            |
| PersonUndo     | `Registry.undo` executes the stored reversal as a person, checking the current Job revision.                                                                                                                              |
| AgentTriesUndo | `delegateAllowed` in `registry/delegate-policy.ts` excludes activity.undo; the MCP registry exposes only declared Job operations.                                                                                         |

Run the additional discovered configuration and its paired mutant through the supported runner, then repeat the clean configuration.

```sh
node scripts/tlc.mjs apps/api/src/paper/CoachPaper.tla --config apps/api/src/paper/CoachPaper.mcp.cfg
node scripts/tlc.mjs apps/api/src/paper/CoachPaper.tla --config apps/api/src/paper/CoachPaper.mcp.mutant.cfg
node scripts/tlc.mjs apps/api/src/paper/CoachPaper.tla --config apps/api/src/paper/CoachPaper.mcp.cfg
pnpm --filter api exec vitest run src/connections/mcp-proposal-replay.test.ts
```

Clean exits 0. The mutant exits 12 with StaleBasisRefusesWithoutWriting, not a timeout or setup error. The replay uses the official SDK over real loopback HTTP, a separate person session, a response stream lost after commit, keyed approval retries, stale Job refusal, revocation and person Undo. Default storage is migrated PGlite. MCP_REPLAY_DATABASE_URL selects an existing external Postgres schema without initialization or reset; its unique test person and Jobs remain for later owner cleanup.

The byte-set abstraction proves the same bounded approval and retry rules. It does not prove scalar priority replacement, OAuth, live connection revocation, cross-person access, HTTP delivery or multiple-head concurrency. Those require the concrete replay and independent browser approval of the returned link. A model pass never substitutes for those checks. Paper and MCP configurations keep the existing one-head, one-proposal, one-person-write and revision 0 through 3 bounds. No second proposal model is introduced.

## Qualified client and Coach context reconciliation

Issue 1540 preserves the same immutable proposal, transactional approval and receipt Undo transitions. Server grounding reads the native revision and exact basis from one qualified outline. The saved fake-provider context and proposal retain that basis and writer. These transports add no modeled state transition. A fresh outline after an effective edit is a prompt requirement; exact stale-basis refusal is enforced by native admission. This model does not prove that the runtime forces another read before a second proposal.

On 2026-11-15 all seven configurations above completed clean, expected mutant failure, clean: CoachPaper, CoachPaper.mcp and the five ContentStore configurations. CoachPaper mutants failed StaleBasisRefusesWithoutWriting with exit 12. ContentStore.coach failed the action property CoachExact with exit 13; the other ContentStore mutants failed their invariants with exit 12. No timeout counts as mutant evidence. The concrete Coach Paper and MCP registry replays plus content-store tests passed 10 tests.

```sh
pnpm --filter api exec vitest run src/coach/native-context.test.ts src/coach/native-task.test.ts src/paper/content-sync-native-http.test.ts src/coach/worker-approval.test.ts
pnpm --filter web test src/lib/paper-qualification.test.ts src/lib/paper-command-input.test.ts
node --test scripts/paper-native-client.test.mjs
```

The native task replay checks each stale epoch, revision, digest and provenance against unchanged canonical rows, log and receipts. It preserves the pending input and durable intent key, drops an approval response after commit, replays the task effect after a lost response, and checks one receipt and exact Unicode and underline on Undo. The client tests check all four opt-in read routes, runtime schemas, cache scope and cancellation. Those tests are separate from the bounded models. Independent browser evidence passed using the existing private fixture and a real browser at web origin 5540 against API origin 4540. Actual credentialed OPTIONS and GET responses exposed the native basis; the incompatible writer was refused. The existing Coach UI preserved the pending document, applied the person-approved proposal, displayed its receipt and restored exact Unicode and underline through Undo. A seeded normally issued session was used after the shared preview sign-in hit the local rate limit. Qualified public shares admit only their document against the declared writer and supply no edit authority; owned reads still require their exact basis. Public native editor, sync, creation and share rendering remain staged.
