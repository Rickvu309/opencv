---
status: accepted
---

# Recurring code shapes become kinds, and each kind's harness owns its defect class

Instead of adding a test after each defect, recurring shapes of product code (limits, views, the writing page's document session, surfaces, readers, owned rows) become kinds, each with one interface and one harness that every instance joins by construction. A text guard is matched by a copy that looks slightly different, and a builder adding an instance takes the shortest path that compiles; a kind makes that shortest path the covered one. Generic sweeps cover only the classes no kind owns yet.

## Considered options

- Checks first, product code unchanged: fastest to start, but every new instance is covered only if a scan pattern happens to match it, and the writing page's save decisions stay reachable only through a copy of the component's effects.
- Structure first with a minimal pipeline: deep kinds, but many reshaping pull requests before the outage class runs in CI.
- Both, with the pipeline first and the kinds as the lasting layer (chosen).

## Consequences

- One way per job: when a kind lands, its harness replaces the sweep or guard that covered its class, and a ratchet fences the old shape until every site has moved.
- The writing page's save path moves last and in small behaviour-preserving steps, because it holds people's words and its in-flight rework had to land first.
- As of 2026-11-27 only limits and owned rows are kinds with harnesses. Views, the document session, surfaces and readers did not become kinds: the one rich Paper replaced the writing page (ADR 0008), and scenarios state what each context must do (ADR 0005).
