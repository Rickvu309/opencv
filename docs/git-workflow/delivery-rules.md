# Finish and merge rules

These refusals belong to the delivery jobs (finish and merge). The table comes from the same rule table as [workflow rules](rule-enforcement.md). Run `scripts/ocv-tools.mjs rules --write` to refresh every guide; `rules --check` checks them all.

<!-- rules:begin -->

| rule                   | what makes it fail                                                                                         | fix                                                                             | at            | holds against main |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------- | ------------------ |
| STALE_CHECK (4)        | The saved work changed during push.                                                                        | Fix the cause, then run scripts/ocv-tools.mjs finish again.                     | finish-pushed | no                 |
| BAD_BODY (4)           | The PR body needs a Summary, Evidence and Merge Danger section with content, and no template placeholders. | Fix the cause, then run scripts/ocv-tools.mjs finish again.                     | finish        | no                 |
| BAD_TITLE (4)          | The PR title is type: description (#n).                                                                    | Fix the cause, then run scripts/ocv-tools.mjs finish again.                     | finish        | no                 |
| NO_COMMITS (4)         | There are no commits beyond origin/main.                                                                   | Fix the cause, then run scripts/ocv-tools.mjs finish again.                     | finish        | no                 |
| DRAFT (6)              | A draft PR cannot merge.                                                                                   | Run: gh pr ready <pr#>                                                          | merge         | no                 |
| NEEDS_HUMAN_REVIEW (6) | An agent never merges a PR needing human review.                                                           | A human reviews it. An agent never removes the needs-human-review label.        | merge         | no                 |
| BAD_BRANCH (6)         | The PR branch must name its issue.                                                                         | Rename the branch type/<issue#>-short-description and reopen.                   | merge         | no                 |
| CLOSED_PR (6)          | The PR must be open or already merged.                                                                     | Open a new PR with scripts/ocv-tools.mjs finish.                                | merge         | no                 |
| CI_REQUIRED (6)        | The newest ci check must succeed on the PR head.                                                           | Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>. | merge         | no                 |
| LEFT_QUEUE (6)         | The PR must stay in the queue until it merges.                                                             | Run: gh run list --branch 'gh-readonly-queue/main/pr-<pr#>-*' --limit 1         | queue         | no                 |
| QUEUE_TIMEOUT (6)      | The queue must merge the PR within 45 minutes.                                                             | Run: scripts/ocv-tools.mjs merge <pr#> --wait                                   | queue         | no                 |
| HEAD_MOVED (6)         | The PR head must stay the commit ci passed.                                                                | Run: scripts/ocv-tools.mjs merge <pr#> --wait                                   | queue         | no                 |
| CI_FAILED (6)          | The newest ci check on the PR head must succeed.                                                           | Run: gh pr checks <pr#>, fix what it names, then gh run rerun <id> --failed     | queue         | no                 |

<!-- rules:end -->
