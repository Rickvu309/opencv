# ADR 0002: every write is a named command on a server-side bus

## Context

OpenPath's differentiator is that the Coach operates the product: a change it makes must be indistinguishable from one the user makes by hand, reversible, and honest. That requires exactly one write path that humans, the agent, and background jobs all share — and it must work across tabs and devices.

## Decision

Every state change is a named command (`paper.create`, `proof.log`, `application.setStatus`) executed on the server through one bus: authorize (actor and ownership), validate (Zod input), run the handler in one transaction, append to `command_log` with the actor and an inverse invocation. Commands are defined once with `defineCommand` next to their feature; the registry spreads them. The UI calls them through server functions; the Coach's tools are generated from the same registry (name, description, schema become the tool definition); jobs call the bus with actor `system`. Undo executes the logged inverse through the same bus.

Reads are separate: plain per-feature server queries fetched with TanStack Query and invalidated on command completion.

## Rejected

- Ad-hoc mutations (each endpoint writes what it likes): human and agent capability drift apart, undo and audit become per-feature afterthoughts.
- A client-held state store where the agent returns an envelope the browser applies: breaks on multiple tabs and devices, trusts the client, and couples the agent to a live browser session.
- Full event sourcing: more machinery than the product needs; the command log gives audit and undo without rebuild-from-events complexity.

## Consequences

Human and agent capability cannot drift. Undo, audit trail, and Coach operability are properties of the bus, so every future mechanism (vouches, invitations, social actions) inherits them by being a command. The command log doubles as a trust surface ("the Coach did X at Y") and a debugging record agents can read. The cost: writes have one required shape, and contributors must resist adding side-door mutations.
