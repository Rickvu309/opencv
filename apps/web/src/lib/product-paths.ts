export const SURFACE_PATHS = {
  coach: "/coach",
  jobs: "/jobs",
  inbox: "/inbox",
  proofs: "/proofs",
  paper: "/paper",
  apply: "/apply",
  pitch: "/pitch",
  settings: "/settings",
} as const

export const HOME_PATH = "/home"

export const START_PAGES = {
  apply: "/apply",
  paper: "/paper",
  inbox: "/inbox",
  coach: "/coach",
} as const

/** True only for the path segment `app`, never for `/apply` or `/application`. */
export function legacyPathname(pathname: string): string | undefined {
  if (pathname === "/app" || pathname === "/app/") return "/"
  if (pathname.startsWith("/app/")) return pathname.slice("/app".length).replace(/^\/+/, "/")
  return undefined
}

/** Keeps `?` query and `#` hash. Returns undefined when the path is not legacy. */
export function legacyAppPath(path: string): string | undefined {
  const hashAt = path.indexOf("#")
  const hash = hashAt === -1 ? "" : path.slice(hashAt)
  const beforeHash = hashAt === -1 ? path : path.slice(0, hashAt)
  const queryAt = beforeHash.indexOf("?")
  const pathname = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt)
  const search = queryAt === -1 ? "" : beforeHash.slice(queryAt)
  const next = legacyPathname(pathname)
  if (next === undefined) return undefined
  return `${next}${search}${hash}`
}
