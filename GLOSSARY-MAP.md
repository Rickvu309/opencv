# Glossary Map

## Contexts

- Product: what a person does with OpenCV, in the words Coach, Profile, Paper, Letter, Proof, Job, Apply, Track and Chat. Its present source is the Product section of [AGENTS.md](./AGENTS.md#product).
- [Checking](./scripts/GLOSSARY.md): how a change is judged good enough to reach production: tests, guards, sweeps, probes, CI, the gate, receipts and evidence.

## Relationships

- **Checking → Product**: checks act as a person and as a stranger, and each kind's harness covers a shape of product code. Checking never borrows a product word for its own things.
- **Product words that checking does not use for itself**: Proof (a kind of Paper), Track, a screen, the Paper Loop, an activity receipt, an approval and its policy, a stale edit, a Coach run.
- **Shared**: Person, the someone a product action is for and the account a check acts as.

## Overloaded words

Each word below meant several things across or inside the contexts; use the terms named after it, as the checking glossary defines them.

- check: check, CI job, required check, design check, pre-check.
- policy: policy job, rule. An approval policy is a product word.
- proof: guard proof, flip proof. Proof is a kind of Paper.
- run: CI run, test run, walk. A Coach run is a product word.
- owner: Owner for the human, the row's person, the issue's holder, the check that covers a class.
- screen: recipe. The screen itself is a product word.
- loop: core loop run. The Paper Loop is a product idea.
- formal: formal model, Postgres test.
- harness: harness, test app.
- stale: stale model. A stale edit is a product word.
- pin: guard proof, expected failure.
- receipt: receipt. An activity receipt is a product word.
- baseline, known: ratchet, base comparison.
- risk: risk label, change class.
- review: the gate.
- green: always name the tree.

## Decisions

- System-wide decisions are recorded in [docs/adr](./docs/adr).

## Open items

- The product context needs its own glossary. An earlier product glossary and its decision records were removed on 2026-11-05 and remain in the history.
