# Release one is the first-release design

**Status.** Accepted 2026-10-26.

**Context.** The operator finished a full design of the first release in `design/opencv.pen` on branch `chore/350-design-kit-cli-skills`. The first-release zone is "2.1 Workflows", with 12 flows and 65 screens. A "3.1 Later" zone holds the Proof flow.

**Decision.** The design file is the product spec for release one. Every screen in the first-release zone is built, with the data and server behavior it implies. The Later zone is out. Where the design draws a placeholder, the product ships the placeholder. Jobs, Proof, and Upgrade to Pro ship as placeholders. Pitch is a coming-soon page. The old Pitch code is removed. It is not hidden behind a flag.

**Consequences.** Scope questions are answered by reading the canvas. Anything dropped from the first-release zone needs its own ADR. The opencv-kit CLI on the design branch generates screens for this repo. It is not a second component library. See `docs/adr/0006-design-system-values-and-the-kit-as-generator.md`.
