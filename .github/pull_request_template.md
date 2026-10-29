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

1. Run a verify skill by hand when you want one (`.claude/skills/verify-opencv`):
2.

## Checklist

- [ ] Branch is `type/<issue#>-short-description`
- [ ] Title is `type: description (#<issue>)`
- [ ] `ci` is green (`scripts/check.sh --changed` is what it runs). No `--no-verify`; if `SKIP_CHECKS=1` was used, say why
- [ ] Merge with `scripts/merge-pr.sh <pr#>` once `ci` is green and the PR is not a draft
- [ ] Env/secrets handling touched? Check no real secret or `.env` file is committed
- [ ] A big decision, or deletes much of the code base? Add the `needs-human-review` label (an agent will not merge it)
