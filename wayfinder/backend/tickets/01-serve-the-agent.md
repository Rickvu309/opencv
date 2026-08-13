# Serve the agent: Railway behind the Vercel domain

- **Type:** `wayfinder:task`
- **Status:** closed
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** —
- **Map:** [Map, OpenPath backend on Eve](../map.md)

## Question

Nothing serves the agent. `next.config.ts` is four lines with no `withEve()`, so
`/eve/v1/*` is not mounted anywhere, and `components/coach/thread.tsx:129` still calls
`pickReply()`. The agent has only ever run under `eve dev`.

What does it take to get one real Vietnamese answer, streamed, from
`openpath-app.vercel.app`, with the agent running on Railway?

### 1. Mount the routes

`withEve()` from `eve/next` is the supported integration and it removes work rather than
adding it: same-origin routes, no CORS, no public agent URL for the browser to hold, and
`useEveAgent()` finds the routes on its own. For a non-Vercel agent host, the escape hatch
is a build-time variable:

```bash
EVE_NEXT_PRODUCTION_ORIGIN=https://<service>.up.railway.app npm run build
```

Next then proxies the eve routes to that origin. This is the shape to use. Do not
hand-write rewrites in `next.config.ts`.

### 2. Pay Railway's four costs, or reconsider

Railway is a self-host in Eve's terms, and `guides/deployment/self-hosting.md` is explicit
about what that transfers to you. All four are load-bearing:

| Cost | What breaks if it is skipped |
| --- | --- |
| Workflow state storage | The local Workflow world writes durable run state to `.eve/.workflow-data` on disk. A Railway container's filesystem is ephemeral, so every redeploy destroys every in-flight session. Mount a volume there, or install a Workflow world package built against the `5.0.0-beta` line. |
| Proxying `/.well-known/workflow/` as well as `/eve/` | Forward only `/eve/` and a session starts, then stalls forever when its own workflow callback cannot reach it. This failure looks like a hang, not an error. |
| Route auth that is not `vercelOidc()` | It is not a valid production authenticator off Vercel. |
| Schedules | Vercel Cron is gone. `eve build && eve start` starts Nitro's schedule runner instead, which means the process has to stay up rather than sleep. |

On Vercel all four are managed, and `withEve()` deploys the app and the agent as one
project with Workflow, Cron and Sandbox wired for you. **Confirm Railway deliberately,
with those costs stated, before building on it.** If it is chosen for reasons outside this
repo, such as pricing or an existing account, record that in the resolution so the
question is not reopened later.

### 3. Decide the route auth policy

`agent/channels/eve.ts:12` ships `placeholderAuth()`, which the docs describe as fail-closed:
it returns 401 to browser traffic in production. Two honest options.

- `none()` from `eve/channels/auth`, an open agent. Simple, and it makes the endpoint
  public to anyone who finds it, which is a real cost billed in model tokens.
- A custom `AuthFn` checking the demo credential, which is a handful of lines and keeps
  the endpoint closed.

The demo password belongs in an environment variable read at runtime. Never in a tracked
file, never in a client component.

### 4. Pick a model that is actually usable

`agent/agent.ts:29` runs `deepseek-ai/deepseek-v4-pro`, measured at about 150 seconds a
turn. That is not a product. `agent-native.md` §4 records four alternatives on the same
NVIDIA key and every one of them failed on correctness. The NVIDIA key also needs
rotating: it was pasted into a chat transcript.

A string model id routes through the Vercel AI Gateway and needs `AI_GATEWAY_API_KEY` from
a non-Vercel host. A provider package needs that provider's key. Either is one line here.
Pick on measured Vietnamese quality and latency, and write both numbers into the
resolution so the next model change has a baseline to beat.

### 5. Swap the thread onto it

`useCoachThread` in `components/coach/thread.tsx:107` keeps its public shape,
`{ messages, isTyping, accepted, dismissed, send, answer, acceptSuggestion, dismissSuggestion }`,
so `thread.tsx`, `composer.tsx`, `coach-dock.tsx`, `history.tsx` and both `/coach` and the
floating panel need no changes. Only the body changes. `eve/react`'s `useEveAgent()`
returns `data.messages` as AI SDK `UIMessage[]`, which is a different shape from
`ChatMessage[]`, so the adapter between them is the real work here.

