## Split the oversize Paper, Pitch and Apply files (PR-12)

**Depends on.** PR-11.

**Files.**

- [ ] Edit `apps/web/src/features/paper/paper-cv-document.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/cv-parts.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/internship.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/photo.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/product.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/service.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/academic.tsx`.
- [ ] Edit `apps/web/src/features/pitch/pitch-stories.tsx`.
- [ ] Create `apps/web/src/features/pitch/pitch-moments.tsx`.
- [ ] Edit `apps/web/src/features/pitch/pitch-sections.tsx`.
- [ ] Edit `apps/web/src/features/apply/apply-job-detail.tsx`.
- [ ] Create `apps/web/src/features/apply/use-job-posting.ts`.
- [ ] Edit `apps/web/src/test/design-vocabulary.test.ts`.

**Build.**

- [ ] Create `apps/web/src/features/paper/cv-templates/cv-parts.tsx` holding the shared primitives moved verbatim from `paper-cv-document.tsx`, namely `EditableField` (line 77), `ExperienceBlock` (363), `EducationBlock` (510), `SkillChips` (623), `SectionTitle` (766) and `CvPhoto` (789), with the imports they need. Export each.
- [ ] Create one file per template under `apps/web/src/features/paper/cv-templates/`, moving verbatim `InternshipCv` (line 835) to `internship.tsx`, `PhotoCv` (909) to `photo.tsx`, `ProductCv` (989) to `product.tsx`, `ServiceCv` (1176) to `service.tsx` and `AcademicCv` (1292) to `academic.tsx`. Each imports its primitives from `./cv-parts.tsx`.
- [ ] In `apps/web/src/features/paper/paper-cv-document.tsx`, keep `CvDocument` (line 134) as the template switch and keep `PAPER_CANVAS_FIELD_CLASS` (line 58) and `EditableField` exported from this path (re-export from `cv-parts.tsx`) so `paper-editor.tsx:29`, `paper-cv-document.test.tsx:14` and `routes/paper.test.tsx:26` need no edit. Target length is under 400 lines.
- [ ] In `apps/web/src/test/design-vocabulary.test.ts`, update `VOCABULARY_ALLOWLIST` (line 59 to 61) to name `features/paper/cv-templates/product.tsx` (the `bg-[#1e293b]` sidebar at the old line 1000), and add `features/paper/cv-templates/cv-parts.tsx` to `RAW_INTERACTIVE_ALLOWLIST` (the hidden file input at the old line 801), each with its reason comment on the previous line, and drop the `paper-cv-document.tsx` entries if no raw element remains there.
- [ ] Create `apps/web/src/features/pitch/pitch-moments.tsx` and move `MomentsBentoSection` (pitch-stories.tsx:445) and `BentoCard` (line 510) into it verbatim. In `apps/web/src/features/pitch/pitch-sections.tsx` change the import at line 12 to `@/features/pitch/pitch-moments.tsx`. `pitch-stories.tsx` keeps `StoryHighlightsRow`, `PitchStoryViewer`, `StoryFrame` and `StoryFramePreview` and drops under 450 lines.
- [ ] Create `apps/web/src/features/apply/use-job-posting.ts` exporting `useJobPosting({ card, jobUrl, onPatch, onScanned })` that owns `scanning`, `scanError`, `scanJdText`, `copied` (via `useFlash(2000)` from PR-11), `copyError`, `scanPosting` and `copyPosting`, moved from `JobDetailFields` (apply-job-detail.tsx lines 232 to 236 and 273 to 320). `onScanned({ title, company })` lets the component keep its own `title` and `company` state.
- [ ] In `apps/web/src/features/apply/apply-job-detail.tsx`, call `useJobPosting` from `JobDetailFields` (line 221) and delete the moved state and the inline `window.setTimeout(() => setCopied(false), 2000)` at line 287. Do not change any rendered markup.
- [ ] These are pure moves except the one hook. No logic, class or copy changes.

**You see.**

