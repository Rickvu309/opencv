# Stock shadcn variables carry the opencv values, the kit is a generator

**Status.** Accepted 2026-10-26.

**Context.** The app uses stock shadcn variable names, and tests forbid new tokens, hex and raw controls. The design kit ships its own theme, about 40 hex values, Inter, a glow on the primary button, and hand-rolled components. A class-name codemod on the kit map cleared most of those violations.

**Decision.** The stock variable names stay. Their values become the design's. The gray scale, Inter as `--font-sans`, the focus indigo as `--ring`, and the status and stage hues on `--chart-1` to `--chart-5` are the values. One `glow` utility is built from stock variables for the single primary per view. The kit's components are rebuilt on `packages/ui` primitives with `data-slot`. The opencv-kit CLI gains a `--target shadcn` that applies the codemod and points imports at `@workspace/ui`. No new token is added.

**Consequences.** The guard tests stay. `verify-app-ui` gains the design's text rules. The glow is judged by eye against the design's exported landing button.
