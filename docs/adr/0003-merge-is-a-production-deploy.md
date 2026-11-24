---
status: accepted
---

# A merge to main is a production deploy, checked afterwards by a read-only probe

There is no staging step: main deploys to production within minutes of a green run on main. The safety comes at three points. Before the merge, the merge queue runs the full checks on the merged tree. After the merge, main is tested again: every push to main gets a full ci run, with every formal model, and production deploys a commit only after that run's ci job succeeded for that same commit. After the deploy, a read-only probe opens a real imported CV in production.

A red point closes merging to everything but a revert. A failed ci run on main opens one main-red issue, or comments on the open one, with the commit, the run and the revert command; a later green run on main that contains every red commit closes it. Two probe failures in a row put production red. While a main-red or production-red issue is open, only a pull request labeled production-red-revert merges. A revert reverts code only; migrations are never reverted, because only-adds migrations are the norm and any other kind needs its allow-migration:<tag> label.

## Considered options

- A staging environment between main and production: a second deploy target to keep in step, for a product whose data is all test data today.
- A platform rollback on a failed probe or a red main: needs a privileged identity that can change production by itself, and commits would no longer all carry the owner's name.
- A revert pull request through the normal delivery flow, started by the coordinator (chosen).

## Consequences

- The probe makes no writes and separates a broken product from a broken probe, so an expired probe session never closes the queue.
- Workers never call production; only CI does, after a deploy.
- A red main never reaches production: Railway keeps waiting for approval, and the approval names only the commit whose run was green and stops when main has moved past it.
- The main-red report only opens, comments on and closes issues; it never commits, pushes or opens a pull request.
