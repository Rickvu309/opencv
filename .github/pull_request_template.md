<!--
Title format: type: short description (#<issue>)
Example:      feat: add login page (#42)
Types: feat | fix | hotfix | refactor | chore | docs
The title becomes the squash commit message on main.
-->

Closes #<!-- issue number, required -->

## What changed

-

## Why

-

## How to test

1. Open the Vercel preview (web changes) or run it locally:
2.

## Checklist

- [ ] Branch is `type/<issue#>-short-description` and is rebased on the latest `main`
- [ ] Title is `type: description (#<issue>)`
- [ ] `scripts/check.sh` passes (lint, typecheck, test). No `--no-verify`; if `SKIP_CHECKS=1` was used, say why
- [ ] Gates lane report is green on the exact head
- [ ] Env/secrets handling touched? Check no real secret or `.env` file is committed
- [ ] A big decision, or deletes much of the code base? Add the `needs-human-review` label (then only a human approves)
