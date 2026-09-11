import { useEffect } from "react"

import {
  isFirstCafeVisitItem,
  recordFirstCafeItem,
  type FirstCafeItemId,
} from "@/features/home/first-cafe-checklist.ts"
import { authClient } from "@/lib/auth-client.ts"

/**
 * Records a visit-completable checklist item only when that surface's
 * route page is mounted. Router-store / history flashes of sibling
 * paths must not count. Pitch and Apply are ignored here — those need
 * a real edit / triage, not a peek (QVE-252).
 */
export function useFirstCafeSurfaceVisit(id: FirstCafeItemId | null) {
  const { data } = authClient.useSession()
  const userId = data?.user.id

  useEffect(() => {
    if (!userId || !id || !isFirstCafeVisitItem(id)) return
    recordFirstCafeItem(userId, id)
  }, [userId, id])
}
