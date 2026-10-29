# Check that a merge reached production

Merging deploys straight to production, so confirm it after every merge. Fetch
`main`, then run, with the merge commit:

```bash
node scripts/pr.mjs release <merge sha>
node scripts/pr.mjs release <merge sha> --wait 600
node scripts/pr.mjs release <merge sha> --json
```

`--wait 600` rereads every few seconds (5 s, slowing to 30 s) for up to 600
seconds, so run it once in the background and be woken when it exits. The
command needs `gh` and the commit in the local git history. It prints one line
per service (`api`, `web`), a `RELEASE` line, and last `RESULT_JSON: <path>`,
the result file in the same schema as the other workflow scripts.

It reads the commit statuses Railway posts on the merge commit
(`opencv - api`, `opencv - web`). It decides from `scripts/pr/services.mjs`
which services the commit had to rebuild, then checks the sha each one serves:
`api` `/health` and `web` `/version.txt`. For a rebuilt `api` it also reads
`/health/deep`.

| Outcome           | Meaning                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LIVE`            | A rebuilt service serves this commit (or a later one that contains it) and, for `api`, `/health/deep` is 200. A service the commit did not touch is `LIVE` once Railway says no deployment was needed. |
| `PENDING`         | Railway has not posted a final status, or its build has not reached the public sha yet.                                                                                                                |
| `BROKEN`          | Railway posted a failure, or `/health/deep` is not 200 on the new `api`. Production still serves the old build.                                                                                        |
| `RELEASE_BLOCKED` | The commit changed files the service watches but Railway skipped it, or the build succeeded and production still serves another sha when the wait ends.                                                |

The overall outcome is the worst of the services. Exit codes: 0 `LIVE`, 3
`PENDING` (run the `next` command later), 1 `BROKEN`, `RELEASE_BLOCKED` or a
check that could not run.

A `PENDING` that outlasts `--wait 600` means Railway never started or never
finished the deploy. Check the Railway dashboard before merging again.

The watch paths live in `.railway/railway.ts` and are copied into
`scripts/pr/services.mjs`. `scripts/pr/services.test.mjs` fails if they drift.
