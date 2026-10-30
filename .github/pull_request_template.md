<!--
Title format: type: short description (#<issue>)
Write this body with the pr skill. scripts/ocv-tools.mjs finish --body-file <this file> adds "Closes #<issue>" and refuses a body
that lacks the three parts below or still has a placeholder. The title becomes the squash commit message on main.
-->

## Summary

<diagram, diff-sketch, or tree>

## Evidence

- **Before:** <screenshot/output/failing test run>
  **After:** <screenshot/output/passing test run>

## Merge Danger

**Door:** <one-way or two-way>

**Blast Radius:** <one-word description>

## Checklist

- [ ] Branch is `type/<issue#>-short-description`
- [ ] Title is `type: description (#<issue>)`
- [ ] `ci` is green (parallel affected jobs and guards). No `--no-verify`; if `SKIP_CHECKS=1` was used, say why
- [ ] Merge with `scripts/ocv-tools.mjs merge <pr#>` once `ci` is green and the PR is not a draft
- [ ] Env/secrets handling touched? Check no real secret or `.env` file is committed
- [ ] A big decision, or deletes much of the code base? Add the `needs-human-review` label (an agent will not merge it)
