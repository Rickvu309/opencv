# Map, OpenPath backend on Eve

`wayfinder:map`

## Destination

The Coach runs for real: a deployed Eve agent that reads the user's actual state, changes
it through `lib/actions/registry`, and keeps those changes after a reload, reachable on
`openpath-app.vercel.app` behind the demo account.

Reached when all three tickets are closed and a fresh browser can log in as the demo
account, ask the Coach to change something, see it happen, refresh, and find it still
there.

## Notes

**Domain**, Next.js 16 App Router on Vercel, Eve 0.29.5 as the agent runtime, Railway as
the agent host. Vietnamese-language product for young Vietnamese jobseekers.

**This map changes code.** It overrides Wayfinder's plan-don't-do default, the same way
the UI/UX map did: each ticket decides, *and* lands the code, *and* verifies it against a
deployed URL rather than a local dev server. A backend decision that has not survived
contact with the deployed environment is not decided.

**Read the docs in `node_modules/eve/docs/`, not the web.** Eve ships its full
documentation inside the installed package, 95 files, matching the exact version in
`package.json`. This is the primary source and it is offline. Start with
`concepts/execution-model-and-durability.mdx`, `guides/frontend/nextjs.mdx`,
`guides/deployment/self-hosting.md` and `guides/state.md`.

**`agent-native.md` has drifted and is not the contract.** It describes a custom
`channels/web.ts` with `/message` and `/signal`, four read tools, skills, hooks,
schedules and state slots. None of that exists. What exists is `agent/agent.ts`,
`agent/instructions.md`, the stock `agent/channels/eve.ts`, and one tool,
`agent/tools/apply_action.ts`. Treat the document as a record of intent, correct it as
tickets close, and never cite it as the current shape.

**Standing constraint, the registry stays the only way state changes.** `lib/actions/registry.ts`
holds 26 actions across five groups and is dispatched by both the UI and the Coach. Every
backend concern this map adds, transport, persistence, retry, is written once behind
`dispatch` in `lib/actions/store.tsx`, never 26 times and never in a screen.

**Single tenant, by decision.** There is one demo account. No tenant scoping, no
per-user credentials, no `requireTenantCaller`. Credentials live in environment
variables, never in a tracked file.

**Skills every session should consult**, `codebase-design` for the seam and depth
vocabulary, `grilling` and `domain-modeling` when a shape is genuinely open.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [Serve the agent: Railway behind the Vercel domain](tickets/01-serve-the-agent.md),
  closed as superseded: `withEve()` mounts the agent same-origin, auth is `httpBasic` from
  env failing closed, the model is `nemotron-3-super-120b-a12b` at temperature 0.3
  (measured: 0/6 foreign-script leaks vs 4/6 at the playground default; first completed
  turn 20s), and the thread swapped onto `useEveAgent` with `replies.ts` as the offline
  path. Deployment itself moved to *Ship it*.
- [Close the loop: the Coach reads state, and its edits land](tickets/02-close-the-loop.md),
  state travels on the turn via `prepareSend` (4910 bytes, and server-side read tools
  would read the seed, not the user); Coach edits apply automatically through `dispatch`
  with undo and flash, deduped by `toolCallId`. Verified in the browser: three Vietnamese
  requests each landed as real todos.
- [Ship it: one deploy, keys rotated, verified on the domain](tickets/04-ship-it.md),
  Vercel, because `withEve()` emitted the eve service into Build Output with no
  `vercel.json` and no CORS. The 404 was seven unpushed commits, not configuration.
  Health 200, an authenticated turn in **4.9s** against the 20s local baseline, and a
  session survived a full redeploy still knowing the user's name. Key rotation and the
  Preview env scope remain the owner's.
- [Front door: a sign-in the browser can actually present](tickets/05-front-door.md),
  the app collects the credential because a browser never answers a Basic challenge on
  `fetch`. Access is probed with a session id that cannot exist, so a locked door is known
  before the user types and costs no model call. A failed turn now splits 401 (door) from
  everything else (offline), which it could not do before.
- [State survives a reload: persistence behind dispatch](tickets/03-state-survives.md),
  whole-state last-write-wins in `localStorage` behind `dispatch`, store rebuilt on
  `useSyncExternalStore`. **Per-browser state is a deliberate choice, not debt**: one
  shared demo account with a server store would let visitors see each other's edits.

- [When the turn goes wrong: silence, hangs and failure have to render](tickets/06-when-the-turn-goes-wrong.md),
  a parked question renders instead of vanishing, a hung turn degrades at 60s, an empty
  turn says so. Two bugs found by measuring rather than assuming: the watchdog depended on
  an object rebuilt every render so it reset its own clock, and `checkAccess` had no
  deadline while sitting in the very path that recovers from hangs. The parked-question UI
  is unit-tested but has not been seen on screen; `ask_question` is non-deterministic.

## Not yet specified

- **Everything Eve can do beyond one working turn.** Skills, signals and nudges, hooks,
  schedules, subagents and evals are all real capabilities with real designs behind them,
  best re-derived against production latency rather than implemented from `agent-native.md`
  §6, which predates anything running.
- **Undo once a turn makes several edits.** One level per toast today, and a multi-edit
  turn stacks toasts with undo reaching only the last. Whether that needs a proper history
  depends on how often multi-edit turns happen, measurable only in real use.
- **Whether the Coach reads document contents or only their metadata.** The difference
  between real CV review and generic advice. It needs file storage and a sandbox, and it
  is a much larger question than it looks.
- **Cost and rate limiting under real traffic.** Per-session token caps bound one runaway
  loop but not many sessions. The real ceiling needs a real usage number, which the
  deployed demo will start producing.

## Out of scope

- **Real authentication and multiple users.** Ruled out when the destination was named: one
  shared demo account stands in for this phase. Everything downstream stays single-tenant
  as a result, which is the point.
- **Cross-device sync.** Dropped with *State survives a reload*'s closure, and for a
  reason, not a shortage of time: a server store under one shared account shows every
  visitor everyone else's edits. Redraw as a fresh effort when real accounts exist.
- **The empty-account experience.** Every visitor starts from the seed by design, so no
  screen can be empty this phase. Returns with real accounts, alongside the archived UI/UX
  map's unfinished writing and state passes on Career Map, Coach, Profile and Shell, which
  are quality work, not production blockers.
- **Choosing a better model provider as an architecture question.** It is one line in
  `agent/agent.ts`. A working model is chosen and measured; if its recorded flaws recur,
  *When the turn goes wrong* says the answer is a stronger provider, and that swap needs
  no map.
