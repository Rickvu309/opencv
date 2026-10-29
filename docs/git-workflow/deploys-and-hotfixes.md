# Deploys and hotfixes

## Environments

| Environment                                  | Comes from | When                                               |
| -------------------------------------------- | ---------- | -------------------------------------------------- |
| Web production (Railway `production`, `web`) | `main`     | Every merge to `main` that touches its watch paths |
| API production (Railway `production`, `api`) | `main`     | Every merge to `main` that touches its watch paths |

There is one environment: production. There is no staging branch and no staging environment: a merge to `main` deploys straight to production. Hosting is described in `docs/deploy.md`.

## Verifying a change

There are no per-branch preview deploys. Verify locally with the verify-opencv skill (`.claude/skills/verify-opencv`) and attach its evidence.

- Run the `verify-opencv` skill: it starts the web app and the api on PGlite with a scripted Coach, drives the changed flow, and captures proof.
- Attach that evidence to the PR when you have it. Nothing requires it before merge.
- The ruleset requires the `ci` check. `scripts/merge-pr.sh` requires it green on the PR head before enqueueing. The queue runs full `ci` on the merged result before merging.

## Railway setup

The web app and the API run on the Railway project `opencv`. It has one environment, `production`, and services `api`, `web` and `Postgres`; see `docs/deploy.md`.

- `.railway/railway.ts` builds the API with `pnpm --filter api... run build`, runs `pnpm --filter api run migrate` as the pre-deploy command, starts `pnpm --filter api run start`, and health-checks `GET /health`. The `web` service builds `apps/web/Dockerfile` and serves it with Caddy.
- Secrets live in Railway variables, never in git.
- Rolling back production: in Railway, open `api` in `production`, pick the previous successful deployment, and choose Rollback. Roll back `web` the same way.

## Production deploys

- A merge to `main` deploys straight to production (web and API on Railway). Merge only what you are ready to ship.
- After merging, check the production deploy finished and smoke-test the changed flow.
- If a deploy fails, `main` is not deployable: fix it right away with a `fix` or `hotfix` PR, or revert.

## Hotfix flow

When production is broken:

1. **Open an issue.** Use the Bug form and change the label to `hotfix`. Describe the impact.
2. **Decide: roll back first?** If the fix is risky, unclear, or will take more than a few minutes, roll back to the previous production deploy on the hosting platform now. Then fix forward calmly.
3. **Branch** from the latest `main`:
   ```bash
   scripts/ocv-tools.mjs take <issue#> -d "short description"   # type hotfix
   ```
4. **Fix, then open the PR right away** (not as a draft): `scripts/open-pr.sh`. That gives `hotfix: restore checkout button (#88)` with `Closes #88`.
5. **Wait for `ci`.** `SKIP_CHECKS=1` is allowed only if a human declares it, and the PR body says so. A `needs-human-review` label still needs a human: an agent does not merge it. A mass deletion is not detected; add the label yourself.
6. **Enqueue** with `scripts/merge-pr.sh`. Wait for full queue CI and the squash merge before production deploys. If `ci` is red, see "When ci is red" in `review-and-approval.md` (owner only).
7. **Verify** production, then clean up the worktree. If you rolled back in step 2, make sure the new production deploy includes everything that was rolled back plus the fix.

There are no hotfix branches off old versions and no backporting: `main` is the only line of code.

## Reverting a bad merge

The fastest safe undo is a revert PR:

```bash
# open an issue first, e.g. #95 "Revert login page"
scripts/ocv-tools.mjs take 95 -d "revert login page"
cd ../opencv.worktrees/95-revert-login-page
git revert <squash-commit-sha>
scripts/open-pr.sh -d "revert login page"
```

Never fix production by pushing to `main` or force-pushing.

## Releases and version tags

- Every merge to `main` is a release. There are no release branches.
- Tag a version only when you need one: a changelog, a client update, or a public API.
  ```bash
  git fetch origin
  git tag -a v1.2.0 origin/main -m "v1.2.0"
  git push origin v1.2.0
  gh release create v1.2.0 --generate-notes      # optional changelog
  ```
- Use semantic versions `vX.Y.Z`: breaking change (`!`) bumps X, `feat` bumps Y, `fix` bumps Z.
- `release/` branches are only for shipping versioned releases or supporting several versions at once. Agree on that as a team before creating one.
