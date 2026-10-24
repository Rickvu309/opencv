## Appendix B. Alternatives rejected

- Renaming the Postgres schema `openpath_app` to `opencv_app`. Rejected. Production holds 26 legacy tables in that schema, drizzle-kit would diff a rename as drop plus create, and users see no difference. The name stays as an internal id with a comment at `apps/api/src/db/schema.ts:23`.
- Keeping the web on Vercel and only pointing `opencv.me` at it. Rejected because the operator asked to consolidate on Railway behind the Cloudflare zone. The cost is losing per-branch preview URLs. The `staging` environment stands in for previews.
- Cloudflare Pages for the web. Not chosen for the same reason. It stays the cheapest fallback if Railway static hosting disappoints (one zone, free previews).
- Keeping Storybook, locally or at `ui.opencv.me`. Removed outright on the operator's call (PR-18). The kit stays as source in `packages/ui`, and the ADR-0010 vocabulary test carries the governance that the Storybook build used to host.
- A separate marketing site (Astro or Next) for the landing page. Rejected. One SPA route, lazy-loaded, reuses the kit tokens and one deploy. A separate site earns its place only when the landing needs server rendering for SEO beyond what a static index with meta tags gives.
- A dark Linear-style landing. Rejected by the operator on 2026-10-23 in favor of light, so the landing matches the app shell and the kit needs no dark-mode work.
- Setting a custom Better Auth `cookiePrefix` during the rename. Rejected. It would log every user out for no benefit. Cookies already use the `better-auth` prefix independent of `appName`.
- A TLA+ model for the formal verification target. Rejected for this first target. The Apply scan URL guard is pure code with two proven bugs, so property tests on the real functions are true to the code and able to fail today. The Coach daily turn cap race (`apps/api/src/coach/usage.ts`) is the suggested second target and would suit TLA+.
- Renovate instead of Dependabot. Rejected. Dependabot needs no extra service.
