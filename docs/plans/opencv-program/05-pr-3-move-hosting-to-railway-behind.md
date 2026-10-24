## Move hosting to Railway behind opencv.me (PR-3)

**Depends on.** PR-2 and PR-18.

**Files.**

- [ ] Create `apps/web/Dockerfile`.
- [ ] Create `apps/web/Caddyfile`.
- [ ] Create `.dockerignore`.
- [ ] Create `.railway/railway.ts`.
- [ ] Create `docs/adr/0012-hosting-on-railway.md`.
- [ ] Edit `docs/deploy.md`.
- [ ] Edit `docs/adr/0001-platform-and-stack.md`.
- [ ] Edit `apps/web/src/test/deploy-config.test.ts`.
- [ ] Edit `.env.example`.
- [ ] Edit `README.md`.
- [ ] Delete `railway.json`.
- [ ] Delete `vercel.json`.
- [ ] Delete `docs/railway.md`.
- [ ] Delete `docs/ops/qve-230-force-prod.md`.

**Build.**

- [ ] In `apps/web/Dockerfile`, write two stages. The first stage is `node:22-slim AS build`, enables pnpm through corepack, copies the repo, declares `ARG VITE_API_URL`, exports it as `ENV VITE_API_URL=$VITE_API_URL`, and runs `pnpm install --frozen-lockfile && pnpm turbo build --filter=web`. The second stage is `caddy:2-alpine`, copies `apps/web/dist` to `/srv` and `apps/web/Caddyfile` to `/etc/caddy/Caddyfile`, and starts `caddy run --config /etc/caddy/Caddyfile --adapter caddyfile`.
- [ ] In `apps/web/Caddyfile`, set the global block `auto_https off`, a site block on `:{$PORT:8080}` with `root * /srv`, `encode gzip`, a `/health` handler that runs `respond "ok" 200`, and `try_files {path} /index.html` before `file_server`. Cache `/assets/*` as immutable and send `index.html` with `no-cache`.
- [ ] In `.dockerignore`, exclude `node_modules`, `**/dist`, `.git`, `.turbo`, `apps/api/.data` and `storybook-static` so the build context stays small.
- [ ] Generate the api half of `.railway/railway.ts` with `railway config migrate --apply --service api`. Choose `--variables unmanaged` so secrets stay in Railway. Keep the translated settings from `railway.json` lines 4 to 21, which are the build command, watch patterns, pre-deploy command `pnpm --filter api run migrate`, start command `pnpm --filter api run start`, healthcheck `/health` with a 120 second timeout, and restart policy `ON_FAILURE` with 10 retries.
- [ ] Extend `.railway/railway.ts` with a `web` service built from `apps/web/Dockerfile`, healthcheck `/health`, and watch paths `apps/web/**`, `packages/ui/**`, `packages/domain/**`, `pnpm-lock.yaml`. Set the web variable `VITE_API_URL` to `https://api.opencv.me` in production and `https://api-staging.opencv.me` in staging. Do not put `AUTH_URL` or `WEB_ORIGINS` in the file, because the cutover order flips them last by hand.
- [ ] Delete `railway.json`, `vercel.json`, `docs/railway.md` and `docs/ops/qve-230-force-prod.md`. Storybook is already gone after PR-18, so no catalog service exists on Railway.
- [ ] Rewrite `docs/deploy.md` as the single Railway deploy doc. It holds the service layout per environment (production `api`, `Postgres`, `web`, staging the same), the build and start settings, the variable table (production `AUTH_URL` `https://api.opencv.me`, `WEB_ORIGINS` `https://opencv.me` plus the Vercel origin during overlap, staging `AUTH_URL` `https://api-staging.opencv.me`, `WEB_ORIGINS` `https://staging.opencv.me,http://localhost:5173`), the domains and DNS table (`@` and `www` to web production, `api` to api production, `staging` to web staging, `api-staging` to api staging, plus the Railway TXT records, Cloudflare SSL mode Full, `api` and `api-staging` DNS-only so Coach SSE is not buffered), the cutover order, and the rollback. Carry over the useful parts of the old `docs/railway.md`, namely the coach variables, the migration pipeline and the legacy schema note.
- [ ] State the cutover order in `docs/deploy.md` as numbered steps. Migrate and cut over the api config before 2026-12-01, add domains and DNS and wait for the certificate, add the new origin to `WEB_ORIGINS` while keeping the old one, deploy web with the new `VITE_API_URL`, flip api `AUTH_URL` last (one forced re-login), keep `*.up.railway.app` and Vercel for one to two weeks, then set the GitHub homepage to `https://opencv.me`.
- [ ] State the rollback in `docs/deploy.md`. Point `AUTH_URL` back to the `*.up.railway.app` host, drop the new origin from `WEB_ORIGINS`, run `railway config migrate undo`, and re-enable the Vercel production deploy.
- [ ] Leave `apps/web/src/lib/api.ts` unchanged, its fallback stays localhost. Leave `apps/api/src/auth.ts` line 27 unchanged, `SameSite=None` stays during the overlap, and say so in the doc and the ADR.
- [ ] Create `docs/adr/0012-hosting-on-railway.md` that supersedes the hosting line of ADR-0001 (line 7). Add a one-line `Superseded in part by ADR-0012` note to `docs/adr/0001-platform-and-stack.md`.
- [ ] In `.env.example`, drop the Vercel wording at lines 2, 6 and 18, set `VITE_API_URL` guidance to the Railway web service, and remove the dead `DB_SCHEMA` line (line 30). In `README.md`, replace the Vercel deployment paragraph (lines 47 to 49) with a pointer to `docs/deploy.md`.
- [ ] In `apps/web/src/test/deploy-config.test.ts`, remove the `vercel.json` describe block. Keep the `.env.example` VITE_ coverage case. Add cases that read `apps/web/Caddyfile` and `apps/web/Dockerfile`.
- [ ] Ops steps run by the root after merge, not in this diff. Create the `web` services and variables, add custom domains, create the Cloudflare DNS records and TXT records, run `railway config migrate cutover`, flip `AUTH_URL`, set the GitHub homepage, rename the Railway project if wanted.

