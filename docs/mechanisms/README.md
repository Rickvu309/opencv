# Mechanisms

The deep design docs for OpenPath's signature mechanisms — the parts of the product that exist nowhere else. Commodity features clone their reference apps and are fully described by their [feature specs](../features/). Mechanisms are different: they are invented here, they will be iterated and grown for years, and the thinking behind them must survive every redesign. That thinking lives in this folder.

## The two kinds of docs

- A **feature spec** (`docs/features/`) is operational: screens, data, commands, empty states. It says what to build.
- A **mechanism doc** (this folder) is the design itself: why the mechanism exists, how it works beat by beat, what the AI does inside it, where it is allowed to grow, and what would kill it. It says why the build is shaped this way.

A mechanism doc outranks its feature specs on intent. When a spec and a mechanism doc disagree, fix the spec.

## What earns a mechanism doc

Something is a mechanism, not a feature, when all of these hold:

1. It is a differentiator — no reference app to clone, because nobody has built it.
2. It is an interaction model, not a screen — it spans surfaces and shows up in the Coach, the schema, and the flows.
3. It is expected to grow — the v1 is the seed of a bigger system, and the extension points matter as much as the shipped part.

When a new mechanism is invented, it starts as a new doc here, written before the code, following the template below.

## Current mechanisms

| Doc | Mechanism | One line |
|---|---|---|
| [coach-hands.md](coach-hands.md) | The Coach's hands | The agent operates the product through the same commands as the user, with undo and an audit trail — trust made structural |
| [proof.md](proof.md) | Proof, the evidence engine | Turn ordinary work into legible, defensible evidence of skill, built up over time with AI support |
| [share.md](share.md) | Public identity and sharing | User-owned audiences for real work: pages, a span record, and a capability model that future social mechanics grow on |

## Template for a new mechanism doc

```
# <Name>

One paragraph: what it is and the bet behind it.

## Why this exists          — the user problem and why no clone solves it
## Principles               — the rules that hold under pressure
## The mechanic             — objects, beats, and states, in detail
## The AI inside it         — exactly what the model does and must never do
## Connection points        — how it touches other features and the bus
## Growth roadmap           — what v-next and v-later look like, in order
## What would kill it       — failure modes that break the mechanism's promise
## Success signals          — how we will know it is working
```
