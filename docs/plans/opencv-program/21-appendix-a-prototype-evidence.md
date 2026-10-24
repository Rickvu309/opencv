## Appendix A. Prototype evidence

No prototype ran before this plan. The questions below are empirical and get settled inside the PR that owns them, with the evidence recorded in the trail.

- Does Railway pass service variables as Docker build args so `VITE_API_URL` reaches the Vite build? Unproven. PR-3 settles it on the staging `web` service first (one deploy, read `apps/web/dist/assets/*.js` for the baked URL). Fallback is a runtime `window.__API_URL__` injected by Caddy from an env var.
- Does the Cloudflare proxy in front of `api.opencv.me` buffer the Coach SSE stream? Unproven. O3 adds the api records DNS-only, then PR-3's smoke (`pnpm --filter api smoke` against `https://api-staging.opencv.me`) is rerun once with the proxy on. Proxy stays off if the heartbeat check fails.
- Does `useEffectEvent` in React 19.2 clear the two `exhaustive-deps` warnings without changing autosave timing? Settled inside PR-11 by its unit box and the trunk-vs-head autosave lane.
- Does lazy-loading alone bring the largest chunk under 400 kB, or is a vendor split needed? Settled inside PR-9 by its perf probe, which measures before adding `manualChunks`.
