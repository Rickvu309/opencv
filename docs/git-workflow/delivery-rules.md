# Check, finish and merge rules

These refusals belong to the delivery jobs. The table comes from the same rule table as [workflow rules](rule-enforcement.md). Run `scripts/ocv-tools.mjs rules --write` to refresh both guides; `rules --check` checks both.

<!-- rules:begin -->

| rule                   | what makes it fail                                        | fix                                                                      | jobs          |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| STALE_CHECK (4)        | The saved work changed during check or push.              | Run scripts/ocv-tools.mjs check before finish; wait for ci before merge. | check, finish |
| BAD_BODY (4)           | The PR body is missing required content.                  | Run scripts/ocv-tools.mjs check before finish; wait for ci before merge. | finish        |
| BAD_TITLE (4)          | The PR title does not match the branch and issue.         | Run scripts/ocv-tools.mjs check before finish; wait for ci before merge. | finish        |
| NO_COMMITS (4)         | There are no commits beyond origin/main.                  | Run scripts/ocv-tools.mjs check before finish; wait for ci before merge. | finish        |
| CHECK_REQUIRED (4)     | A passing check for this saved tree and base is required. | Run scripts/ocv-tools.mjs check before finish; wait for ci before merge. | finish        |
| DRAFT (6)              | A draft PR cannot merge.                                  | Run scripts/ocv-tools.mjs check before finish; wait for ci before merge. | merge         |
| NEEDS_HUMAN_REVIEW (6) | An agent never merges a PR needing human review.          | Run scripts/ocv-tools.mjs check before finish; wait for ci before merge. | merge         |
| BAD_BRANCH (6)         | The PR branch must name its issue.                        | Run scripts/ocv-tools.mjs check before finish; wait for ci before merge. | merge         |
| CLOSED_PR (6)          | The PR must be open or already merged.                    | Run scripts/ocv-tools.mjs check before finish; wait for ci before merge. | merge         |
| CI_REQUIRED (6)        | The newest ci check must succeed on the PR head.          | Run scripts/ocv-tools.mjs check before finish; wait for ci before merge. | merge         |

<!-- rules:end -->
