# Web guards

Each rule sits with the reason and the check that enforces it. A `pending` or `PENDING` entry (issue or PR, expiry) lists a known offender; a stale entry fails its test.

## Feature imports

`apps/web/src/test/feature-imports.test.ts` rejects an import between `apps/web/src/features` folders that its `FEATURE_IMPORTS` table does not list, a folder with no row, a row for a gone folder, and an edge no import uses.

## Hover, focus and pointer

- Web lint rejects `onMouseEnter`/`onPointerEnter` (use kit `Popover openOnHover` or `useHoverIntent`), `inert={...}` (use `FocusSafeRegion`), `style.setProperty("--x")` (set `width` or `transform`) and a `window`/`document` key listener (use `useShortcut`, `apps/web/src/lib/use-shortcut.ts`, which ignores typing, held keys and a pointer drag).
- `scripts/focus-indication.test.mjs` rejects a `*.pen.css` rule that sets `box-shadow` or `outline` on a button, link or field with no `:focus-visible` rule; web lint rejects `hover:bg-transparent` and `focus-visible:ring-0` under `features/app-shell`.
- `scripts/pointer-capture.test.mjs` rejects `setPointerCapture` in a module with no `pointercancel` and `lostpointercapture` handler.
- `scripts/touch-targets.test.mjs` rejects a Button or hover-styled class under `features/app-shell` with no 44px phone height (`h-11 md:h-7`).
- `apps/web/src/test/disclosure-buttons.test.ts` rejects `aria-controls` without `aria-expanded`, and an app-shell dock button without both.

## Kit pieces

`scripts/kit-duplicates.test.mjs` rejects `clipboard.writeText` or `execCommand("copy")` outside `packages/ui/src/components/copy-button.tsx`, `animate-spin` in `apps/*`, and a hand-built breadcrumb; use kit `CopyButton`, `Spinner` and `Breadcrumb`. A `pending` entry (PR, expiry) lists a caller being migrated.

## Navigation

`apps/web/src/test/nav-contract.test.tsx` renders each router route under a nav item and rejects an item not current on it, or a count missing from its link name. `nav-pending.json` lists known offenders (PR, expiry); `scripts/nav-pending.test.mjs` fails a stale one.

## Paper autosave

`scripts/paper-save-keeps-parts.test.mjs` rejects an autosave `toDocument` that returns the markdown alone, which would erase a letter's sender, date and closing. Its `PENDING` list works like the one above.

## Browser scripts

Start a browser only through `scripts/lib/chrome-process.mjs` (`scripts/browser-launcher.test.mjs`).
