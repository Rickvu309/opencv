# ADR 0004: the Coach agent is an in-process module

## Context

The Coach needs streaming turns, tool calls into the domain, and the same types the rest of the app uses. A separate agent service buys isolation at the price of a proxy topology, private networking, duplicated types, and a second deploy — none of which the current scale demands.

## Decision

The Coach agent lives in the web service as an isolated module, `src/features/coach/agent/`: persona instructions, context builder, tool generation from the command registry, and the turn loop over the AI gateway. Turns stream to the browser over SSE from a route in `src/routes/api/`. The module's only doors into the rest of the app are the command bus, feature queries, and the gateway.

## Rejected

- A separate agent service (eve or hand-rolled) on day one: second topology before anything demands it.
- Agent logic spread through the chat UI or API routes: makes the boundary unextractable later.

## Consequences

One deploy, shared types, no proxy. Long turns run inside Nitro request handling, which Railway tolerates (no serverless timeout). If turn load or isolation ever demands it, the module extracts to its own service by swapping the transport behind the same boundary; nothing else moves. Without an AI key the module reports an honest offline state and the rest of the app runs.
