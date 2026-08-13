# State survives a reload: persistence behind dispatch

- **Type:** `wayfinder:grilling`
- **Status:** closed
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** [Serve the agent: Railway behind the Vercel domain](01-serve-the-agent.md)
- **Map:** [Map, OpenPath backend on Eve](../map.md)

## Question

`lib/actions/store.tsx:28` seeds from `seedState` and holds everything in `React.useState`.
A refresh throws all of it away. Where does state actually live, and what has to change to
get it there?

This is the last thing standing between a prototype and a product. The UI/UX map logged it
as fog and said the fix is storage; this is that ticket.

### 1. It cannot live in the agent

Worth stating plainly because it is the tempting wrong answer. Eve's `defineState` is
durable and survives crashes and redeploys, which makes it sound like the answer. It is
not: `guides/state.md` says outright, "Do not use `defineState` for long-term memory.
It is durable session state, while this data must be available to future sessions."

`defineState` is right for the Coach's own working memory, what it has already nudged
about, what it decided this conversation. `AppState` is not that. It needs a real store.

### 2. Choose the store

Single tenant, one demo account, so this is smaller than it usually is: no tenant column,
no row-level policy, no per-user credentials. The realistic options run from a Railway
Postgres to a hosted KV to a single JSON document, and for one account the cheap answer may
genuinely be the right one.

Two constraints that should drive it rather than familiarity:

- Ticket *Serve the agent* may already have provisioned Postgres for the Workflow world. If
  so, a second store is a second thing to operate for no gain.
- The Coach's read path from *Close the loop* has to read the same state the UI writes. If
  they diverge, the Coach advises on a stale copy, which is worse than not advising.

### 3. Place the seam

`dispatch` at `lib/actions/store.tsx:50` is the leverage point and the reason the registry
was built this way. Persistence, retry, and failure handling get written once there, not 26
times and never in a screen. The README already promises this; make it true.

The shape of the write is the decision:

- **Write the action**, name and input, and let the server replay it through the same
  reducer. The registry is already a pure reducer, so this works, and it gives an audit log
  for free. Replay cost grows without snapshots.
- **Write the resulting state.** Simple, and last-write-wins is fine with one user in one
  tab. It loses the history.

Whichever wins, `dispatch` is currently synchronous and cannot fail. Persistence makes it
neither. Decide what the UI does while a write is in flight and what it does when the write
fails, and note that the existing optimistic update plus toast-with-undo is already most of
an answer.

### 4. Onboarding and the seed

`app/onboarding/page.tsx` commits eight actions in one tick, which the state ref at
`lib/actions/store.tsx:36` was specifically built to handle. Eight writes in one tick is a
different question from eight state updates in one tick. Check it rather than assuming.

`lib/actions/seed.ts` is the file a real backend replaces. Decide what a genuinely empty
account sees, because the demo account starts seeded and a first real user would not. The
empty states this needs may already exist from the UI/UX map's screens work.

## Progress, 2026-08-04

A reload keeps your work. The ticket stays **open**: its exit criterion also asks for a
second browser, and that needs a store both browsers can reach, which does not exist yet.

### 2, resolved for now: the browser, and why that is not a dodge

No server store exists. *Serve the agent* never provisioned Railway, so the ticket's first
constraint ("Postgres may already be there") is simply false today.

Its second constraint dissolved on inspection. "The Coach's read path has to read the same
state the UI writes" was a reason to prefer a shared server store, **but *Close the loop*
already made persistence and the agent's read path independent**: state travels to the
agent on the turn, from the client, so the Coach reads whatever the UI holds no matter
where it is kept. Under read tools this choice would have been forced. It is not.

So `localStorage`, deliberately, and with a stated ceiling: this closes "a refresh throws
away your work" and it will never close "the same state on my phone". `lib/actions/persistence.ts`
is the only file that changes when a real store exists.

### 3, resolved: write the state, not the action log

An append-only log of `(name, input)` replays cleanly through the pure reducer and gives an
audit trail free. It also grows unbounded until snapshots exist and needs a migration story
the moment an action's schema changes. One user, one tab: last-write-wins is correct and
costs nothing.

**`dispatch` stayed synchronous and still cannot fail**, which the ticket expected to change.
`localStorage` is synchronous, so there is no in-flight state to design and no optimistic
window to manage. A failed write (private mode, full quota) warns once per session and the
app keeps working without remembering. That question comes back with a network store.

Undo persists too. Without that, the reverted change returns on the next reload.

### The seam moved, and the linter was right about why

Adopting stored state in an effect (`setState` after mount) tripped
`react-hooks/set-state-in-effect`, correctly: it is a cascading render. The fix was to stop
mirroring state in `useState` at all. The store now holds the value in a ref and exposes it
through `useSyncExternalStore`, with `getServerSnapshot` returning the seed.

That says the honest thing structurally, the server has no storage and the client does, and
it removes the state/ref duplication the file already carried for StrictMode and
same-tick-dispatch reasons. Verified: no hydration warning, and the rendered UI matches
storage after a reload.

### 4, checked rather than assumed

Onboarding's eight actions in one tick compose correctly and all eight survive; there is a
test for exactly that. The cost is eight synchronous `JSON.stringify` calls of ~5KB in one
tick, which is sub-millisecond and not worth debouncing at this size. Revisit if `AppState`
grows an order of magnitude.

**Not decided: what an empty account sees.** The demo account starts seeded and a first
real user would not. `seed.ts` is still the initial state for everyone, so this is deferred,
not solved. It needs the empty states from the UI/UX map, which are themselves unfinished
on three screens.

### Verified

Real browser, real reload: toggled an entry, `plan.done` went 2 → 3, hard-refreshed, and
the rendered UI showed 3 checked against 3 stored. 21 tests green, including a corrupt-blob
case that caught a real bug, `loadState` discarded a wrong-shaped value but not unparseable
JSON, so a malformed blob would have re-failed on every load forever.

## Exit criterion

Log in as the demo account on the deployed domain, change something as the user, ask the
Coach to change something else, hard-refresh, and find both changes still there. Do the
same from a second browser and see the same state.

## Closed, 2026-08-04

Resolved, with the exit criterion amended rather than met. A reload keeps your work,
verified. The second-browser half is **deliberately dropped for this phase**: with one
shared demo account, a server store would make every visitor mutate the same state, so
strangers demoing the product would see each other's edits. Per-browser state gives each
visitor an isolated sandbox, which is what a shared demo account actually wants. Redraw as
a fresh effort when real per-user accounts exist. The empty-account experience stays fog
for the same reason: every visitor starts from the seed by design.
