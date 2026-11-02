# Code map

Where things live. The rules for them are in `CODING_STANDARDS.md`.

- `packages/domain/src` holds the typed contract.
  - `<surface>-contract.ts` declares each surface's commands and most of its reads.
  - `queries.ts` joins every read and declares the chat reads, `link.get` and `workspace.search`.
- `apps/api/src/<module>/` is one product module.
  - `commands.ts` binds the module's contract commands with `bindCommands` and its reads with `tableQuery`. `account` binds its reads in `queries.ts`.
  - `job/fetch-posting.ts` is the internal-host guard. `job/store.ts` reads a posting into fields, with the Coach's `interpretPosting` when `interpretPostings` is on.
- `apps/api/src/registry/` runs every command and builds the Coach's tools.
- `apps/api/src/coach/` runs a Coach turn and has no contract commands. See `docs/coach.md`.
- `apps/web/src/lib/contract-client.ts` owns read keys and refresh.
