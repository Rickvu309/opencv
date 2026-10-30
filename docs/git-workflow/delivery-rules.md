# Finish and merge rules

These refusals belong to the delivery jobs (finish and merge). The table comes from the same rule table as [workflow rules](rule-enforcement.md). Run `scripts/ocv-tools.mjs rules --write` to refresh every guide; `rules --check` checks them all.

<!-- rules:begin -->

| rule                   | what makes it fail                                | fix                                                                             | at     | holds against main |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- | ------ | ------------------ |
| STALE_CHECK (4)        | The saved work changed during push.               | Fix the cause, then run scripts/ocv-tools.mjs finish again.                     | finish | no                 |
| BAD_BODY (4)           | The PR body is missing required content.          | Fix the cause, then run scripts/ocv-tools.mjs finish again.                     | finish | no                 |
| BAD_TITLE (4)          | The PR title does not match the branch and issue. | Fix the cause, then run scripts/ocv-tools.mjs finish again.                     | finish | no                 |
| NO_COMMITS (4)         | There are no commits beyond origin/main.          | Fix the cause, then run scripts/ocv-tools.mjs finish again.                     | finish | no                 |
| DRAFT (6)              | A draft PR cannot merge.                          | Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>. | pr     | yes                |
| NEEDS_HUMAN_REVIEW (6) | An agent never merges a PR needing human review.  | Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>. | pr     | yes                |
| BAD_BRANCH (6)         | The PR branch must name its issue.                | Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>. | pr     | yes                |
| CLOSED_PR (6)          | The PR must be open or already merged.            | Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>. | pr     | yes                |
| CI_REQUIRED (6)        | The newest ci check must succeed on the PR head.  | Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>. | pr     | yes                |
| LEFT_QUEUE (6)         | The PR must stay in the queue until it merges.    | Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>. | pr     | yes                |
| QUEUE_TIMEOUT (6)      | The queue must merge the PR within 45 minutes.    | Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>. | pr     | yes                |
| HEAD_MOVED (6)         | The PR head must stay the commit ci passed.       | Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>. | pr     | yes                |
| CI_FAILED (6)          | The newest ci check on the PR head must succeed.  | Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>. | pr     | yes                |

<!-- rules:end -->
