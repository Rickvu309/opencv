# Design parity

Design parity. The landing's design source is the pen frame named in `apps/web/src/features/landing/design/landing.snapshot.json`. The sign-in screen's is the frame in `apps/web/src/features/auth/design/auth.snapshot.json`. Regenerate a snapshot with `node scripts/pen-snapshot.mjs <pen> <frame id> <out.json>` when the design changes. The auth frame also copies its shader: `node scripts/pen-snapshot.mjs <pen> x1ht5a apps/web/src/features/auth/design/auth.snapshot.json --assets apps/web/src/features/auth/design`. Never build from `design/exports` PNGs. Every first-release frame (listed in `apps/web/src/test/design-frames.json`, regenerated with `node scripts/pen-release-frames.mjs <pen> apps/web/src/test/design-frames.json`) needs a committed snapshot that a test reads, or an entry in `PENDING_FRAMES` with its issue and expiry. A behavior test in the same folder does not count as design coverage. Apply's frames (W9.1 to W10.7) live in `apps/web/src/features/apply/design`; after an Apply change run `PORT=4454 pnpm --filter web verify:apply-pen` (`.claude/skills/verify-app-ui/apply-pen.md`). For pricing or blog cover changes, run `node scripts/verify-marketing-design.mjs <local web origin> <evidence directory>` against your assigned worktree port. It visits pricing and every post at desktop and phone widths and saves screenshots. Inspect those images; visible labels cannot establish visual quality by themselves.

Signed-in screens match their pen frame in layout, not only in copy. A screen built from a frame gets an expected layout: `node scripts/pen-layout.mjs <pen> <frame id> apps/web/src/features/<feature>/design/<screen>.layout.json --route <path>` records every pen text's box, size, weight, tracking and colour. `PORT=4450 pnpm --filter web verify:pen-layout` loads each layout's route at 1440x900 and fails on any text more than 8px off or styled differently. Run it before marking a design PR ready and attach its output. Build each designed screen in its own component from its frame. Never pour a new frame into a shared page template that predates it.

Rules and what enforces them:

| Rule                                                                | Enforced by                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Landing text matches the pen frame                                  | `landing-design-parity.test.tsx`                                                                  |
| Landing text styles and marks match the frame                       | verify-landing 31                                                                                 |
| Auth screens match the pen auth layout                              | `auth-design-parity.test.tsx`                                                                     |
| Pen shader and image fills are built, not dropped                   | `scripts/pen-snapshot.mjs` fills and the parity tests                                             |
| Hidden pen nodes stay hidden                                        | `scripts/pen-snapshot.mjs` skips `enabled:false`                                                  |
| Landing art comes from pen geometry                                 | `scripts/pen-art-to-svg.mjs` and verify-landing 27                                                |
| Rotated pen ellipses pivot on the corner                            | `scripts/pen-art-to-svg.mjs` and verify-landing 30                                                |
| Nav lockup spacing matches the frame                                | verify-landing 28                                                                                 |
| Marketing calls to action                                           | `landing-button.ts`, `landing-button.test.ts` and verify-landing 29                               |
| Pricing uses its own pen frame and scale                            | `pricing-parity.test.tsx` and `scripts/verify-marketing-design.mjs`                               |
| Blog cover shows the article’s argument                             | Typed `blog-cover-stories.ts`, `blog-covers.test.tsx`, and `scripts/verify-marketing-design.mjs`  |
| Signed-in screen layout matches its pen frame                       | `scripts/pen-layout.mjs`, `*.layout.json` and `verify:pen-layout` (`pen-layout-compare.test.mjs`) |
| Verify skills name product routes without the retired `/app` prefix | `scripts/skill-routes.test.mjs`                                                                   |
| Apply shows every text and icon of its frames                       | `apply-design-parity.board.test.tsx`, `apply-design-parity.job.test.tsx`                          |
| Apply text styles and icon sizes match the frames                   | `verify-apply-pen.mjs` (`pnpm --filter web verify:apply-pen`)                                     |
| Stock tokens only                                                   | `design-vocabulary.test.ts`                                                                       |
| Release frames have parity snapshots                                | `design-frame-coverage.test.ts`                                                                   |
| Module boundaries                                                   | `boundaries.test.ts`                                                                              |
