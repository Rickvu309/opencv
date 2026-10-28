import { HOME_PATH, SURFACE_PATHS, legacyAppPath } from "./product-paths.ts"

const PRODUCT_ROOTS = [
  "/sign-in",
  "/sign-up",
  HOME_PATH,
  ...Object.values(SURFACE_PATHS),
  "/proof",
]
const PRODUCT_PREFIXES = (["paper", "apply", "settings"] as const).map(
  (id) => `${SURFACE_PATHS[id]}/`
)
const PUBLIC_PATHS = [
  "/pricing",
  "/pricing/",
  "/about",
  "/about/",
  "/help",
  "/help/",
  "/stories",
  "/stories/",
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
    !/^[a-z0-9.\-[\]:]+$/i.test(url.hostname)
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

function canonicalPathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1)
  }
  return pathname
}

function isProductPath(pathname: string) {
  const path = canonicalPathname(pathname)
  return (
    PRODUCT_ROOTS.includes(path) ||
    PRODUCT_PREFIXES.some((prefix) => path.startsWith(prefix))
  )
}

export function documentTarget(
  current: URL,
  origins: WebOrigins
): string | null {
  if (origins.kind === "single") return null
  const suffix = `${current.pathname}${current.search}${current.hash}`
  if (origins.publicHosts.includes(current.hostname)) {
    const stripped = legacyAppPath(suffix)
    if (stripped !== undefined) return `${origins.appOrigin}${stripped}`
    return isProductPath(current.pathname)
      ? `${origins.appOrigin}${suffix}`
      : null
  }
  if (current.hostname !== origins.appHost) return null
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

function block(name: string, match: string[], target: string) {
  return `
@${name} {
  ${match.join("\n  ")}
}
handle @${name} {
  header Cache-Control "no-store"
  redir ${target} 307
}
`
}

function productCaddyPaths() {
  const exact = PRODUCT_ROOTS.flatMap((path) => [path, `${path}/`])
  const wild = PRODUCT_PREFIXES.map((prefix) => `${prefix}*`)
  return [...exact, ...wild].join(" ")
}

function legacyBlocks(name: string, host: string, origin: string) {
  return [
    block(
      `${name}_legacy_root_query`,
      [
        `host ${host}`,
        "path /app /app/",
        'expression `{http.request.uri.query} != ""`',
      ],
      `${origin}/?{http.request.uri.query}`
    ),
    block(
      `${name}_legacy_root`,
      [`host ${host}`, "path /app /app/"],
      `${origin}/`
    ),
    block(
      `${name}_legacy`,
      [
        `host ${host}`,
        `path_regexp ${name}_legacy ^/app(/.*)$`,
        'expression `{http.request.uri.query} != ""`',
      ],
      `${origin}{re.${name}_legacy.1}?{http.request.uri.query}`
    ),
    block(
      `${name}_legacy_plain`,
      [`host ${host}`, `path_regexp ${name}_legacy_plain ^/app(/.*)$`],
      `${origin}{re.${name}_legacy_plain.1}`
    ),
  ].join("")
}

export function caddyRedirects(origins: WebOrigins): string {
  if (origins.kind === "single") return ""
  return [
    legacyBlocks("public", origins.publicHosts.join(" "), origins.appOrigin),
    legacyBlocks("app", origins.appHost, origins.appOrigin),
    block(
      "public_product",
      [`host ${origins.publicHosts.join(" ")}`, `path ${productCaddyPaths()}`],
      `${origins.appOrigin}{uri}`
    ),
    block(
      "app_public",
      [`host ${origins.appHost}`, `path ${PUBLIC_PATHS.join(" ")}`],
      `${origins.publicOrigin}{uri}`
    ),
  ].join("")
}
