const PRODUCT_PATHS = [
  "/sign-in",
  "/sign-in/",
  "/sign-up",
  "/sign-up/",
  "/app",
  "/app/*",
]
const PUBLIC_PATHS = [
  "/pricing",
  "/pricing/",
  "/about",
  "/about/",
  "/help",
  "/help/",
  "/share",
  "/share/*",
  "/u",
  "/u/*",
]

export type WebOrigins =
  | { kind: "single" }
  | {
      kind: "split"
      publicOrigin: string
      appOrigin: string
      publicHosts: string[]
      appHost: string
    }

function parseOrigin(value: string, name: string) {
  const url = new URL(value)
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !/^[a-z0-9.\-\[\]:]+$/i.test(url.hostname)
  ) {
    throw new Error(`${name} must be an HTTP(S) origin without a path`)
  }
  return url
}

export function resolveWebOrigins(input: {
  publicOrigin?: string
  appOrigin?: string
}): WebOrigins {
  const publicValue = input.publicOrigin?.trim() ?? ""
  const appValue = input.appOrigin?.trim() ?? ""
  if (!publicValue && !appValue) return { kind: "single" }
  if (!publicValue || !appValue) {
    throw new Error(
      "Set both VITE_PUBLIC_ORIGIN and VITE_APP_ORIGIN, or neither"
    )
  }
  const site = parseOrigin(publicValue, "VITE_PUBLIC_ORIGIN")
  const app = parseOrigin(appValue, "VITE_APP_ORIGIN")
  if (site.hostname === app.hostname) {
    throw new Error("Public and app origins must use different hostnames")
  }
  const publicHosts = [site.hostname]
  if (
    /^[a-z][a-z0-9-]*\.[a-z]{2,}$/i.test(site.hostname) &&
    !site.hostname.endsWith(".localhost")
  ) {
    publicHosts.push(`www.${site.hostname}`)
  }
  if (publicHosts.includes(app.hostname)) {
    throw new Error("The app hostname cannot be a public hostname alias")
  }
  return {
    kind: "split",
    publicOrigin: site.origin,
    appOrigin: app.origin,
    publicHosts,
    appHost: app.hostname,
  }
}

function matchesPath(path: string, patterns: string[]) {
  return patterns.some((pattern) =>
    pattern.endsWith("/*")
      ? path.startsWith(pattern.slice(0, -1))
      : path === pattern
  )
}

export function documentTarget(
  current: URL,
  origins: WebOrigins
): string | null {
  if (origins.kind === "single") return null
  const suffix = `${current.pathname}${current.search}${current.hash}`
  if (origins.publicHosts.includes(current.hostname)) {
    return matchesPath(current.pathname, PRODUCT_PATHS)
      ? `${origins.appOrigin}${suffix}`
      : null
  }
  if (current.hostname !== origins.appHost) return null
  if (current.pathname === "/") {
    return `${origins.appOrigin}/app${current.search}${current.hash}`
  }
  return matchesPath(current.pathname, PUBLIC_PATHS)
    ? `${origins.publicOrigin}${suffix}`
    : null
}

export function shareUrl(
  token: string,
  currentOrigin: string,
  origins: WebOrigins
) {
  const origin = origins.kind === "split" ? origins.publicOrigin : currentOrigin
  return `${origin}/share/${encodeURIComponent(token)}`
}

export function caddyRedirects(origins: WebOrigins): string {
  if (origins.kind === "single") return "# Single-host routing.\n"
  const block = (name: string, match: string[], target: string) => `
@${name} {
  ${match.join("\n  ")}
}
handle @${name} {
  header Cache-Control "no-store"
  redir ${target} 307
}
`
  return [
    block(
      "app_root_query",
      [
        `host ${origins.appHost}`,
        "path /",
        'expression `{http.request.uri.query} != ""`',
      ],
      `${origins.appOrigin}/app?{http.request.uri.query}`
    ),
    block(
      "app_root",
      [`host ${origins.appHost}`, "path /"],
      `${origins.appOrigin}/app`
    ),
    block(
      "public_product",
      [
        `host ${origins.publicHosts.join(" ")}`,
        `path ${PRODUCT_PATHS.join(" ")}`,
      ],
      `${origins.appOrigin}{uri}`
    ),
    block(
      "app_public",
      [`host ${origins.appHost}`, `path ${PUBLIC_PATHS.join(" ")}`],
      `${origins.publicOrigin}{uri}`
    ),
  ].join("")
}
