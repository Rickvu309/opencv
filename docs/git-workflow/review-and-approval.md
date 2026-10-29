# Review and approval

A pull request merges when the automatic `ci` check is green.

**Owner-only merge.** The `main` ruleset requires a PR, the `ci` check and squash merge, with no approving review (one account runs everything), no code-owner review, no thread rule and no bypass actor. `CODEOWNERS` still names `@quanvu309`. GitHub does not block a Write collaborator's merge: the repo relies on being single-collaborator, and adding a collaborator needs the approval rule back first. An agent under the owner's account merges its own PR with `scripts/merge-pr.sh <pr#>` from the main checkout. It refuses another author's PR, a draft, a PR labeled `needs-human-review`, a `ci` check that is not success on the head, a deleted `.github/workflows/ci.yml`, and a change to `ci.yml`, `.github/actions/**`, `scripts/check.sh` or `.github/rulesets/main.json` whose issue is not labeled `risk:high`. It never uses `--admin`. Direct pushes to `main` stay blocked. Apply `.github/rulesets/main.json` after editing it (the file only takes effect once applied):

```bash
gh api -X PUT repos/Rickvu309/opencv/rulesets/25725442 --input .github/rulesets/main.json
```

Write access cannot be made merge-proof by role alone, and contributors can still edit labels, so the `needs-human-review` rule below stays a convention.

The `ci` check runs parallel affected guards, lint, typecheck, build, API tests and two web test shards on GitHub-hosted runners; aggregate `ci` requires every job to succeed. Local hooks catch mistakes early. Anyone can bypass the hooks (`git push --no-verify`). Tests follow build; guards always run. Skipped and cancelled jobs fail the aggregate. Full checks and browser verification remain manual.

**Human review only for a big decision.** Add the `needs-human-review` label. `scripts/merge-pr.sh` then refuses the PR. A mass deletion is not detected anymore; add the label yourself when a PR deletes much of the code base.

| PR                                     | Who merges                                       |
| -------------------------------------- | ------------------------------------------------ |
| Any routine change, once `ci` is green | `@quanvu309`'s agent, with `scripts/merge-pr.sh` |
| Has the `needs-human-review` label     | A human. An agent never merges it                |

## How an agent merges

1. Open the PR with `scripts/open-pr.sh`. A draft stays a draft until `gh pr ready <pr#>`.
2. Wait until the `ci` check on the PR head is success.
3. From the main checkout, `scripts/merge-pr.sh <pr#>`.

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
