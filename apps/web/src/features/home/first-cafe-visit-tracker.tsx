import { useEffect } from "react"
import { useRouterState } from "@tanstack/react-router"

import {
  firstCafeVisitToRecord,
  recordFirstCafeVisit,
} from "@/features/home/first-cafe-checklist.ts"
import { authClient } from "@/lib/auth-client.ts"

export function FirstCafeVisitTracker() {
  const { data } = authClient.useSession()
  const userId = data?.user.id
  const status = useRouterState({
    select: (state) => state.status,
  })
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const resolvedPathname = useRouterState({
    select: (state) => state.resolvedLocation?.pathname,
  })
  const resolvedTab = useRouterState({
    select: (state) =>
      (state.resolvedLocation?.search as { tab?: unknown } | undefined)?.tab,
  })

  useEffect(() => {
    const visit = firstCafeVisitToRecord({
      userId,
      status,
      pathname,
      resolvedPathname,
      resolvedSearch: resolvedTab === "apps" ? { tab: "apps" } : {},
    })
    if (!userId || !visit) return
    recordFirstCafeVisit(userId, visit.pathname, visit.search)
  }, [userId, status, pathname, resolvedPathname, resolvedTab])

  return null
}
