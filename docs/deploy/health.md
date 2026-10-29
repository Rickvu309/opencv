# Health and version

`api` `GET /health` is only liveness (Railway's healthcheck): always 200,
`{ok, sha}` with `sha` from `RAILWAY_GIT_COMMIT_SHA` (`null` when unset). It
checks nothing else, so a database blip never fails a deploy.

`api` `GET /health/deep` is for people and monitors: `{ok, sha, db, mail,
schemaVersion}`, 503 unless `db` and `mail` are both true. `db` is one query
with a 2 s bound. `mail` is true when `RESEND_API_KEY` and `AUTH_EMAIL_FROM`
are set. `schemaVersion` is the latest applied migration. It returns booleans
and names, never values.

`web` `GET /version.txt` holds the commit the image was built from (`unknown`
when Railway passes none), with `Cache-Control: no-store`. The Dockerfile
declares `ARG RAILWAY_GIT_COMMIT_SHA` because Railway hands build-time
variables only to declared ARGs.

A service deploys only when its watch paths change, so each `sha` is the last
commit that deployed that service, not the newest merge.
