import { useRouter } from "@tanstack/react-router"
import { useSyncExternalStore } from "react"

export function ownerIdFromRouteMatches(
  matches: readonly { context: unknown }[]
) {
  for (const match of matches) {
    if (!match.context || typeof match.context !== "object") continue
    const session = (match.context as { session?: unknown }).session
    if (!session || typeof session !== "object") continue
    const user = (session as { user?: unknown }).user
    if (!user || typeof user !== "object") continue
    const id = (user as { id?: unknown }).id
    if (typeof id === "string" && id) return id
  }
  return ""
}

export function useOwnerId() {
  const router = useMountedRouter()
  return useSyncExternalStore(
    (listener) => router?.subscribe("onResolved", listener) ?? (() => {}),
    () => (router ? ownerIdFromRouteMatches(router.state.matches) : "")
  )
}

function useMountedRouter(): ReturnType<typeof useRouter> | undefined {
  try {
    return useRouter({ warn: false })
  } catch {
    return undefined
  }
}
