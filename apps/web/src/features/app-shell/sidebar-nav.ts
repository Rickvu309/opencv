import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { SURFACES, SURFACE_PATHS } from "@/lib/product-paths.ts"

export function currentNavPath(pathname: string, targets: readonly string[]) {
  return (
    targets
      .filter(
        (target) => pathname === target || pathname.startsWith(`${target}/`)
      )
      .sort((a, b) => b.length - a.length)[0] ?? null
  )
}

export function navActiveOptions(path: string, current: string | null) {
  return { exact: path !== current, includeSearch: false } as const
}

export function favoriteDocPath(docId: string) {
  return `${SURFACE_PATHS.paper}/${docId}`
}

export function favoriteJobPath(jobId: string) {
  return `${SURFACE_PATHS.apply}/${jobId}`
}

export function shellNavLabel(
  item: { id: string; label: string },
  inboxUnread: number | null
) {
  return item.id === "inbox" && inboxUnread
    ? `${item.label}, ${inboxUnread} ${shellCopy.unread}`
    : item.label
}

export const SHELL_PRIMARY = SURFACES.filter(
  (surface) => surface.shown && surface.nav === "primary"
).map((surface) => ({
  id: surface.id,
  label: surface.label,
  to: surface.path,
}))

export const SHELL_WORK = SURFACES.filter(
  (surface) => surface.shown && surface.nav === "work"
).map((surface) => ({
  id: surface.id,
  label: surface.label,
  to: surface.path,
}))
