# Rename the product from OpenPath to OpenCV

**Status.** Accepted.

**Context.** The product ships under a new name and domain, `OpenCV` at `opencv.me`. The old name appears in UI strings, Coach prompts, localStorage keys, the drag type, sample data, fixtures and operational docs. Some identifiers are stored or deployed state that a rename would break or force a migration for.

**Decision.** The product is OpenCV. One codemod, `scripts/rename-opencv.mjs`, rewrote an explicit replacement table over an explicit file allowlist, and was deleted in the last commit of the PR because it has no future use. `OpenPathLogo` and `OpenPathMark` became `OpenCvLogo` and `OpenCvMark`. The localStorage prefixes became `opencv:` with no key migration, because the keys hold UI preferences only. Existing threads keep their stored title.

The Postgres schema `openpath_app` stays as an internal id. Renaming it needs a migration and a data move for no user-visible gain, so `apps/api/src/db/schema.ts` carries a comment saying it is kept on purpose, and `apps/api/drizzle` is untouched. Better Auth sets no `cookiePrefix`, so its cookies keep their default prefix and signed-in sessions survive the rename.

The GitHub repo is now `quanvu309/opencv`. The Linear project is now `OpenCV`, with the same URL slug (`opencv-2f6ea8fa4fa8`) and the same team key, `QVE`. The operator renamed both ahead of this change.

**Consequences.**

- `docs/specs`, `docs/research` and ADRs `0001` to `0010` keep the old name as historical records.
- `docs/deploy.md` and `docs/railway.md` still describe the Vercel era and move with the hosting change.
- The `openpath_app` schema name will look odd next to the new brand. A future migration can rename it if that ever matters.
- Fixture origins use `opencv.me` and `opencv-*-example.vercel.app`, so tests no longer name a real Vercel account.
