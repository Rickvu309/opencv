# Design parity commands

The rules and the table of what enforces each live in `AGENTS.md`. This page holds the long commands.

## Install a registry piece

`pnpm dlx shadcn@latest add <name> -c apps/web` for shadcn, `pnpm dlx shadcn@latest add https://www.kibo-ui.com/r/<name>.json -c apps/web` for Kibo UI, `https://www.cult-ui.com/r/<name>.json` for Cult UI, `@magicui/<name>` for Magic UI and `https://www.affectui.com/r/<name>.json` for affectUI.

## Regenerate a snapshot

`node scripts/pen-snapshot.mjs <pen> <frame id> <out.json>`.

The auth frame also copies its shader: `node scripts/pen-snapshot.mjs <pen> x1ht5a apps/web/src/features/auth/design/auth.snapshot.json --assets apps/web/src/features/auth/design`.

Regenerate the release frame list with `node scripts/pen-release-frames.mjs <pen> apps/web/src/test/design-frames.json`.

## Record a signed-in screen's expected layout

`node scripts/pen-layout.mjs <pen> <frame id> apps/web/src/features/<feature>/design/<screen>.layout.json --route <path>` records every pen text's box, size, weight, tracking and colour. `verify:pen-layout` loads each layout's route at 1440x900.

## Marketing design check

`node scripts/verify-marketing-design.mjs <local web origin> <evidence directory>` visits pricing and every post at desktop and phone widths and saves screenshots.
