import { useContext } from "react"

import { ThreadStoreContext } from "@/features/home/thread-store-context.ts"

export function useThreadStore() {
  const value = useContext(ThreadStoreContext)
  if (!value) {
    throw new Error("useThreadStore must be used within ThreadStoreProvider")
  }
  return value
}
