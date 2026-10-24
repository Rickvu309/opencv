## Appendix C. Risks

- Visual regressions. DS-1 re-adds 18 kit files and changes the micro tier and heading face on every surface. Mitigation is lane 1 of DS-1 across all surfaces and the operator's review gate.
- Bundle growth. Budgets per PR, all rules not measurements. DS-1 +2 KB entry, DS-2 no net growth, DS-3 +25 KB Apply chunk, DS-4a +4 KB, DS-4b +8 KB per chunk, DS-5 none. Routes are lazy (PR-9), so registry weight lands in route chunks.
- Accessibility. dnd-kit brings keyboard and announcements to the board, a gain over native drag. Trace lines must expose status as text (DS-2 lane 6). The micro tier moving to 12 px helps contrast and legibility.
- Research conflict. The research says Kibo and the showpiece registries "stay unused here unless a later change cannot be composed from `packages/ui`" and that Apply "does not need a new kanban". The operator's ruling today overrides that for Apply. The plan follows the operator for Kibo kanban and follows the research where the operator deferred to it (showpieces).
- Research conflict on the unpublished tint. Research Pitch 7 keeps "the warning tint for unpublished". The shadcn-variables-only rule removes `--warning`, so the banner uses stock `Alert` with words and an icon. Status is still not color-only.
- `asChild` in pasted code. Base UI uses `render`. A missed conversion fails typecheck, which the gates lane runs.
- `cn` import path. Kibo, Cult and Magic items import `@/lib/utils` (A6 to A8). The `utils` alias in `components.json` rewrites it on install, and DS-1's `migrate cn` keeps `utils.ts` as a re-export.
- CLI version mismatch (A2). DS-1's first box records the real version.
