# Release one is the first-release design

**Status.** Accepted 2026-10-26.

**Context.** The product was rebuilt piecemeal from prototypes and specs. On 2026-10-26 the operator finished a full design of the first release on pen.dev (`design/opencv.pen` on branch `chore/350-design-kit-cli-skills`), 12 flows and 65 screens in a zone named "2.1 Workflows", plus a "3.1 Later" zone holding the Proof flow. The operator asked for the product to be rebuilt to it, backend included, not reskinned.

**Decision.** The design file is the product spec for release one. Every screen in the first-release zone is built, with the data and server behavior it implies. The Later zone is out. Where the design draws a placeholder (Jobs, Proof, Pitch "coming soon", Upgrade to Pro), the product ships the placeholder, and code for the retired version is removed rather than hidden. The earlier Pitch page is retired.

**Consequences.** Scope questions are answered by reading the canvas, not by negotiation. `docs/plans/opencv-release-design-study.md` is the written reading of it. Anything dropped from the zone needs its own ADR. The opencv-kit CLI on the design branch is a generator and reference for this repo, never a second component library (see 0006).
