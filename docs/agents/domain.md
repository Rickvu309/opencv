# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`docs/adr/`**. Read the ADRs that touch the area you are about to work in.

If one of these files is missing, proceed silently. Do not flag the absence. Do not suggest creating it upfront.

## File structure

This repo is single-context.

```
/
├── CONTEXT.md
├── PRODUCT.md
└── docs/adr/
    ├── 0001-release-one-is-the-design.md
    └── 0002-vocabulary-job-chat-stages.md
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.

> Contradicts `docs/adr/0001-release-one-is-the-design.md`, but worth reopening because…
