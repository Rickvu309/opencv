# ADR 0003: relational schema, JSONB only for document bodies

## Context

The product's entities (profiles, papers, proofs, openings, applications, conversations) have real relationships and lifecycles, and both humans and AI agents need to discover the data model by reading it. A single JSON blob per account is simple to start and expensive forever after: unqueryable, migration-hostile, and prone to lost updates under concurrent writers (a user and the Coach).

## Decision

Typed Postgres tables per domain, one `openpath` schema, numbered up/down SQL migrations with checksums, applied before the web process listens. JSONB is used only where the content is genuinely a document body (a CV's block structure, a letter's paragraphs, a published Proof page snapshot) — never as a place to hide relations or state.

## Rejected

- One `app_state` JSONB row per account: see context.
- An ORM or query builder (Drizzle, Prisma): `pg` with SQL keeps the schema visible in one place and removes a codegen layer; Zod at the query edge covers type safety where it matters.

## Consequences

The schema documents the product. Queries, indexes, and per-row updates are normal SQL. Concurrent writes touch rows, not a blob. Migrations are reviewable diffs. The cost: adding a field is a migration, not a silent JSON key — which is the point.
