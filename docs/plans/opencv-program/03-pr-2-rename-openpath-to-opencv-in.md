## Rename OpenPath to OpenCV in code and docs (PR-2)

**Depends on.** None.

**Files.**

- [ ] Create `scripts/rename-opencv.mjs`, committed first and deleted in the last commit of the same PR.
- [ ] Create `docs/adr/0011-rename-to-opencv.md`.
- [ ] Edit `package.json`.
- [ ] Edit `packages/ui/src/lib/brand.ts`.
- [ ] Edit `packages/ui/src/foundations/type.stories.tsx`.
- [ ] Edit `apps/web/index.html`.
- [ ] Edit `apps/web/src/features/app-shell/app-logo.tsx`.
- [ ] Edit `apps/web/src/features/app-shell/app-sidebar.tsx`.
- [ ] Edit `apps/web/src/features/app-shell/search-modal.tsx`.
- [ ] Edit `apps/web/src/features/auth/auth-screen.tsx`.
- [ ] Edit `apps/web/src/features/pitch/pitch-types.ts`.
- [ ] Edit `apps/web/src/features/seed/sample-author.ts`.
- [ ] Edit `apps/web/src/features/paper/paper-cv-types.ts`.
- [ ] Edit `apps/web/src/features/paper/coach-float.tsx`.
- [ ] Edit `apps/web/src/features/paper/paper-editor.tsx`.
- [ ] Edit `apps/web/src/features/home/first-cafe-checklist.ts`.
- [ ] Edit `apps/web/src/features/home/aim-prompt.ts`.
- [ ] Edit `apps/web/src/features/apply/apply-types.ts`.
- [ ] Edit `packages/domain/src/starter.ts`.
- [ ] Edit `packages/domain/src/apply.ts`.
- [ ] Edit `apps/api/src/auth.ts`.
- [ ] Edit `apps/api/src/coach/prompt.ts`.
- [ ] Edit `apps/api/src/coach/title.ts`.
- [ ] Edit `apps/api/src/coach/runtime.ts`.
- [ ] Edit `apps/api/src/coach/smoke.ts`.
- [ ] Edit `apps/api/src/coach/eval/judge.ts`.
- [ ] Edit `apps/api/src/coach/eval/seed.ts`.
- [ ] Edit `apps/api/src/apply/fetch-posting.ts`.
- [ ] Edit `apps/api/src/origin.ts`.
- [ ] Edit `apps/api/src/db/schema.ts`.
- [ ] Edit the tests that assert these strings, `apps/web/src/routes/paper.test.tsx`, `apps/web/src/routes/app-shell.test.tsx`, `apps/web/src/test/paper-seam.test.ts`, `apps/web/src/test/thread-fixtures.ts`, `apps/web/src/features/paper/paper-data.test.ts`, `apps/web/src/features/pitch/pitch-api.test.ts`, `apps/web/src/features/pitch/pitch-types.test.ts`, `apps/web/src/features/pitch/pitch-workspace.test.tsx`, `apps/api/src/app.test.ts`, `apps/api/src/auth.test.ts`, `apps/api/src/config.test.ts`, `apps/api/src/coach/bind.test.ts`, `apps/api/src/coach/title.test.ts`, `apps/api/src/coach/tools.test.ts`, `apps/api/src/starter/content.test.ts`, `apps/api/src/test/harness.ts`.
- [ ] Edit `README.md`, `AGENTS.md`, `CONTEXT.md`, `PRODUCT.md`, `docs/agents/issue-tracker.md`, `.env.example`.

**Build.**

