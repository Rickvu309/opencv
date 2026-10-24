## Remove Storybook (PR-18)

**Depends on.** PR-1.

**Files.**

- [ ] Delete `packages/ui/.storybook/main.ts` and `packages/ui/.storybook/preview.ts`.
- [ ] Delete the 19 `*.stories.tsx` files under `packages/ui/src/components/` and the whole `packages/ui/src/foundations/` directory (its five files are all stories).
- [ ] Delete `packages/ui/vercel.json`.
- [ ] Delete `apps/web/src/test/storybook-catalog.test.ts`.
- [ ] Edit `packages/ui/package.json` (scripts at lines 10 and 11, dependencies at lines 27, 28, 29 and 38).
- [ ] Edit `package.json` (scripts at lines 12 and 13).
- [ ] Edit `turbo.json` (the `build-storybook` task at lines 27 to 29).
- [ ] Edit `packages/ui/eslint.config.js` (lines 9 and 26).
- [ ] Edit `.gitignore` (line 42).
- [ ] Edit `apps/api/src/coach/eval/exclusion.test.ts` (line 22).
- [ ] Edit `README.md` (lines 14, 42 and 43 and the Storybook paragraph under Deployment).
- [ ] Edit `AGENTS.md` (the Design system section at line 27).
- [ ] Edit `docs/deploy.md` (delete the section from "Deploying Storybook to Vercel" to the end).
- [ ] Edit `pnpm-lock.yaml` by running `pnpm install`.
- [ ] Create `docs/adr/0013-remove-storybook.md`.

**Build.**

- [ ] Remove the `storybook` and `build-storybook` scripts and the four Storybook dev dependencies (`@storybook/addon-a11y`, `@storybook/addon-docs`, `@storybook/react-vite`, `storybook`) from `packages/ui/package.json`, then run `pnpm install` so the lockfile drops them.
- [ ] Remove the root `storybook` and `build-storybook` scripts from `package.json` and the `build-storybook` task from `turbo.json`.
- [ ] Remove `storybook-static` from `globalIgnores` and the `**/*.stories.tsx` glob from the files list in `packages/ui/src/eslint.config.js`, and remove `storybook-static` from `.gitignore`.
- [ ] Drop the `build-storybook` expectation at `apps/api/src/coach/eval/exclusion.test.ts` line 22 and keep the rest of that test.
- [ ] Keep the ADR-0010 governance. The vocabulary test that forbids raw hex and palette classes stays. If the built-CSS assertion lived only in the Storybook build, move it to a vitest in `packages/ui` that compiles `packages/ui/src/styles/globals.css` with the Tailwind Vite plugin and asserts the token names; the owner greps `packages/ui` and `apps/web/src/test` for the assertion first and records what it found in the PR body.
- [ ] Rewrite the Design system section of `AGENTS.md` so it no longer asks for colocated `*.stories.tsx` files or names a local catalog, and points at the vocabulary test as the governance.
- [ ] Shorten `README.md` to the two surfaces (web and api) and delete the Storybook deploy section from `docs/deploy.md`.
- [ ] Write `docs/adr/0013-remove-storybook.md` with status, context, decision and consequences. It supersedes the catalog part of ADR-0002 and the "Storybook's build joins CI" line of ADR-0010, and records that the kit stays as source in `packages/ui`.

**You see.**

- [ ] `git ls-files | grep -E "\.stories\.tsx$|^packages/ui/\.storybook/|^packages/ui/vercel\.json$"` prints nothing at the head.
- [ ] `pnpm ls -r --depth 0 2>/dev/null | grep -i storybook` prints nothing after `pnpm install --frozen-lockfile`.
- [ ] `pnpm turbo run lint typecheck build test` is green at the head, and the turbo task list names no Storybook task.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api/src/coach/eval/exclusion.test.ts` keeps its eval-exclusion cases and loses the `build-storybook` match. Run `pnpm --filter api test src/coach/eval/exclusion.test.ts`.
- [ ] The ADR-0010 vocabulary test still runs and still fails on a scratch `bg-red-500` added to `apps/web/src/routes/home.tsx` (red), then passes once the scratch line is removed (green). Run `pnpm --filter web test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `pnpm turbo run lint typecheck build test` at trunk and at head in two worktrees. Save `pr18-gates-trunk-head.png`. Pass when both runs exit 0 and the head run lists no `build-storybook` task.
- [ ] Lane 2. Clean install. In a fresh worktree at head run `pnpm install --frozen-lockfile` then `pnpm ls -r --depth 0 | grep -i storybook`. Save `pr18-install-clean.png`. Pass when the install exits 0 and the grep prints nothing.
- [ ] Lane 3. Tracked files. Run `git ls-files | grep -E "stories\.tsx|\.storybook|storybook-static|packages/ui/vercel\.json"` at head. Save `pr18-ls-files.png`. Pass when it prints nothing.
- [ ] Lane 4. Operational references. Run `grep -rn -i storybook package.json turbo.json .github README.md AGENTS.md docs/deploy.md packages/ui apps/web/src apps/api/src --exclude-dir=node_modules --exclude-dir=dist`. Save `pr18-grep-refs.png`. Pass when the only hits are inside `docs/adr/`.
- [ ] Lane 5. App surfaces still render. Sign up, then open `/app`, `/app/paper`, `/app/apply` and `/app/pitch` at head with the browser console open. Save `pr18-surfaces.png`. Pass when all four pages render their kit components with zero console errors.
- [ ] Lane 6. Gates shape. Run `pnpm turbo run lint typecheck build test --dry=json` at head and list the task names. Save `pr18-ci-steps.png`. Pass when the tasks are `lint`, `typecheck`, `build` and `test` for the workspace packages and nothing names Storybook.
- [ ] Lane 7. Kit lint. Run `pnpm --filter @workspace/ui lint` and `pnpm --filter @workspace/ui typecheck` at head. Save `pr18-ui-lint.png`. Pass when both exit 0 with no unused-config warnings.
- [ ] Lane 8. Visual parity. Screenshot `/sign-in` and the Paper CV editor on the sample CV at trunk and at head at 1280 px and compare with a pixel diff. Save `pr18-parity.png`. Pass when the diff is zero pixels.
- [ ] Lane 9. Audit lane. Read the diff and list every deleted path. Save `pr18-audit-deletions.png`. Pass when every deleted file is a `*.stories.tsx`, a `.storybook` config, `packages/ui/vercel.json`, the catalog test, or Storybook-only doc text, and no file under `packages/ui/src/components` other than stories changed.
- [ ] Lane 10. Governance kept. Add a scratch `bg-red-500` class to `apps/web/src/routes/home.tsx` at head, run `pnpm --filter web test`, then revert. Save `pr18-governance-red.png`. Pass when the vocabulary test fails with the scratch line and passes after the revert.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of `pnpm install --frozen-lockfile` from an empty store and the size of `node_modules` (`du -sh node_modules`) at trunk and head.
- [ ] Probe. In two fresh worktrees run `pnpm store prune && time pnpm install --frozen-lockfile && du -sh node_modules`, trunk then head, then trunk then head again, and take the median of each.
- [ ] Baseline. Record the trunk install time and `node_modules` size first.
- [ ] Rule. Head `node_modules` is smaller than trunk and head install time is not more than trunk. A head that is larger or slower fails.

**Review gate.** None. PR-18 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
