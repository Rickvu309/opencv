# Review and approval

A pull request merges when the automatic `ci` check is green.

**Owner-only merge.** The `main` ruleset requires a PR, the `ci` check, merge queue and squash merge, with no approving review (one account runs everything), no code-owner review, no thread rule and no bypass actor. `CODEOWNERS` still names `@quanvu309`. GitHub does not block a Write collaborator's merge: the repo relies on being single-collaborator, and adding a collaborator needs the approval rule back first. An agent under the owner's account merges its own PR with `scripts/ocv-tools.mjs merge <pr#>` from the main checkout. It refuses another author's PR, a draft, a PR labeled `needs-human-review`, a PR that deletes a lot of authored source (more than 25 files, 2000 lines or 10% of authored files, generated files read from the base tree's `.gitattributes`; the fix is the `needs-human-review` label), a PR whose title is not `type: description (#n)`, whose body lacks `Closes #n` or whose issue is closed (all read fresh at merge), a `ci` check that is not success on the head, a deleted or renamed-away `.github/workflows/ci.yml`, and a change to `ci.yml`, `.github/actions/**`, `scripts/check.mjs` or `.github/rulesets/main.json` whose issue is not labeled `risk:high`. It never uses `--admin`. Direct pushes to `main` stay blocked. Apply `.github/rulesets/main.json` after editing it (the file only takes effect once applied):

```bash
gh api -X PUT repos/Rickvu309/opencv/rulesets/25725442 --input .github/rulesets/main.json
```

**Merge queue.** `scripts/ocv-tools.mjs merge` enqueues; the queue tests the merged result and squash-merges, so the ruleset keeps `strict_required_status_checks_policy` false (strict mode would make every queued PR rerun when another lands, for no extra safety). A branch behind `main` needs no rebase for the ruleset; rebase only when it conflicts. After the queue merges, run `node scripts/pr.mjs release <merge sha> --wait 600`, then `scripts/ocv-tools.mjs cleanup <issue#>`, which also closes the issue if the merge left it open. Rollout order for ruleset changes: merge the PR, then apply the file with the `gh api -X PUT` above, then prove an enqueue with a no-op PR.

Write access cannot be made merge-proof by role alone, and contributors can still edit labels, so the `needs-human-review` rule below stays a convention.

The `ci` check runs parallel affected guards, lint, typecheck, build, two API test shards and three web test shards on GitHub-hosted runners; aggregate `ci` requires every job to succeed. Local hooks catch mistakes early. Anyone can bypass the hooks (`git push --no-verify`). Tests run beside build, and Turbo builds what each test needs; guards always run. Skipped and cancelled jobs fail the aggregate. Full checks and browser verification remain manual.

**Human review only for a big decision.** Add the `needs-human-review` label. `scripts/ocv-tools.mjs merge` then refuses the PR. A mass deletion is not detected anymore; add the label yourself when a PR deletes much of the code base.

| PR                                     | Who merges                                               |
| -------------------------------------- | -------------------------------------------------------- |
| Any routine change, once `ci` is green | `@quanvu309`'s agent, with `scripts/ocv-tools.mjs merge` |
| Has the `needs-human-review` label     | A human. An agent never merges it                        |

## How an agent merges

1. Run `scripts/ocv-tools.mjs check`, then open the PR with `scripts/ocv-tools.mjs finish --body-file <file>`. A draft stays a draft until `gh pr ready <pr#>`.
2. Wait until the `ci` check on the PR head is success.
3. From the main checkout, `scripts/ocv-tools.mjs merge <pr#>` enqueues the PR with `--squash --match-head-commit`.
4. Wait for the queue to merge. Its `merge_group` run checks all packages and whole-repo formatting; every job must succeed for `ci` to pass. Run `scripts/ocv-tools.mjs merge <pr#> --wait` as a background command; it exits when the PR merges, closes the linked issue, and fails if the PR leaves the queue or 45 minutes pass. A PR watcher does not wake an agent for a queue merge. Then cleanup can remove the worktree.

Before the queue rule is applied, the same command merges directly. With the queue enabled, GitHub enqueues a green PR without requiring `--auto`. If GitHub refuses because auto-merge is disabled, the owner enables it with `gh api -X PATCH repos/Rickvu309/opencv -F allow_auto_merge=true`. Never use `--admin`.

One account, so GitHub approval is not required and an agent cannot approve its own PR. A PR with `needs-human-review` is never merged by an agent.

Run a verify skill by hand when you want one (`.claude/skills/verify-opencv`, `.claude/skills/verify-app-ui`, `.claude/skills/verify-landing`). Nothing starts them at merge time.

## Env and secrets

`.github/CODEOWNERS` names the owner of env and secrets paths. GitHub does not block a merge of them. Do not commit a real `.env` file.

- `.env*` and `*.env` files anywhere (including `.env.example`)
- `env.*` files and `env/` folders anywhere
- `/config/env*`
- anything named `*secret*`
- `.github/CODEOWNERS` itself

If you change how env or secrets are handled in a file not covered by `CODEOWNERS`, add the path to `CODEOWNERS` in the same PR.

## The `needs-human-review` label

- It marks a big decision: dropping a product, a migration that loses data, changing pricing or the legal entity, or a deletion of much of the code base.
- Anyone can add it: `gh pr edit <n> --add-label needs-human-review`.
- While it is on, an agent must not merge the PR. Only a human removes the label.

## When ci is red

If a hotfix must land while `ci` is red, only the owner acts, in the GitHub UI, never an agent: remove the required `ci` check in Settings > Rules > main (or PUT an edited copy of `.github/rulesets/main.json`), merge, reapply `.github/rulesets/main.json` with `gh api -X PUT repos/Rickvu309/opencv/rulesets/25725442 --input .github/rulesets/main.json`, and confirm with `node scripts/pr.mjs doctor`.
