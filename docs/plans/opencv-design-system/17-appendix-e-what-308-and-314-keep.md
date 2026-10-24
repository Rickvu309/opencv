## Appendix E. What #308 and #314 keep and what DS-4 replaces

Both PRs are open now (#308 ready, `feat/303-paper-craft-pass`, 44 files; #314 draft, `feat/310-pitch-craft-pass`, 33 files). Their behavior work survives. Only their styling vocabulary changes later.

- #308 keeps, untouched by DS-4a. `paper-dialogs.tsx`, `paper-drive.tsx` behavior, `paper-row-menu.tsx`, `paper-suggestion.ts` and its test, `use-suggestion-marks.ts`, `use-section-focus.ts`, the `paper-data.ts` simplification, the conflict-banner and header copy, `paper.craft.test.tsx`, and the verify-app-ui text-rule changes.
- #308 parts DS-4a replaces. The render of `paper-suggestion-bar.tsx` (becomes the Confirmation `Item`, labels kept), the raw `<table>` (becomes stock `Table`), and `coach-float.tsx` layout only if verify-app-ui 15 fails after #308.
- #314 keeps, untouched by DS-4b. `packages/domain/src/starter.ts` content, `apps/api` codec and starter tests, the eleven story photos, `pitch-moments.tsx` and `pitch-stories.tsx` logic, the split test files, the edit-toolbar labels, the verify-opencv `pitch-publish.md` update.
- #314 parts DS-4b replaces. The tone class map in `pitch-types.ts`, the status pill and banner colors in `pitch-workspace.tsx` (#314 edits that file, so DS-4b re-reads it after merge), and the heatmap.
- Both PRs merge before DS-1 starts, so no owner rebases across the codemod.
