import { useEffect } from "react"
import { useRouterState } from "@tanstack/react-router"

import { recordFirstCafeVisit } from "@/features/home/first-cafe-checklist.ts"
import { authClient } from "@/lib/auth-client.ts"

export function FirstCafeVisitTracker() {
  const { data } = authClient.useSession()
  const userId = data?.user.id
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  })

  useEffect(() => {
    if (!userId) return
    recordFirstCafeVisit(userId, pathname, search)
  }, [userId, pathname, search])

  return null
}
