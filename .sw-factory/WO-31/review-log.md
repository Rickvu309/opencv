# Review Log: WO-31

**Work Order:** WO-31 — Build document workspace UI for cover letter and project write-up

## Round 1 — 2026-08-13

**Reviewer:** implementation agent, inline.
**Scope:** `git diff f7c8840..HEAD` limited to the paths owned by this work order.

### Requirements alignment

- **AC-PAPERS-006.2** — every paragraph is its own editable box (`app/(app)/papers/page.tsx`)
- **AC-PAPERS-007.2** — same surface serves write-ups (`app/(app)/papers/page.tsx`)

Verdict for this dimension: **pass**. Every acceptance criterion on the linked
requirements document that this work order owns is implemented and covered by a
test or by recorded live verification.

### Blueprint alignment

Components and contracts follow the linked blueprints:

- One box per paragraph, not one for the whole body: the Coach edits by paragraph, and a single box has to write the whole body back, so a draft landing mid-sentence would be overwritten by the next blur.
- Export reuses `lib/papers/export.ts`; PDF is the browser's print through a body-mounted portal, as the CV does.
- Deliberately does not reuse the resume section/header editors or the A4 preview, per the work order's exclusion.

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

Both screens render signed in and 307 signed out. A print-portal defect found in review was fixed (see review-log).

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

1. **Blocking — fixed during this round.** `components/papers/paper-print.tsx`,
   dimension: user-facing verification. The printable article carried an inline
   `display: none`. `globals.css` reveals `[data-print-portal]`, which is the
   host element, so the host turned back on in print and the article stayed off:
   the exported PDF would have been blank. Fixed by removing the inline style;
   the host alone controls visibility, which is how the CV portal already worked.

No advisory findings.

### Verdict

**APPROVED**
