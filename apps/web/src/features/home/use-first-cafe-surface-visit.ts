import { useEffect } from "react"

import {
  recordFirstCafeItem,
  type FirstCafeItemId,
} from "@/features/home/first-cafe-checklist.ts"
import { authClient } from "@/lib/auth-client.ts"

/**
 * Records a checklist item only when that surface's route page is mounted.
 * Router-store / history flashes of sibling paths must not count.
 */
export function useFirstCafeSurfaceVisit(id: FirstCafeItemId | null) {
  const { data } = authClient.useSession()
  const userId = data?.user.id

  useEffect(() => {
    if (!userId || !id) return
    recordFirstCafeItem(userId, id)
  }, [userId, id])
}
