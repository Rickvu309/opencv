# Where the Coach agent runs

## The short answer

The agent runs on **Vercel**, in the same deployment as the Next app. The
Coach Agent blueprint says it runs on **Railway**, proxied same-origin. Those
disagree, and this file explains why.

## What was tried

The agent was deployed to Railway (`openpath-agent` service, project
`openpath`). It builds with `npx eve build` and starts with `npx eve start`,
per `railway.json`. It boots, serves `/eve/v1/*`, and fails closed with 401
when no session cookie is present. That part works.

`EVE_NEXT_PRODUCTION_ORIGIN` was then set on Vercel to point the app at it.
It had no effect, twice: once because Vercel withholds *sensitive* environment
variables from the build, and then, after re-adding it as non-sensitive,
because of this, in `eve/dist/src/public/next/index.js`:

```js
function resolveProductionDestination(e) {
  if (process.env.VERCEL) return { destinationPrefix: e.servicePrefix };
  let t = process.env.EVE_NEXT_PRODUCTION_ORIGIN;
  ...
}
```

When the build runs on Vercel, `withEve` always routes `/eve/*` to its own
co-deployed Vercel service and never reads the variable. The variable exists
for a **self-hosted** Next app pointing at a remote agent, which is not this
deployment.

## What that means

The blueprint's topology is not reachable through `withEve` on Vercel. Getting
it would mean dropping `withEve`'s production rewrite and hand-writing a Next
rewrite from `/eve/:path*` to the Railway origin, while keeping `withEve` for
the dev server. That is a change to the Coach transport, which is the most
fragile path in this repo, and it is a decision rather than a fix.

## The state right now

- **Postgres**: Railway. Correct and unchanged.
- **Next app**: Vercel.
- **Coach agent**: Vercel, serving traffic. Verified with a complete turn.
- **`openpath-agent` on Railway**: deployed, healthy, and receiving no traffic.
  It costs money while it runs. Delete it, or route to it, but do not leave it.

## What is worth keeping either way

`railway.json` and `.railwayignore` are correct and ready if the routing
decision goes to Railway. So is the fact that `agent/skills/` is now empty:
that directory is loaded by eve as the *Coach's* skills, and it used to hold
the software-factory development skill, shell scripts and all. That is what
made eve initialise a bash sandbox on boot. The Coach's only tool validates a
payload and runs no code, so it never needed one.
