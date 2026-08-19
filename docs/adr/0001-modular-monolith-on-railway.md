# ADR 0001: one codebase, two Railway services, one Postgres

## Context

OpenPath is a small team's product with one web app, an AI coach whose turns can run tens of seconds, and background work (search ingestion, notifications, email). Serverless hosts kill long AI turns; a service-per-concern topology is more operations than the product needs.

## Decision

A modular monolith on Railway. One npm package deploys as two app services from the same repo: `web` (TanStack Start on Nitro, Node 24 — UI, API, Coach streaming) and `worker` (a different entry point that drains a Postgres-backed job queue). Postgres is the only datastore. Two more services, `storybook-production` and `storybook-lab`, build and serve the static galleries; they share the repo, not the app image's start path or secrets. Push to `main` deploys all of them; the web process applies pending migrations before it listens.

## Rejected

- Serverless (Vercel and similar): long streaming Coach turns and a persistent worker do not fit function limits.
- A separate agent service on day one: a second topology (proxying, private networking, split types) before anything demands it. The Coach module boundary keeps extraction possible ([ADR 0004](0004-coach-in-process.md)).
- A second datastore (Redis for queues or cache): the job queue and every cache the product needs fit in Postgres at this scale.

## Consequences

One repo, one image, one deploy pipeline. Background work degrades gracefully: if the worker is down, jobs queue up in Postgres and drain on recovery. Scaling later means extracting the Coach or the worker along boundaries that already exist.
