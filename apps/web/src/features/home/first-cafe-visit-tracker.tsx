import { useEffect } from "react"
import { useRouter, useRouterState } from "@tanstack/react-router"

import {
  firstCafeVisitToRecord,
  recordFirstCafeVisit,
} from "@/features/home/first-cafe-checklist.ts"
import { authClient } from "@/lib/auth-client.ts"

export function FirstCafeVisitTracker() {
  const { data } = authClient.useSession()
  const userId = data?.user.id
  const router = useRouter()
  const status = useRouterState({
    select: (state): "pending" | "idle" => state.status,
  })
  const pathname = useRouterState({
    select: (state): string => state.location.pathname,
  })
  const resolvedPathname = useRouterState({
    select: (state): string | undefined => state.resolvedLocation?.pathname,
  })
  const onAppsTab = useRouterState({
    select: (state): boolean =>
      (state.resolvedLocation?.search as { tab?: string } | undefined)?.tab ===
      "apps",
  })
  const historyPathname = router.history.location.pathname

  useEffect(() => {
    const visit = firstCafeVisitToRecord({
      userId,
      status,
      pathname,
      resolvedPathname,
      historyPathname,
      resolvedSearch: onAppsTab ? { tab: "apps" } : {},
    })
    if (!userId || !visit) return
    recordFirstCafeVisit(userId, visit.pathname, visit.search)
  }, [userId, status, pathname, resolvedPathname, historyPathname, onAppsTab])

  return null
}
