# Ship it: one deploy, keys rotated, verified on the domain

- **Type:** `wayfinder:task`
- **Status:** open
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** —
- **Map:** [Map, OpenPath backend on Eve](../map.md)

## Question

Everything runs locally and nothing runs anywhere else. What stands between this commit
and `openpath-app.vercel.app` answering a real question?

### 1. The host decision, put honestly

The map says Railway. The evidence collected since says Vercel, and this ticket exists to
make that call deliberately rather than by default:

- **Vercel:** `withEve()` already emits Build Output service routes, so app and agent
  deploy as one project. Workflow storage, the `/.well-known/workflow/` callback path,
  Cron and Sandbox are managed. Marginal work: set env vars, push.
- **Railway:** all four self-host costs from the closed *Serve the agent* ticket, and its
  one concrete benefit, a Postgres both sides could share, was made unnecessary when
  per-browser state became a deliberate choice (see *State survives a reload*'s closure).

**Recommendation: Vercel, and record Railway as redrawable if pricing or a GPU need
appears.** If Railway is still the call, its checklist lives in the closed ticket, section
2, and this ticket's verification applies unchanged.

### 2. Secrets, all of which are currently burned

Every credential this app has touched has been pasted into a chat transcript:

| Secret | State | Action |
| --- | --- | --- |
| NVIDIA key #1 | in a transcript, and superseded | revoke at build.nvidia.com |
| NVIDIA key #2 (active) | in a transcript | rotate, then set only where the agent runs |
| `Demo12345` | in a transcript | decide: acceptable for a demo gate, or pick a fresh one at deploy time; either way it lives only in env |

Env checklist for the chosen host: `NVIDIA_API_KEY` (rotated), `OPENPATH_DEMO_USER`,
`OPENPATH_DEMO_PASSWORD`, set in Production **and Preview**, since the old key was
Production+Development only and preview deploys ran keyless. Nothing else: the browser
needs no env var by design.

### 3. Two decisions that ride along

- **Vercel Deployment Protection** intercepts requests before eve's own auth walk. Either
  it is off for this project, or `VERCEL_AUTOMATION_BYPASS_SECRET` becomes part of every
  client, which is the wrong shape for a public demo. Check the project setting; decide.
- **The privacy sign-off, explicitly the user's.** Every turn sends the whole profile,
  including CV and document metadata, to the model provider. Inherent to the design, but
  it must be a decision made, not discovered. One sentence in the resolution: accepted, or
  changed.

## Resolution, 2026-08-04

**It is deployed and the agent answers on the domain.** The ticket stays **open** on one
criterion only: both old NVIDIA keys are still alive, and only the account owner can kill
them.

### 1, resolved: Vercel

Chosen, and the deciding evidence was not the comparison in this ticket but the deploy
itself: `withEve()` emitted the eve service into Build Output and Vercel served it with no
`vercel.json`, no CORS, no `EVE_NEXT_PRODUCTION_ORIGIN`. Railway is redrawable if pricing
or a GPU need appears; its checklist survives in the closed *Serve the agent*.

Worth recording because it cost time: **`vercel build` locally does not reproduce this.**
`withEve` writes `services` into `.vercel/output/config.json` during `next build`, and the
local Vercel builder then overwrites that file. On the real platform the ordering works.
So the local build is not a valid preflight for the eve service; only a deployment is.

### The actual cause of the 404, and it was embarrassing

Before any of the above: **the eve work had never been pushed.** Seven commits sat local
while every production deployment ran code from before `withEve()` existed. The 404 was
not configuration.

### 2, secrets, partly done

`NVIDIA_API_KEY`, `OPENPATH_DEMO_USER` and `OPENPATH_DEMO_PASSWORD` are set in
**Production** and **Development**.

**Preview could not be set from the CLI.** Vercel CLI 50.28.0 rejects both of its own
suggested non-interactive forms: the all-branches form loops back to asking for a branch,
and the branch form correctly refuses `main` because that is the production branch. This
needs one pass in the dashboard (Settings → Environment Variables → tick Preview on all
three). Until then preview deploys still run keyless, exactly as before.

**Key rotation is outstanding and is the user's to do.** Both NVIDIA keys have been in
chat transcripts. The active one is deployed because it works; it should be rotated and
the old one revoked at build.nvidia.com, then updated here.

### 3, both ride-along decisions

**Deployment Protection is on for deployment URLs and off for the alias.** A direct
`*-rickvudev.vercel.app` URL returns 302 to a login; `openpath-app.vercel.app` returns
200. That is the right shape: the public demo runs on the alias and needs no bypass
secret, while raw deployment URLs stay private. No change made.

**The privacy sign-off is still the user's.** Every turn sends the whole profile,
including CV and document metadata, to NVIDIA. Stated, not yet accepted.

### Measured on the deployed domain

| Check | Result |
| --- | --- |
| `GET /eve/v1/health` | `200 {"ok":true,"status":"ready"}` |
| Unauthenticated `POST /eve/v1/session` | `401`, auth walk is live |
| Authenticated turn, with client context | **4.9s**, against the 20s local baseline |
| Reply quality | Streamed Vietnamese, "mình/bạn", grounded in the context sent |
| Session across a full redeploy | **Survived.** A session opened on one deployment, redeployed mid-conversation, then asked "do you remember my name" on the new one: *"Tên bạn là Minh Anh."* |

One client-side lesson: follow-ups to an existing session **require `continuationToken`**
in the body, or the route returns `400 Missing or empty 'continuationToken' field`. The
first attempt failed on this, and it was my error, not the platform's.

### Confirmed blocked, as charted

A real browser on `/coach` loads fine and gets **401** from `/eve/v1/session`, so the app
silently runs on canned replies while looking deployed. That is precisely
[Front door: a sign-in the browser can actually present](05-front-door.md), now confirmed
against production rather than predicted.

## Exit criterion

`curl https://openpath-app.vercel.app/eve/v1/health` is green. A question typed into
`/coach` on the deployed domain returns a streamed Vietnamese answer; turn latency on the
deployed path is recorded next to the local 20s baseline. A redeploy while a session is
open does not lose that session. Both old NVIDIA keys are dead.