- [ ] Write `scripts/rename-opencv.mjs` as a codemod with an explicit replacement table and an explicit file allowlist, so a reviewer reruns it with `node scripts/rename-opencv.mjs` and gets an empty `git diff` the second time. The table maps `OpenPathLogo` to `OpenCvLogo`, `OpenPathMark` to `OpenCvMark`, `OpenPath` to `OpenCV`, `openpath:` to `opencv:`, `x-openpath-apply-card` to `x-opencv-apply-card`, `openpath.app` to `opencv.me`, `openpath-app.vercel.app` to `opencv.me`, and `openpath-dev` to `opencv-dev`. The script never touches `docs/specs`, `docs/research`, `docs/adr`, `apps/api/drizzle`, `pnpm-lock.yaml` or `node_modules`.
- [ ] Put the replacement table and the rerun command in the PR body. Delete `scripts/rename-opencv.mjs` in the final commit because it has no future use.
- [ ] Set `"name": "opencv"` in `package.json` line 2. No workspace package name changes.
- [ ] Set `brandName = "OpenCV"` in `packages/ui/src/lib/brand.ts` line 2 and the wordmark text in `packages/ui/src/foundations/type.stories.tsx` line 95.
- [ ] Rename `OpenPathMark` and `OpenPathLogo` in `apps/web/src/features/app-shell/app-logo.tsx` (lines 9 and 43) to `OpenCvMark` and `OpenCvLogo`, and update the three call sites at `auth-screen.tsx` lines 3 and 15, `app-sidebar.tsx` line 22, and `search-modal.tsx` lines 12 and 298.
- [ ] Set `<title>OpenCV</title>` in `apps/web/index.html` line 6.
- [ ] Set `STARTER_THREAD_TITLE = "Welcome to OpenCV"` in `packages/domain/src/starter.ts` line 25. Existing threads keep their stored title.
- [ ] Replace the product name in the prompt strings at `apps/api/src/coach/prompt.ts` line 79, `packages/domain/src/apply.ts` line 69, `apps/api/src/coach/title.ts` line 15 and `apps/api/src/coach/eval/judge.ts` line 24.
- [ ] Set `appName: "OpenCV"` in `apps/api/src/auth.ts` line 42. Set no `cookiePrefix`, so sessions survive.
- [ ] Set the OpenRouter `appName` to `"OpenCV"` and `appUrl` to `https://opencv.me` in `apps/api/src/coach/runtime.ts` lines 87 and 88, and the User-Agent to `OpenCV/1.0` in `apps/api/src/apply/fetch-posting.ts` line 124.
- [ ] Change the placeholder domain to `opencv.me/u/${slug}` in `apps/web/src/features/pitch/pitch-types.ts` line 83, and the sample email to `you@opencv.me` in `apps/web/src/features/seed/sample-author.ts` line 15. Change `linkedin.com/in/openpath-dev` to `linkedin.com/in/opencv-dev` in `paper-cv-types.ts` line 82.
- [ ] Rename the four localStorage prefixes to `opencv:paper:coach-float` (`coach-float.tsx` line 51), `opencv:paper:docs-panel` (`paper-editor.tsx` line 90), `opencv:home:first-cafe-checklist` (`first-cafe-checklist.ts` line 48) and `opencv:home:aim-prompt` (`aim-prompt.ts` line 7). Rename `APPLY_DRAG_TYPE` to `application/x-opencv-apply-card` in `apply-types.ts` line 19. Add no key migration, because the keys hold UI preferences only.
- [ ] Update the assertions in the listed tests in the same change. Fixture origins `openpath-app.vercel.app` become `opencv.me`, and the preview wildcard fixture `openpath-*-rickvudev.vercel.app` becomes `opencv-*-example.vercel.app`.
- [ ] Add one line above `export const openpathApp = pgSchema("openpath_app")` in `apps/api/src/db/schema.ts` line 23, a comment saying `openpath_app` is a historical schema name kept on purpose (ADR-0011). Leave `apps/api/drizzle` and `apps/api/src/db/migrate.test.ts` unchanged.
- [ ] Edit only the operational docs `README.md`, `AGENTS.md`, `CONTEXT.md`, `PRODUCT.md`, `docs/agents/issue-tracker.md` and `.env.example` (the `dev@openpath.app` seed email at line 51). Leave `docs/specs`, `docs/research` and `docs/adr` as historical records. Leave `docs/railway.md` and `docs/deploy.md` to PR-3. `docs/agents/issue-tracker.md` already speaks GitHub issues after PR-1, so only the brand strings in it change.
- [ ] Create `docs/adr/0011-rename-to-opencv.md` with status, context, decision and consequences. Decision text states the product is OpenCV, the Postgres schema `openpath_app` stays as an internal id, Better Auth cookies keep their prefix, and the GitHub repo and Linear project are renamed by the operator.

**You see.**

