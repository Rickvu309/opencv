# ADR 0006: port Onyx Opal, do not install it

## Context

OpenPath clones commodity chat chrome and is missing the primitive layer a mature AI app already has: tool cards, approval cards, thinking states, chips, tooltips, collapsibles, tables. Onyx's Opal library (`web/lib/opal`, MIT) plus its `craft` chat surfaces are the closest match. Installing `@onyx-ai/opal` looks cheaper than porting.

## Decision

Port Opal anatomy and behaviour into `src/ui/` and Coach components. Restyle to OpenPath tokens. Attribute in `NOTICE.md`. Do not add `@onyx-ai/opal` as a dependency.

The gallery that makes the ported layer reviewable is our own Storybook, hosted on Railway as `opath-production` (https://opath-production.up.railway.app) and `opath-lab` (https://opath-lab.up.railway.app) from the same git repo. Those services never receive the database, session secret, or AI key.

## Rejected

- Installing `@onyx-ai/opal`. It ships a Tailwind v3 preset whose colour variables the consumer must define, and it lists `next` as a peer with components importing `next/link` / `next/navigation`. We are Tailwind v4 (`@theme`) and TanStack Router.
- Installing `@assistant-ui/react`. Our stream, `conversation.*` commands, and dock stay ours; we copy UX only.
- Copying Open WebUI source. It is Svelte, and its licence forbids removing "Open WebUI" branding.

## Consequences

New primitives live in `packages/opath-ui` with co-located stories ([ADR 0007](0007-opath-ui-in-repo.md)). Coach chrome ports approval and composer interrupt/queue; reasoning panel and tool call are assistant-ui ports in the Coach feature. Destructive `agent: true` commands return a proposal instead of executing; the decision runs through the existing command bus so undo still works. A failed Storybook build cannot affect an app deploy.
