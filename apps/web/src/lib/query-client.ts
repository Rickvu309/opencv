import { QueryClient } from "@tanstack/react-query"

import { profileKey } from "@/lib/account-api.ts"

export const PROFILE_FRESH_MS = 60_000

export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })
  client.setQueryDefaults(profileKey(), { staleTime: PROFILE_FRESH_MS })
  return client
}
