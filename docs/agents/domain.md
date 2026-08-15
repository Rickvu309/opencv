# Domain docs

How a coding agent should read this repo before changing it.

## Before exploring, read these

- [`CONTEXT.md`](../../CONTEXT.md) — product language. Use those nouns. Do not invent synonyms the glossary avoids.
- [`docs/map.md`](../map.md) — where a file goes, and how a write travels.
- [`docs/adr/`](../adr/) — locked decisions. If your change contradicts one, say so; do not silently override.

This is a single-context repo. There is no `CONTEXT-MAP.md` and no `src/` tree. Do not create either.

If a term you need is missing from `CONTEXT.md`, that is a signal: you are inventing language, or there is a real gap. Do not add a glossary entry unless the work is domain-modeling.

## Hierarchy (this repo, not a template)

```
app/(app)/<route>/     thin adapters: page, route-local chrome
components/<name>/     only when two routes share UI
components/ui/         primitives, no product nouns
lib/actions/           the write module: AppState, applyAction, store, persistence
lib/<noun>/            shared domain when two callers exist
lib/<support>/         auth, db, billing, i18n, catalogue, coach, guardrails, onboarding
docs/map.md            the map
docs/adr/              locked decisions
CONTEXT.md             product language
```

There is no `src/`, no `features/`, no `artefacts/` colocation. Do not add empty `components/pitch` or `components/search`.

Callers and tests use `applyAction`. They do not import artefact action tables. See [ADR 0001](../adr/0001-coach-validates-browser-applies.md).

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a refactor, a test name), use the term as defined in `CONTEXT.md`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it:

> _Contradicts ADR 0001 (Coach validates, browser applies) — but worth reopening because…_
