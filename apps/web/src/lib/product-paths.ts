import { startPageSchema, type StartPage } from "@workspace/domain"

export type SurfaceNavGroup = "primary" | "work"

export const SURFACES = [
  {
    id: "coach",
    path: "/coach",
    label: "Coach",
    shown: true,
    canBeStartPage: true,
    nav: "primary",
  },
  {
    id: "paper",
    path: "/paper",
    label: "Paper",
    shown: true,
    canBeStartPage: true,
    nav: "work",
  },
  {
    id: "apply",
    path: "/apply",
    label: "Apply",
    shown: true,
    canBeStartPage: true,
    nav: "work",
  },
  {
    id: "settings",
    path: "/settings",
    label: "Settings",
    shown: true,
    canBeStartPage: false,
    nav: null,
  },
  {
    id: "help",
    path: "/help",
    label: "Help",
    shown: true,
    canBeStartPage: false,
    nav: null,
  },
  {
    id: "inbox",
    path: "/inbox",
    label: "Inbox",
    shown: false,
    canBeStartPage: false,
    nav: "primary",
  },
] as const

export type Surface = (typeof SURFACES)[number]
export type SurfaceId = Surface["id"]

export const SURFACE_PATHS = Object.fromEntries(
  SURFACES.map((surface) => [surface.id, surface.path])
) as { readonly [S in Surface as S["id"]]: S["path"] }

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

type StartPageSurface = Extract<Surface, { canBeStartPage: true }>
type StartPageLink = { path: string; label: string }

function isStartPageSurface(surface: Surface): surface is StartPageSurface {
  return surface.canBeStartPage
}

function startPageOf(surface: StartPageSurface): StartPage {
  return surface.id
}

export const START_PAGE_KEYS: readonly StartPage[] =
  SURFACES.filter(isStartPageSurface).map(startPageOf)

export const START_PAGES: Readonly<Partial<Record<StartPage, StartPageLink>>> =
  Object.fromEntries(
    SURFACES.filter(isStartPageSurface)
      .filter((surface) => surface.shown)
      .map((surface) => [
        startPageOf(surface),
        { path: surface.path, label: surface.label },
      ])
  )

const DEFAULT_START_PAGE: StartPageLink = START_PAGES.apply ?? {
  path: "/apply",
  label: "Apply",
}

export function startPageEntry(startPage: unknown): StartPageLink {
  const stored = startPageSchema.safeParse(startPage)
  return (stored.success && START_PAGES[stored.data]) || DEFAULT_START_PAGE
}

export function startPagePath(startPage: unknown) {
  return startPageEntry(startPage).path
}

export const NAV_LABELS = Object.fromEntries(
  SURFACES.map((s) => [s.id, s.label])
) as Record<SurfaceId, string>

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