- [ ] The sidebar wordmark, the sign-in logo and the search modal header read `OpenCV`, and the browser tab title is `OpenCV`.
- [ ] A fresh signup gets a first thread titled `Welcome to OpenCV`.
- [ ] A published pitch shows the label `opencv.me/u/<slug>`.
- [ ] `grep -rli openpath apps packages --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.turbo --exclude-dir=storybook-static | grep -v drizzle | grep -v schema.ts | grep -v migrate.test.ts` prints nothing.
- [ ] `gh pr checks` reports no checks (the repo has no GitHub Actions CI), and the gates lane is green at the head.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] First edit the assertions in `apps/web/src/routes/paper.test.tsx`, `apps/web/src/test/paper-seam.test.ts`, `apps/web/src/routes/app-shell.test.tsx`, `apps/web/src/features/pitch/pitch-types.test.ts`, `apps/api/src/starter/content.test.ts` and `apps/api/src/coach/title.test.ts` to the new strings and see them fail at trunk code (red). Then run the codemod and see them pass (green). Run `pnpm --filter web test`, `pnpm --filter @workspace/domain test` and `pnpm --filter api test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Sign up a fresh user, open Home, create a thread and send one message at trunk and at head. Save `signup-regression.png` as evidence. Pass when both sides complete the same flow with no console error, trunk shows `OpenPath` branding and head shows `OpenCV` branding.
- [ ] Lane 2. Open `/app` signed in and read the sidebar wordmark. Save `sidebar-wordmark.png` as evidence. Pass when the sidebar logo text and its sr-only text equal `OpenCV` and no `OpenPath` text is in `document.body.innerText`.
- [ ] Lane 3. Read `document.title` on `/sign-in`, `/app` and a missing route via `agent-browser`. Save `tab-title.png` as evidence. Pass when all three equal `OpenCV`.
- [ ] Lane 4. Open `/sign-in` signed out. Save `signin-logo.png` as evidence. Pass when the auth screen logo reads `OpenCV`.
- [ ] Lane 5. Press Ctrl+K to open the search modal. Save `search-modal.png` as evidence. Pass when the modal header logo reads `OpenCV`.
- [ ] Lane 6. Fresh signup, then read the first thread title in the sidebar and in the thread header. Save `starter-thread.png` as evidence. Pass when the title is `Welcome to OpenCV`.
- [ ] Lane 7. Publish a pitch and open its public URL. Save `pitch-url.png` as evidence. Pass when the label reads `opencv.me/u/<slug>`, the page loads with HTTP 200, and no `openpath` text appears.
- [ ] Lane 8. Open a paper document, toggle the docs panel and drag the coach float, then run `Object.keys(localStorage)` in the page. Save `local-storage-keys.png` as evidence. Pass when the list contains `opencv:paper:docs-panel` and `opencv:paper:coach-float` and no key starts with `openpath:`.
- [ ] Lane 9. Open the Apply board and drag a card from one column to another, logging `dataTransfer.types` in a `dragstart` listener. Save `apply-drag.png` as evidence. Pass when the types include `application/x-opencv-apply-card` and the card lands in the target column.
- [ ] Lane 10. Audit lane. Run the grep from the "You see" list, then `git show HEAD --stat`, then `grep -n -B1 "openpath_app" apps/api/src/db/schema.ts` and `ls docs/adr/0011-rename-to-opencv.md`. Save `grep-sweep.png` of the terminal. Pass when the grep is empty, the comment sits directly above line 23's declaration, the ADR exists, `scripts/rename-opencv.mjs` is absent at the head, and `gh pr checks` reports no checks (no GitHub Actions CI).

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Size in bytes of the main JS chunk in `apps/web/dist/assets`, and wall time of `pnpm --filter web test`, at trunk and at head.
- [ ] Probe. In one worktree per side, run `pnpm --filter web build` and `wc -c apps/web/dist/assets/index-*.js`, then `/usr/bin/time -f %e pnpm --filter web test`, three times each, interleaved trunk then head.
- [ ] Baseline. Record the trunk chunk size (about 1,207 kB) and the median test time first.
- [ ] Rule. Chunk size at head must be within 0.5 percent of trunk, and median web test time within 10 percent. A larger gap fails.

**Review gate.** None. PR-2 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
