import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

/**
 * Mounts the agent in `agent/` on this app's own origin at `/eve/v1/*`.
 *
 * In `next dev` this boots `eve dev` beside the app. On Vercel it emits Build
 * Output service routes. Neither of those is what production on Railway needs:
 * the Coach is a separate service (`openpath-agent`), and `withEve` would
 * rewrite `/eve/*` to `/_eve_internal/eve/eve/*` on that origin, which is not
 * a path `eve start` serves.
 *
 * So when `EVE_NEXT_PRODUCTION_ORIGIN` is set and the build is not on Vercel,
 * the two prefixes eve actually listens on are proxied as-is. Forwarding only
 * `/eve/` lets a session start and then hang, because the workflow callback
 * never finds its way home.
 */
const productionOrigin = process.env.EVE_NEXT_PRODUCTION_ORIGIN?.trim();
const proxyRemoteAgent = Boolean(productionOrigin) && !process.env.VERCEL;

function withRemoteAgent(config: NextConfig, origin: string): NextConfig {
  const base = new URL(origin).origin;
  const existing = config.rewrites;
  const extra = [
    { source: "/eve/:path*", destination: `${base}/eve/:path*` },
    {
      source: "/.well-known/workflow/:path*",
      destination: `${base}/.well-known/workflow/:path*`,
    },
  ];
  return {
    ...config,
    async rewrites() {
      const resolved = existing
        ? await (typeof existing === "function" ? existing() : existing)
        : undefined;
      if (!resolved) return extra;
      if (Array.isArray(resolved)) return [...extra, ...resolved];
      return {
        ...resolved,
        beforeFiles: [...extra, ...(resolved.beforeFiles ?? [])],
      };
    },
  };
}

export default proxyRemoteAgent
  ? withRemoteAgent(nextConfig, productionOrigin!)
  : withEve(nextConfig);
