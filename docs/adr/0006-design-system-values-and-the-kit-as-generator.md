# Stock shadcn variables carry the opencv values, the kit is a generator

**Status.** Accepted 2026-10-26. Supersedes archived ADR-0014's value table and keeps its rule.

**Context.** Archived ADR-0014 pinned the app to stock shadcn variable names with the `neutral` values, Geist, and tests that forbid new tokens, hex and raw controls. The design kit ships its own theme (about 40 hex tokens, Inter, a glow mesh for the primary button) and hand-rolled components with raw controls. A prototype on 2026-10-26 (`proto/kit-shadcn-map`) showed a class-name codemod clears about 93 percent of the kit's violations and the rest sits in 14 component files.

**Decision.** The stock variable names stay. Their values become the design's: the gray scale, Inter as `--font-sans`, the focus indigo as `--ring`, the status and stage hues on `--chart-1` to `--chart-5`, and one `glow` utility built from stock variables for the single primary per view. The kit's components are rebuilt on `packages/ui` primitives with `data-slot`. The opencv-kit CLI gains a `--target shadcn` that applies the codemod and points imports at `@workspace/ui`, so generated screens start compliant. No new token is added.

**Consequences.** The guard tests stay. `verify-app-ui` gains the design's text rules (brand spelling, one glow per view, no dashes, Enabled and Disabled, title before company). The glow is judged by eye against the design's exported landing button.
