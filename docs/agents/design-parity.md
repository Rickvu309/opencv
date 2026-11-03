# Design system and pen parity

## Design system

Stock shadcn/ui on `base-nova` (Base UI) in `packages/ui`. `docs/adr/0006-design-system-values-and-the-kit-as-generator.md` carries the design-system rule. Import through `@workspace/ui/components/<name>` and `@workspace/ui/globals.css`, and prefer kit components over raw `<button>`/`<input>`/`<textarea>`/`<select>`. Sources in order: shadcn/ui, AI Elements patterns copied into `apps/web/src/components/ai-elements/`, Kibo UI for large app pieces, then Cult UI, Magic UI and free affectUI items for showpieces. App code uses shadcn's own CSS variables only (`--background`, `--primary`, `--sidebar-*` and so on) and stock Tailwind sizes, with no raw hex or named palette classes (`bg-red-500`) outside the CV print paper. User-approved exception: pen-backed screens may use exact reference typography, spacing, dimensions and colors while retaining Inter and shared shadcn components. Keep exact colors in feature-local design/*.pen.css, scope every selector with that feature's data-pen-surface attribute, and use only hex colors present in adjacent *.styles.json source snapshots. Exact sizes may use arbitrary values. Motion uses the two token pairs in `globals.css`, `--duration-micro` with `--ease-micro` and `--duration-panel` with `--ease-panel`. `design-vocabulary.test.ts` and `ui-kit-contract.test.ts` in `apps/web/src/test` enforce all of it.

## Install a registry piece

`pnpm dlx shadcn@latest add <name> -c apps/web` for shadcn, `pnpm dlx shadcn@latest add https://www.kibo-ui.com/r/<name>.json -c apps/web` for Kibo UI, `https://www.cult-ui.com/r/<name>.json` for Cult UI, `@magicui/<name>` for Magic UI and `https://www.affectui.com/r/<name>.json` for affectUI.

After every install run `node scripts/ds-codemod.mjs`, and map any registry token to a shadcn variable.

## Pen parity

The landing's design source is the pen frame named in `apps/web/src/features/landing/design/landing.snapshot.json`, the sign-in screen's the frame in `apps/web/src/features/auth/design/auth.snapshot.json`. Regenerate a snapshot as below. Build from the pen snapshots, not `design/exports` PNGs. Every first-release frame (listed in `apps/web/src/test/design-frames.json`) needs a committed snapshot that a test reads, or an entry in `PENDING_FRAMES` with its issue and expiry. A signed-in frame (W1 to W12) also needs a layout check: a test imports its `*.layout.json`, or a screen check that `scripts/ci-screens.mjs` runs and does not skip measures it. Otherwise it waits in `apps/web/src/test/design-frames.layout-pending.json`. Both pending lists only shrink: their sizes are pinned in `apps/web/src/test/design-frames.pending-count.json`, so removing an entry means lowering its count in the same commit. `scripts/frame-ledger.test.mjs` checks all of it. Apply's frames (W9.1 to W10.7) live in `apps/web/src/features/apply/design`; after an Apply change run `PORT=$(sed -n 's/^PORT=//p' .env) pnpm --filter web verify:apply-pen` (`.claude/skills/verify-app-ui/apply-pen.md`). For pricing or blog cover changes, run `node scripts/verify-marketing-design.mjs <local web origin> <evidence directory>` against your worktree port, then inspect the screenshots.

### Regenerate a snapshot

`node scripts/pen-snapshot.mjs <pen> <frame id> <out.json>`.

The auth frame also copies its shader: `node scripts/pen-snapshot.mjs <pen> x1ht5a apps/web/src/features/auth/design/auth.snapshot.json --assets apps/web/src/features/auth/design`.

Regenerate the release frame list with `node scripts/pen-release-frames.mjs <pen> apps/web/src/test/design-frames.json`.

### Marketing design check

`node scripts/verify-marketing-design.mjs <local web origin> <evidence directory>` visits pricing and every post at desktop and phone widths and saves screenshots.

## Signed-in screen layout

Signed-in screens match their pen frame in layout, not only in copy. A screen built from a frame gets an expected layout (`<screen>.layout.json`, recorded as below). Run `PORT=$(sed -n 's/^PORT=//p' .env) pnpm --filter web verify:pen-layout` before marking a design PR ready and attach its output. Build each designed screen in its own component from its frame, not in a shared page template that predates it.

`node scripts/pen-layout.mjs <pen> <frame id> apps/web/src/features/<feature>/design/<screen>.layout.json --route <path>` records every pen text's box, size, weight, tracking and colour, and the box of every pen icon and small drawn box (`icons`, `boxes`), so a button that holds only an icon counts as drawn by the frame. `verify:pen-layout` loads each layout's route at 1440x900.

`scripts/layout-comparison-gates.test.mjs` rejects a verify driver that calls `comparePenLayout` and never reads its `mismatches`. A `PENDING` entry (issue, expiry) lists an exception.

## Rules and what enforces them

| Rule                                                                | Enforced by                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Landing text matches the pen frame                                  | `landing-design-parity.test.tsx`                                                                 |
| Landing text styles and marks match the frame                       | verify-landing 31                                                                                |
| Auth screens match the pen auth layout                              | `auth-design-parity.test.tsx`                                                                    |
| Pen shader and image fills are built, not dropped                   | `scripts/pen-snapshot.mjs` fills and the parity tests                                            |
| Hidden pen nodes stay hidden                                        | `scripts/pen-snapshot.mjs` skips `enabled:false`                                                 |
| Landing art comes from pen geometry                                 | `scripts/pen-art-to-svg.mjs` and verify-landing 27                                               |
| Rotated pen ellipses pivot on the corner                            | `scripts/pen-art-to-svg.mjs` and verify-landing 30                                               |
| Nav lockup spacing matches the frame                                | verify-landing 28                                                                                |
| Marketing calls to action                                           | `landing-button.ts`, `landing-button.test.ts` and verify-landing 29                              |
| Pricing uses its own pen frame and scale                            | `pricing-parity.test.tsx` and `scripts/verify-marketing-design.mjs`                              |
| Blog cover shows the article’s argument                             | Typed `blog-cover-stories.ts`, `blog-covers.test.tsx`, and `scripts/verify-marketing-design.mjs` |
| Verify skills name product routes without the retired `/app` prefix | `scripts/skill-routes.test.mjs`                                                                  |
| Apply shows every text and icon of its frames                       | `apply-design-parity.board.test.tsx`, `apply-design-parity.job.test.tsx`                         |
