---
status: accepted
---

# A merge to main is a production deploy, checked afterwards by a read-only probe

There is no staging step: main deploys to production within minutes of each merge. The safety comes before the merge, where the merge queue runs the full checks on the merged tree, and after it, where a read-only probe opens a real imported CV in production. Two probe failures in a row put production red, which closes the queue to everything but a revert of the code; migrations are never reverted, because only-adds migrations are the norm and any other kind needs its allow-migration:<tag> label.

## Considered options

- A staging environment between main and production: a second deploy target to keep in step, for a product whose data is all test data today.
- A platform rollback on a failed probe: needs a privileged identity that can change production by itself, and commits would no longer all carry the owner's name.
- A revert pull request through the normal delivery flow, started by the coordinator (chosen).

## Consequences

- The probe makes no writes and separates a broken product from a broken probe, so an expired probe session never closes the queue.
- Workers never call production; only CI does, after a deploy.
