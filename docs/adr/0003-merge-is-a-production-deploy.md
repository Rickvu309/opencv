---
status: accepted
---

# A merge to main is a production deploy

There is no staging step: main deploys to production within minutes of a green run on main. The safety comes at three points. Before the merge, ci must be green on the pull request, which merges by itself once it is. After the merge, main is tested as a whole: every push to main gets a full ci run, with every formal model, and production deploys a commit only after that run's ci job succeeded for that same commit. There is no merge queue, so two changes that each pass alone can still break main together; the run on main is what catches that, before production sees it. After the deploy, the health endpoint reports the live commit and schema version. A read-only probe in scripts/deploy-probe.mjs can open a real imported CV in production, but no workflow runs it today.

A red point closes merging to everything but a revert. A failed ci run on main opens one main-red issue, or comments on the open one, with the commit, the run and the revert command; a later green run on main that contains every red commit closes it. The failed jobs of a first failure run again once by themselves, so a chance failure heals without anyone acting and a second failure is treated as real. When someone runs the probe, two failures in a row put production red. While a main-red or production-red issue is open, only a pull request labeled production-red-revert merges. A revert reverts code only; migrations are never reverted, because only-adds migrations are the norm and any other kind needs its allow-migration:<tag> label.

The agreed limit is that main goes red in at most 3 of its last 30 runs, counting a run that needed a second attempt as red. Each main-red issue states the current count. Over the limit, fixing what makes main red comes before new work; if that does not bring it back under, a second check before the merge returns.

## Considered options

- A staging environment between main and production: a second deploy target to keep in step, for a product whose data is all test data today.
- A platform rollback on a failed probe or a red main: needs a privileged identity that can change production by itself, and commits would no longer all carry the owner's name.
- A merge queue that tests the merged tree before the merge: used until 2026-11-24, then removed by the owner. It repeated the full check for every merge, and the code that waited on it took 13 of the delivery tool's 34 fixes. Leaving it has a measured cost: 12 of 200 queue runs failed after a green pull request run, and each of those would now turn main red.
- A bot that reverts the first red commit by itself: on 2026-11-24 main went red four times and three were chance failures that no commit caused, so it would have reverted three innocent changes.
- A revert pull request through the normal delivery flow, started by the coordinator (chosen).

## Consequences

- The probe makes no writes and separates a broken product from a broken probe, so an expired probe session never closes merging.
- Workers never call production.
- A red main never reaches production: Railway keeps waiting for approval, and the approval names only the commit whose run was green and stops when main has moved past it.
- The main-red report only opens, comments on and closes issues; it never commits, pushes or opens a pull request.
