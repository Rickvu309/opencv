# Review Log: WO-37

**Work Order:** WO-37 — Add photo-bearing CV template set (needs per-account photo storage)

## Round 1 — 2026-08-13

**Reviewer:** implementation agent, inline.
**Scope:** `git diff f7c8840..HEAD` limited to the paths owned by this work order.

### Requirements alignment

- **AC-PAPERS-010.4** — photo area only on templates that have one; add and remove supported (`lib/cv/photos.test.ts`)
- **AC-PAPERS-010.5** — the preview and the print copy read the same URL, which carries it into the PDF (`components/cv/resume-document.tsx`)

Verdict for this dimension: **pass**. Every acceptance criterion on the linked
requirements document that this work order owns is implemented and covered by a
test or by recorded live verification.

### Blueprint alignment

Components and contracts follow the linked blueprints:

- Own table, not `app_state`: the image is tens of kilobytes and the document is written on every keystroke.
- Not blob storage: the image belongs to one account, must disappear with it, and must never be readable by URL to anyone else. A foreign key and a cascade give all three.
- The browser downscales and re-encodes before uploading; the server enforces its own limit.
- JPEG and PNG only. SVG is a document that can carry script and this renders inside the app's own origin.
- Switching to a template without a photo area hides the photo rather than deleting it.

Verdict for this dimension: **pass**.

### Architecture and conventions

Placement, naming and error handling follow the surrounding code: stable failure
codes as `app/api/waitlist/route.ts` established, `{ vi, en }` pairs for every
user-facing string, design tokens rather than raw hex, and every state change
through the action registry.

Verdict for this dimension: **pass**.

### Tests and build health

`npm test` 282 passing, 0 failing. `npm run lint` clean. `npx tsc --noEmit`
clean. `npm run build` succeeds.

Baseline note, not caused by this work: the repository requires Node 24 and the
machine had Node 22, on which the whole suite fails to load because Node 22 does
not strip TypeScript types. Node 24 was installed locally rather than changing
the repository's scripts.

Verdict for this dimension: **pass**.

### User-facing verification

12 photo tests pass. Verified live: upload, byte-identical fetch, SVG refused (415), another account 404, signed out 401, delete works.

No browser automation tool is configured in this environment, so exploratory
checks were made with HTTP requests against the running dev server rather than a
rendered browser session. Layout and visual regressions are therefore **not**
covered by this review and remain unverified.

Verdict for this dimension: **pass, with the stated limit**.

### Security, privacy and data safety

Reviewed for this work order: authentication and session handling, input
validation at every boundary, secrets kept out of tracked files and out of logs,
per-account isolation, and migration safety. No secret or credential appears in
a tracked file; no log line carries a password, a token or a state body.

Verdict for this dimension: **pass**.

### Findings

1. **Blocking — fixed during this round.** `lib/cv/photos.test.ts`, dimension:
   tests and build health. Three `prefer-const` errors shipped in commit
   `f922c0c`: the tests were run after that file was written but `npm run lint`
   was not, so a red lint landed on `main`. Fixed. The process lesson is
   recorded in the checklist: lint belongs in the same command as the tests, not
   in a separate step that can be skipped.

No advisory findings.

### Verdict

**APPROVED**
