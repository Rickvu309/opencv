import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * Mounts the agent in `agent/` on this app's own origin at `/eve/v1/*`.
 *
 * This is what lets `useEveAgent()` run with no host, no CORS preflight, and no
 * public agent URL shipped to the browser. In dev it boots `eve dev` beside
 * `next dev` and rewrites to it; on Vercel it emits Build Output service routes.
 *
 * To run the agent elsewhere (Railway), point the build at that origin and Next
 * proxies to it instead:
 *
 *   EVE_NEXT_PRODUCTION_ORIGIN=https://<service>.up.railway.app npm run build
 *
 * That origin must serve BOTH `/eve/` and `/.well-known/workflow/`. Forwarding
 * only the first lets a session start and then hang forever, because the
 * workflow callback never finds its way home.
 */
export default withEve(nextConfig);
