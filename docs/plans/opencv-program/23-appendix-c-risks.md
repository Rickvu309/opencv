## Appendix C. Risks

- Rulesets on a private repo may need a paid GitHub plan (O2b). If so, server-side protection is limited to the pull-request and linear-history rules plus the local hooks and the program's gates lane. Owner watches the `gh api` response and records the gap.
- The repo rename (O1) breaks any Railway or Vercel source link that does not follow GitHub's redirect. Owner watches the next Railway build after O1 and reconnects the source in the dashboard if it fails. The Vercel project `openpath-app` keeps serving the last deployment either way, which is what the overlap needs.
- The `AUTH_URL` flip (O4) logs every user out once. Owner announces it in the trail and schedules it with the operator.
- `railway.json` stops being read on 2026-12-01. PR-3 must land before then or the api service needs a manual config migration first.
- PR-5 changes the SSRF guard. A regression here is a security defect. PR-16's property check is the gate, and PR-5 may not weaken a property to pass.
- PR-13 rewrites the Coach turn state. The streamed-turn lanes (send, abort, regenerate, cap) at trunk and head are the gate. Owner is on `opus`.
- PR-12 and PR-17 move or add UI. Visual comparison lanes at trunk and head gate them. Owner watches CV template parity across all five templates.
- Dependabot opens PRs that each need a gates lane run on every grouped update. Owner keeps the schedule weekly and grouped to limit noise.
- Local verification depends on the PGlite driver from PR-15. Until it merges, lanes write their own PGlite harness under `~/tmp`, which costs time per lane.
