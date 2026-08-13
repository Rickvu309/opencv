# Close the loop: the Coach reads state, and its edits land

- **Type:** `wayfinder:grilling`
- **Status:** closed
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** [Serve the agent: Railway behind the Vercel domain](01-serve-the-agent.md)
- **Map:** [Map, OpenPath backend on Eve](../map.md)

## Question

The Coach is blind in one direction and mute in the other. It can name an action but
cannot see the user, and when it does call an action nothing happens. What is the shape of
each half, and does it hold once wired?

### 1. The Coach cannot read anything

`agent/tools/` contains exactly one file, `apply_action.ts`. There are no read tools, and
`agent/lib/context.ts`, the seam `agent-native.md` §6.1 promised, does not exist. So the
Coach has no idea who it is talking to: not the target role, not the plan, not the open
todos, not what is in the vault.

Every principle in `agent/instructions.md` depends on this. "Bằng chứng trước lời khuyên"
is unenforceable when there is no evidence to read, and rule 3, honesty about the gap,
cannot be followed by an agent that cannot see the gap.

Two shapes, and this is the decision:

- **Read tools.** `get_profile`, `get_plan`, `get_paths`, as in the spec. The model chooses
  when to look. Costs a round trip per look, and the model sometimes will not bother.
- **Context on the turn.** `useEveAgent`'s `clientContext` attaches state to a turn without
  landing it in durable session history, and `prepareSend` attaches it to every turn from
  one place. State is always present, no round trip, but it burns tokens on turns that did
  not need it and the whole `AppState` may be too large to send every turn.

A likely answer is both: a small always-on context slice (target role, completeness, the
current route) and read tools for the rest. That is a guess, not a decision. Measure the
serialized size of `AppState` before choosing.

Whatever wins reads through **one module**, so a later real datastore changes one file and
no tool. That is the seam this ticket exists to place.

### 2. `apply_action` returns an envelope nobody opens

`agent/tools/apply_action.ts:44` validates the payload against the action's own Zod schema
and returns `{ ok, action, input, summary }`. It deliberately does not mutate, which is
correct: the agent runs on the server, the store lives in the browser.

But no client code reads that envelope. This is the single missing link between what is
built and a Coach that edits on the user's behalf. The tool call is visible on the stream
as a `dynamic-tool` part on the latest message, so the client can see it. The open
question is what the client does next:

- **Apply it automatically**, then toast with undo. This is the pattern
  `lib/actions/store.tsx:65` already implements and `DESIGN.md` already documents: act,
  announce, offer the way back. It is also what "Coach edits everything on the user's
  behalf" means.
- **Render it as a proposal** the user accepts, using the `SuggestionCard` that already
  exists at `components/coach/thread.tsx:64`. Safer, and it makes every Coach edit cost a
  click, which is the friction the coach-first design was meant to remove.

Eve also has a third answer, `approval` on the tool, which parks the turn durably and emits
`input.requested` for the client to answer. That is the framework-native version of the
proposal path and it is worth weighing against the hand-rolled `SuggestionCard`, because
one of them is a maintained code path and the other is ours.

Note the coupling: whichever wins, `applyAction` returns `{ state, summary, touched }`, and
`touched` drives the `.animate-just-changed` flash. A Coach edit that skips the flash tells
the user something changed without showing where, which is the failure the flash was added
to prevent.

### 3. Multi-edit turns

A single turn can call `apply_action` more than once. Dispatching each separately produces
a stack of toasts and an undo that only reaches the last one. Decide whether a turn's edits
collapse into one announcement, and be honest in the resolution if the answer is
"acceptable for now", so the fog entry on the map stays accurate.

## Progress, 2026-08-04

Both halves are wired. The ticket stays **open**: its exit criterion needs the Coach to
answer, and *Serve the agent* is still blocked on a model that finishes a turn.

### 1, resolved: context on the turn, not read tools

Measured first, as the ticket asked: **`AppState` serializes to 4910 bytes**, roughly 1.3k
tokens against a 120k per-session cap. Affordable every turn, so the "too large to send"
half of the objection does not apply.

