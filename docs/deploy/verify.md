# Check that a merge reached production

Merging deploys straight to production, so confirm it after every merge. Fetch
`main`, then run, with the full merge commit SHA:

```bash
node scripts/verify-deploy.mjs --commit <full merge sha>
node scripts/verify-deploy.mjs --commit <full merge sha> --wait 600
```

`--wait 600` rechecks every 15 seconds for up to 600 seconds, so you can run it
once in the background and be woken when it exits. The command needs an
authenticated `railway` CLI and the commit in the local git history. It prints
one line per service (`api`, `web`) and a final `RESULT` line.

| Outcome        | Meaning                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `DEPLOYED`     | Production runs this commit, or a later one that contains it, and `/health` answers 200.        |
| `DEPLOYING`    | Railway has not started this commit yet, or its deployment is queued, building or deploying.    |
| `FAILED`       | The deployment failed or crashed, `/health` is not 200, or production runs an unrelated commit. |
| `NOT_EXPECTED` | The commit changes no file under the service's watch paths, so Railway does not redeploy it.    |

Exit codes:

- 0: every service is `DEPLOYED` or `NOT_EXPECTED`.
- 3: a service is still `DEPLOYING` and none failed. Run the printed rerun
  command later.
- 1: a service `FAILED`, or the check could not run.

A `DEPLOYING` that outlasts `--wait 600` means Railway never started or never
finished the deploy. Check the Railway dashboard before merging again.

The watch paths live in `.railway/railway.ts` and are copied into
`scripts/verify-deploy.mjs`. `scripts/verify-deploy.test.mjs` fails if they
drift.
