import { QueryClient } from "@tanstack/react-query"

export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })
  return client
}
