# Rule moments

A moment is a point in a verb where every fact its rule rows need is known. The runner for the moment gathers those facts and calls `decide(moment, facts)`. This table is generated from `MOMENTS` and `RUNNERS` in `scripts/ocv-tools/rules/index.mjs`; the rules that run at each moment are in [workflow rules](rule-enforcement.md), [delivery rules](delivery-rules.md) and [hook rules](hook-rules.md). Run `scripts/ocv-tools.mjs rules --write` to refresh it.

<!-- rules:begin -->

| moment        | means                                                                                                     | runner                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| commit        | The pre-commit hook, before git records the commit.                                                       | scripts/ocv-tools/jobs/hook.mjs                                     |
| push          | The pre-push hook, before git sends the branch.                                                           | scripts/ocv-tools/jobs/hook.mjs                                     |
| cli           | Any verb, once its words and flags are parsed.                                                            | scripts/ocv-tools/input.mjs                                         |
| file          | Filing an issue, once its body is read.                                                                   | scripts/ocv-tools/issue.mjs                                         |
| locate        | Any verb, once it has found the repository it runs in.                                                    | scripts/ocv-tools/worktree.mjs                                      |
| issue-load    | Any verb that names an issue, once the issue is read.                                                     | scripts/ocv-tools/facts.mjs                                         |
| history       | Reading a branch's past pull requests from GitHub.                                                        | scripts/ocv-tools/ports/gh.mjs                                      |
| take-title    | Taking a new title, before the issue exists; only the disk is known, so a full disk makes no GitHub call. | scripts/ocv-tools/take.mjs                                          |
| take          | Taking an issue, once the issue, its claim and the disk are read, before anything changes.                | scripts/ocv-tools/take.mjs                                          |
| take-branch   | Taking an issue, once the local and remote branch are compared.                                           | scripts/ocv-tools/worktree.mjs                                      |
| take-raced    | Taking an issue, after the claim is written and read back, to catch a second taker.                       | scripts/ocv-tools/take.mjs                                          |
| save          | Saving work in a task worktree.                                                                           | scripts/ocv-tools/work.mjs                                          |
| release       | Giving back a claim on an issue.                                                                          | scripts/ocv-tools/claim.mjs                                         |
| cleanup       | Removing a task worktree and its branch after the merge.                                                  | scripts/ocv-tools/work.mjs                                          |
| status        | Reporting a task's state.                                                                                 | scripts/ocv-tools/report.mjs                                        |
| approve       | Recording the owner's approval for a high-risk issue.                                                     | scripts/ocv-tools/approve.mjs                                       |
| shot          | Attaching pictures as evidence, once the files are read.                                                  | scripts/ocv-tools/shot.mjs                                          |
| shot-target   | Attaching pictures, once the issue or pull request they go to is read.                                    | scripts/ocv-tools/shot.mjs                                          |
| finish        | Opening the pull request, before the push.                                                                | scripts/ocv-tools/jobs/finish.mjs                                   |
| finish-pushed | Opening the pull request, after the push.                                                                 | scripts/ocv-tools/jobs/finish.mjs                                   |
| body          | Replacing a pull request body, once the new text is read.                                                 | scripts/ocv-tools/jobs/body.mjs                                     |
| pr            | The live pull request, read by the policy check in ci and by the merge verb.                              | scripts/ocv-tools/jobs/policy.mjs, scripts/ocv-tools/jobs/merge.mjs |
| merge         | The merge verb, before it enqueues the pull request.                                                      | scripts/ocv-tools/jobs/merge.mjs                                    |
| merge-result  | The merge verb, once it knows whether the branch merges with main and the merged tree passes.             | scripts/ocv-tools/jobs/merge.mjs                                    |
| queue         | The merge verb, while it waits on the merge queue.                                                        | scripts/ocv-tools/jobs/merge.mjs                                    |

<!-- rules:end -->