Keep `components/coach/replies.ts` as the offline path, as the spec intended. It stops
being dead code and starts being the degradation story.

## Progress, 2026-08-04

Landed in `78a3336`. Sections 1, 3 and 5 are done and verified locally; the ticket stays
**open** because the exit criterion needs a deployment and a model that answers.

- **1, routes mounted.** `withEve()` in `next.config.ts`. `GET /eve/v1/health` returns
  `{"ok":true,"status":"ready"}` through the Next origin at `localhost:3000`, so the proxy
  is real and same-origin. `EVE_NEXT_PRODUCTION_ORIGIN` is documented in the config rather
  than discovered later.
- **3, auth decided.** `placeholderAuth()` out, `httpBasic()` in, credentials from
  `OPENPATH_DEMO_USER` / `OPENPATH_DEMO_PASSWORD`, resolved per request so neither build
  needs the secret. Fails closed when unset. `none()` was rejected: an open agent is billed
  in model tokens by whoever finds it.
- **5, thread swapped.** `useCoachThread` keeps its public shape; only the body changed.
  `replies.ts` is now the offline path.

**Section 4 was blocked, and is now resolved (2026-08-04, later the same day).** The
original finding stands as history: on the first key, seven models measured unusable. A
fresh key and the user's pick, **`nvidia/nemotron-3-super-120b-a12b`**, changed the
answer.

Measured, 6 real coaching prompts per cell against the real system prompt:

| temperature | median | max | foreign-script leaks |
|---|---|---|---|
| 1.0 (playground default) | 7.2s | 22.1s | **4/6** |
| 0.6 | 4.8s | 13.4s | 1/6 |
| **0.3 (chosen)** | 8.4s | 18.0s | **0/6** |

The playground snippet's `temperature: 1` was itself the source of the CJK/Hangul/Cyrillic
leakage, the same failure class that killed `mistral-nemotron`. Thinking mode was measured
and turned off: same correctness, 2-3k characters of reasoning to answer two sentences.

Neither eve nor the AI SDK exposes these knobs (`providerOptions` is a closed schema that
strips unknown keys), so both are pinned in `transformRequestBody` on the provider in
`agent/agent.ts`, the documented escape hatch.

**End-to-end baseline through eve, local:** first full turn completed in **20s**
(`turn.started → step.completed → turn.completed → session.waiting`). Known flaws, recorded
rather than hidden: a rare English token mid-sentence ("cóSomething") in one reply, and one
reply drifting from "mình" to "tôi". Both are model quality, watched for, with the fix
being a stronger provider, not more prompt.

Also observed working: with no client context, the agent used eve's `ask_question` HITL
tool to ask which career stage the user is at, in correct Vietnamese, which is
`instructions.md` rule 1 behaving. The UI's `flatten()` drops non-text parts, so a parked
HITL question would render as silence in the thread; noted for *Close the loop*'s next
pass.

**Section 2 is untouched.** No Railway service exists yet, so none of its four costs have
been paid or confirmed.

Two things the swap surfaced that are not this ticket's to fix:

- **A hung turn has no timeout.** Because the model stalls instead of failing, `onError`
  never fires and the user watches the typing indicator forever. The offline fallback only
  catches failures, not silence.
- **How the browser presents the Basic credential is unresolved.** `localDev()` covers
  local work, but a deployed browser gets a 401 with nothing to answer it. That belongs
  with the demo login in *State survives a reload*.

## Exit criterion

A question typed into `/coach` on the deployed domain returns a streamed Vietnamese answer
from the deployed agent, and `curl https://<agent-host>/eve/v1/health` is green. Turn
latency is recorded. Killing and redeploying the agent mid-session does not lose the
session.

## Closed, 2026-08-04

Superseded, not completed. Routes, auth policy, model and the thread swap are done and
verified locally; the exit criterion (a streamed answer on the deployed domain) never ran
because no deployment exists. That remaining scope, host decision, provisioning, env,
deployed verification, moved to [Ship it: one deploy, keys rotated, verified on the
domain](04-ship-it.md). The 401-with-nothing-to-answer problem moved to [Front door: a
sign-in the browser can actually present](05-front-door.md).