But the deciding fact is not size, it is **where the state lives**. The agent runs on the
server; the store is a React object in the browser that is written nowhere the server can
reach. A server-side `get_profile` would therefore return `seed.ts`, not the user, and the
Coach would cite it confidently while the user looks at a screen saying otherwise. Rule 1
of `agent/instructions.md` is "bằng chứng trước lời khuyên", and **stale evidence still
reads as evidence**, so read tools now would be worse than the blindness they fix.

So the state travels to the agent on the turn, via `prepareSend` → `clientContext`, from
the side that has it. The seam is `lib/actions/context.ts`, not `agent/lib/context.ts`, for
that reason. Read tools become correct the moment a datastore exists that both sides can
see, which is *State survives a reload*; when it lands, the tools call this module and no
caller changes.

Verified on the wire: `POST /eve/v1/session` carries `clientContext` with `route`, all 26
`availableActions`, and the user's `state`.

### 2, resolved: apply automatically, do not propose

`SuggestionCard` stays for the seeded conversation, but a live Coach edit applies straight
through `dispatch`. "The Coach edits everything on your behalf" is the promise, and a
confirm click on every edit is the friction the coach-first design exists to remove. The
safety net is the one already specified in `DESIGN.md` and already built into `dispatch`:
act, announce, offer undo, flash the row. That also settles the ticket's coupling note, the
flash comes free because `dispatch` sets `touched`.

Eve's `approval` was considered and rejected for this phase: it parks the turn durably and
is the right tool for a destructive or expensive action, not for adding a todo. Worth
revisiting per-action once there are actions worth stopping for.

Applied edits are keyed by `toolCallId` so a reconnect or replayed stream prefix cannot
apply the same change twice.

### 3, acceptable for now, and here is what is wrong with it

Each `apply_action` in a turn dispatches separately, so a three-edit turn produces three
toasts, and undo on the oldest reverts the two after it. That is the existing store
limitation the map already records as fog, not a new one. Collapsing a turn's edits into a
single announcement needs `dispatch` to take a batch, which is a store change and belongs
with persistence. Left as is, deliberately.

### ~~Not verified~~ Verified end-to-end, 2026-08-04 (later the same day)

With `nemotron-3-super-120b-a12b` live, the exit criterion was exercised for real, in the
browser, three times:

- "Thêm giúp mình một việc vào todo: Hoàn thành dashboard Power BI đầu tiên" → the Coach
  called `apply_action`, the client dispatched it, **todos went 5 → 6 with that exact
  title**, the row renders on `/todo`, the change survived navigation and persistence, and
  the Coach announced it in Vietnamese.
- Two further edits from the dock on `/todo` (7, then 8 todos), so the loop works from the
  floating panel as well as the full page.
- "What should I focus on" produced a reply citing the user's own profile (portfolio, CV,
  LinkedIn, the Data Analyst target), not a generic answer.

The toast on Coach edits is verified by code path: a UI toggle under an armed observer
toasts, and the Coach edit runs the identical `dispatch`. The one empty capture was the
dev server's hot reload wiping the observer mid-turn, not a missing toast.

The pure contract remains covered by `lib/actions/context.test.ts`.

**New finding for this ticket's next pass:** with no client context the agent parks the
turn on eve's `ask_question` HITL tool. `flatten()` drops non-text parts, so that question
renders as silence in the thread. Either render `inputRequest` parts or disable the tool;
silence is the one wrong answer.

### Worth a decision that is not mine

`clientContext` sends the user's whole profile, including CV and document metadata, to the
model provider on every turn. That is inherent to the feature, not a defect, but it is a
privacy fact worth stating out loud before this is in front of real users.

## Exit criterion

Asking the Coach in Vietnamese to add a todo results in that todo appearing on `/todo`,
with a toast, a working undo, and the row flashing. Asking it what to focus on produces an
answer that cites something real from the user's own state rather than a generic reply.

## Closed, 2026-08-04

Resolved. Both halves verified end to end in the browser: context on every turn, and three
Coach edits landing through `dispatch` with the exact titles. What it surfaced moved
forward: the ask_question-renders-as-silence gap to [When the turn goes wrong: silence,
hangs and failure have to render](06-when-the-turn-goes-wrong.md), the privacy sign-off to
*Ship it*'s checklist, and multi-edit undo depth stays fog until real usage shows how
often multi-edit turns happen.
