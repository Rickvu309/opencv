# Implementation Plan: WO-37

**Work Order:** WO-37 — Add photo-bearing CV template set (needs per-account photo storage)

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Add photo-bearing CV template set (needs per-account photo storage)

## Files

- `lib/db/migrations/007_cv_photos.*.sql`
- `lib/cv/photos.ts`
- `lib/cv/photo-url.ts`
- `app/api/cv-photo/route.ts`
- `components/cv/photo-field.tsx`
- `components/cv/resume-document.tsx`

## Approach and decisions

- Own table, not `app_state`: the image is tens of kilobytes and the document is written on every keystroke.
- Not blob storage: the image belongs to one account, must disappear with it, and must never be readable by URL to anyone else. A foreign key and a cascade give all three.
- The browser downscales and re-encodes before uploading; the server enforces its own limit.
- JPEG and PNG only. SVG is a document that can carry script and this renders inside the app's own origin.
- Switching to a template without a photo area hides the photo rather than deleting it.

## Acceptance criteria and how each is met

- **AC-PAPERS-010.4** — photo area only on templates that have one; add and remove supported (`lib/cv/photos.test.ts`)
- **AC-PAPERS-010.5** — the preview and the print copy read the same URL, which carries it into the PDF (`components/cv/resume-document.tsx`)

## Testing

12 photo tests pass. Verified live: upload, byte-identical fetch, SVG refused (415), another account 404, signed out 401, delete works.

## Scope notes

None. The change stays inside the work order's In Scope list.