**You see.**

- [ ] `git ls-files railway.json vercel.json docs/railway.md` prints nothing at the head.
- [ ] `railway config plan --file .railway/railway.ts --environment staging` prints a plan that creates the `web` service and changes nothing on `api` other than the config source.
- [ ] After the ops steps, `curl -sI https://opencv.me` returns `HTTP/2 200`.
- [ ] After the ops steps, `curl https://api.opencv.me/health` returns HTTP 200.
- [ ] After the ops steps, sign-in works on `https://opencv.me` and the session cookie is set for `api.opencv.me`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/test/deploy-config.test.ts` loses the `vercel.json` case and gains three cases, red first at trunk and green at head. The `Caddyfile` contains `auto_https off`, `try_files {path} /index.html` and a `/health` handler. The `Dockerfile` declares `ARG VITE_API_URL` and runs `pnpm turbo build --filter=web`. The `.railway/railway.ts` text names the paths `apps/web/**`, `packages/ui/**`, `packages/domain/**` and `pnpm-lock.yaml`. Run `pnpm --filter web test -- deploy-config`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Build the web app and serve it with `pnpm --filter web preview` at trunk and at head, then load `/`, `/sign-in` and a deep link such as `/app`. Save `preview-regression.png` as evidence. Pass when both sides serve the same `index.html` for the three paths with HTTP 200 and the sign-in page renders.
- [ ] Lane 2. Docker is not available on this machine, so the lane runs the Caddy stage's equivalent. Run `pnpm turbo build --filter=web` with `VITE_API_URL=http://localhost:3999`, then `pnpm --filter web preview --port <web port>`. Save `preview-built-with-api-url.png` as evidence. Pass when the built bundle in `apps/web/dist/assets` contains the string `http://localhost:3999` and the app calls that host on sign-in in the network log.
- [ ] Lane 3. Run `command -v caddy`. If present, run `caddy validate --config apps/web/Caddyfile --adapter caddyfile`. If absent, record the gap and grep `apps/web/Caddyfile` for `auto_https off`, `try_files {path} /index.html`, `respond "ok" 200` and `file_server`. Save `caddyfile-validate.png` as evidence. Pass when `caddy validate` prints `Valid configuration`, or the gap is written down and all four directives are found.
- [ ] Lane 4. Read `apps/web/Dockerfile` line by line against a checklist. Save `dockerfile-audit.png` as evidence. Pass when it has exactly two `FROM` lines, `ARG VITE_API_URL` appears before the build `RUN`, the build command equals `pnpm install --frozen-lockfile && pnpm turbo build --filter=web`, and the final stage copies `apps/web/dist` and `apps/web/Caddyfile`.
- [ ] Lane 5. Run `railway config plan --file .railway/railway.ts --environment staging --json` (read-only, applies nothing). Save `railway-plan.png` as evidence. Pass when the command exits 0, the plan lists a `web` service with the four watch paths and `/health`, and the `api` service keeps the pre-deploy command `pnpm --filter api run migrate`.
- [ ] Lane 6. Run `railway config migrate status` and `node --check` on a copy of `.railway/railway.ts` renamed to `.mts` if the installed Node strips types. Save `iac-parse.png` as evidence. Pass when `status` lists `api` and `web` with no parse error, and `node --check` exits 0 or the unsupported-syntax gap is recorded.
- [ ] Lane 7. Render `docs/deploy.md` with a markdown preview in the browser and read the DNS table. Save `deploy-doc-dns.png` as evidence. Pass when the table has rows for `@`, `www`, `api`, `staging`, `api-staging` and the Railway TXT records, each with type, target, proxy mode and service, and `api` and `api-staging` read DNS-only.
- [ ] Lane 8. Read the cutover and rollback sections of `docs/deploy.md` against `/home/quan/tmp/opencv-audit/infra-rename.md` section 3. Save `cutover-order.png` as evidence. Pass when the cutover has five ordered steps with `AUTH_URL` flip fourth, the rollback names `railway config migrate undo`, and the deadline 2026-12-01 appears.
- [ ] Lane 9. Run `git diff --stat main...HEAD` and `git grep -n "vercel" -- . ':!docs/adr' ':!docs/specs' ':!docs/research' ':!pnpm-lock.yaml'`. Save `leftover-vercel.png` as evidence. Pass when the deleted files are exactly the five listed, `apps/api/src/auth.ts` and `apps/web/src/lib/api.ts` are absent from the diff, and every remaining `vercel` hit sits in the overlap and rollback text of `docs/deploy.md`, in a `WEB_ORIGINS` example, or in a code comment about previews.
- [ ] Lane 10. Run `gh pr checks` on the PR and `pnpm turbo run lint typecheck build test`. Save `ci-and-local.png` as evidence. Pass when `gh pr checks` reports no checks and the local run exits 0 with web tests passing, including the updated `deploy-config` cases.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time in seconds of an uncached `pnpm turbo build --filter=web --force` and the total bytes of `apps/web/dist`, at trunk and at head.
- [ ] Probe. In one worktree per side, run `/usr/bin/time -f %e pnpm turbo build --filter=web --force` and `du -sb apps/web/dist`, three times each, interleaved trunk then head. The Caddy and Railway pieces add nothing to this build, so the probe guards the build path the Dockerfile reuses.
- [ ] Baseline. Record the trunk median build time and dist bytes first.
- [ ] Rule. Head median build time within 10 percent of trunk and dist bytes within 1 percent. A larger gap fails.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 7 and lane 8 screenshots into `/home/quan/tmp/opencv-review/PR-3-review-deploy-doc.png` and `/home/quan/tmp/opencv-review/PR-3-review-cutover-order.png`.
- [ ] Record a 30 to 60 second video of the change on a lane worktree. Save it as `/home/quan/tmp/opencv-review/PR-3-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