- [ ] `wc -l apps/web/src/features/paper/paper-cv-document.tsx apps/web/src/features/pitch/pitch-stories.tsx apps/web/src/features/apply/apply-job-detail.tsx` prints each under 400, 450 and 600 lines (trunk prints 1448, 600 and 723).
- [ ] `ls apps/web/src/features/paper/cv-templates` lists `academic.tsx cv-parts.tsx internship.tsx photo.tsx product.tsx service.tsx`.
- [ ] Each of the five CV templates renders in the browser identically to trunk.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/features/paper/paper-cv-document.test.tsx` gains one case that renders `CvDocument` once per template id (internship, photo, product, service, academic) and asserts each shows the candidate name and the "Experience" heading. Red first at trunk is not possible for a pure move, so record it green at trunk and green at head. Run `pnpm --filter web exec vitest run src/features/paper/paper-cv-document.test.tsx`.
- [ ] `apps/web/src/routes/apply.test.tsx` gains a case that clicks Copy on the posting link and asserts the "Copied" label appears then clears after 2 seconds with fake timers. Run `pnpm --filter web exec vitest run src/routes/apply.test.tsx`.
- [ ] Design vocabulary test stays green with the updated allowlists. Run `pnpm --filter web exec vitest run src/test/design-vocabulary.test.ts`.
- [ ] Full suite, lint and typecheck stay green. Run `pnpm --filter web test && pnpm --filter web lint && pnpm --filter web typecheck`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Sign up a fresh account, open the starter CV in Paper, pick the Internship template, and screenshot the canvas at 1280 by 900 at trunk and at head. Save `pr12-internship-trunk-vs-head.png`. Pass when the two canvases are pixel-identical or differ by under 0.1 percent of pixels in an image diff.
- [ ] Lane 2. Same comparison for the Photo template. Save `pr12-photo-trunk-vs-head.png`. Pass when the canvases match within 0.1 percent of pixels, including the photo placeholder.
- [ ] Lane 3. Same comparison for the Product template. Save `pr12-product-trunk-vs-head.png`. Pass when the canvases match within 0.1 percent of pixels, including the dark sidebar colour.
- [ ] Lane 4. Same comparison for the Service template. Save `pr12-service-trunk-vs-head.png`. Pass when the canvases match within 0.1 percent of pixels.
- [ ] Lane 5. Same comparison for the Academic template. Save `pr12-academic-trunk-vs-head.png`. Pass when the canvases match within 0.1 percent of pixels.
- [ ] Lane 6. CV editing parity. In the Product template edit the summary, add an experience bullet, upload a photo through the hidden file input, wait for autosave, reload. Save `pr12-cv-edit-roundtrip.png`. Pass when all three edits persist and no console error appears.
- [ ] Lane 7. Pitch page visual comparison. Open `/app/pitch` at trunk and at head with the same seeded data, screenshot the story highlights row and the moments section. Save `pr12-pitch-trunk-vs-head.png`. Pass when both screenshots match within 0.1 percent of pixels.
- [ ] Lane 8. Pitch interactions. Open a story from the highlights row, let the timer advance, press the pause control, close the viewer, then add a moment card in edit mode. Save `pr12-pitch-stories-moments.png`. Pass when the viewer advances, pauses, closes and the new moment card shows.
- [ ] Lane 9. Apply job detail. Open a card's detail, paste job text and press Scan, then click Copy on the posting link. Save `pr12-apply-detail-scan-copy.png`. Pass when the scan result or the scan error renders, the "Copied" label shows and clears after about 2 seconds, and the layout matches trunk.
- [ ] Lane 10. Audit lane. Run `git diff -M --stat trunk...HEAD` and `wc -l` on the moved files. Save `pr12-move-audit.png`. Pass when git reports the template and moments files as renames or copies of trunk code, the only new logic is `use-job-posting.ts`, and no file in `cv-templates/` exceeds 560 lines.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Line count of the three oversize files and total gzip JS bytes from `pnpm --filter web build`.
- [ ] Probe. At trunk and at head, interleaved, run `wc -l` on the three files, then `pnpm --filter web build` and sum `gzip -c <file> | wc -c` over `apps/web/dist/assets/*.js`.
- [ ] Baseline. Record the trunk values first. The audit measured 1448, 600 and 723 lines.
- [ ] Rule. Fail if `paper-cv-document.tsx` is above 400 lines, `pitch-stories.tsx` above 450, `apply-job-detail.tsx` above 600, or head gzip JS is more than 0.5 percent above trunk.

**Review gate.** None. PR-12 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
