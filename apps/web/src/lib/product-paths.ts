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
  help: "/help",
} as const

export type SurfaceId = keyof typeof SURFACE_PATHS

export type SurfaceNavGroup = "primary" | "work"

export type Surface = {
  id: SurfaceId
  path: string
  label: string
  shown: boolean
  nav?: SurfaceNavGroup
}

export const SURFACES: readonly Surface[] = [
  { id: "coach", path: "/coach", label: "Coach", shown: true, nav: "primary" },
  { id: "paper", path: "/paper", label: "Paper", shown: true, nav: "work" },
  { id: "apply", path: "/apply", label: "Apply", shown: true, nav: "work" },
  { id: "settings", path: "/settings", label: "Settings", shown: true },
  { id: "help", path: "/help", label: "Help", shown: true },
  { id: "pitch", path: "/pitch", label: "Pitch", shown: false, nav: "work" },
  { id: "jobs", path: "/jobs", label: "Jobs", shown: false, nav: "primary" },
  { id: "proofs", path: "/proofs", label: "Proofs", shown: false },
  { id: "inbox", path: "/inbox", label: "Inbox", shown: false, nav: "primary" },
]

export function isSurfaceShown(surfaceId: SurfaceId): boolean {
  const surface = SURFACES.find((item) => item.id === surfaceId)
  return surface?.shown ?? false
}

export function isPathShown(pathname: string): boolean {
  const surface = SURFACES.find(
    (item) => item.path === pathname || pathname.startsWith(`${item.path}/`)
  )
  return surface ? surface.shown : true
}

export function shownSurfaces(): readonly Surface[] {
  return SURFACES.filter((surface) => surface.shown)
}

const START_PAGE_KEYS = ["apply", "coach", "paper", "inbox"] as const

export const START_PAGES = Object.fromEntries(
  SURFACES.filter(
    (s) => s.shown && (START_PAGE_KEYS as readonly string[]).includes(s.id)
  ).map((s) => [s.id, { path: s.path, label: s.label }])
) as Record<StartPage, { path: string; label: string }>

export function startPageEntry(startPage: unknown) {
  const fallback = START_PAGES.apply ?? { path: "/apply", label: "Apply" }
  const known =
    typeof startPage === "string" && Object.hasOwn(START_PAGES, startPage)
  return known ? (START_PAGES[startPage as StartPage] ?? fallback) : fallback
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
