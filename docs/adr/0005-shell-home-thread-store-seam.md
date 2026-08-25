# Thread list lives at the shell; no Home port until server Threads

History and Search are shell chrome. They must see Threads on every surface, so Thread list state is mounted on the shell — not behind a Home-only port. Supersede when Spec 3.5 or the Coach spec introduces server Threads (and then extract a thin list port against that model).

**Decision.** Keep the current mount: `AppShellLayout` wraps `ThreadStoreProvider`. Treat History and Search as shell concerns. Do not lift a Thread-list port into `features/home` (or invent `features/coach`) while Threads are still a client stub.

**Why the store sits on the shell.** Paper's mount is clean because Paper only fills the main pane. Threads are different: CONTEXT.md and ADR-0004 put recent Threads in sidebar History, and Spec 3 already assigned History and Search to app layout. Opening Paper, Apply, or Pitch must not unmount the Thread list. That lifetime is a shell concern.

**What chrome may depend on.** Shell modules may import the Home Thread hook for list operations only: `threads`, `activeThreadId`, `openThread`, `newChat`. Conversation internals (`messages`, `send`, `thinking`) stay on Home. Search already maps through `searchThreadsFromHome` to a chrome DTO — keep that, do not pass `HomeThread` into the modal.

**Why not a port now.** A port designed against today's `HomeThread` + localStorage + stub replies would freeze a shape Spec 3.5 / Coach will replace (server ids, persistence, Commands). QVE-98 already forbids inventing `features/coach` ahead of that spec. Three shell call sites are cheap to retarget when the real model exists.

**When to extract the port.** Spec 3.5 or the Coach spec — whichever first ships server Threads. Then introduce a thin list port owned by the Coach feature:

```ts
type ThreadListItem = { id: string; title: string }
type ThreadListPort = {
  threads: ThreadListItem[]
  activeThreadId: string | null
  openThread: (id: string) => void
  newThread: () => void
}
```

History and Search consume that port. Home/Coach keeps conversation internals. Do not file that refactor until the server model exists.

**Out of scope here:** Moving the provider under the Home route, renaming Home modules (QVE-98), or inventing `features/coach`.
