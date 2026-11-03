import type { StartPage } from "@workspace/domain"

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

export type SurfaceId = keyof typeof SURFACE_PATHS

export const START_PAGES = {
  apply: { path: "/apply", label: "Apply" },
  coach: { path: "/coach", label: "Coach" },
  paper: { path: "/paper", label: "Paper" },
  inbox: { path: "/inbox", label: "Inbox" },
} as const satisfies Record<StartPage, { path: string; label: string }>

export function startPageEntry(startPage: unknown) {
  const known =
    typeof startPage === "string" && Object.hasOwn(START_PAGES, startPage)
  return START_PAGES[known ? (startPage as StartPage) : "apply"]
}

export function startPagePath(startPage: unknown) {
  return startPageEntry(startPage).path
}

export function legacyPathname(pathname: string): string | undefined {
  if (pathname === "/app" || pathname === "/app/") return "/"
  if (pathname.startsWith("/app/"))
    return pathname.slice("/app".length).replace(/^\/+/, "/")
  return undefined
}

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
