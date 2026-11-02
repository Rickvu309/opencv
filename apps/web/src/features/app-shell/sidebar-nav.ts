import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"

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

export const SHELL_PRIMARY = [
  { id: "inbox", label: shellCopy.inbox, to: SURFACE_PATHS.inbox },
  { id: "coach", label: shellCopy.coach, to: SURFACE_PATHS.coach },
  { id: "jobs", label: shellCopy.jobs, to: SURFACE_PATHS.jobs },
] as const

export const SHELL_WORK = [
  { id: "paper", label: shellCopy.paper, to: SURFACE_PATHS.paper },
  { id: "apply", label: shellCopy.apply, to: SURFACE_PATHS.apply },
  { id: "pitch", label: shellCopy.pitch, to: SURFACE_PATHS.pitch },
] as const
