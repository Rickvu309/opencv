import {
  queryOptions,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"

type ListRead = {
  queryKey: QueryKey
  queryFn: () => Promise<readonly { id: string }[]>
}

export const paperListRecheckKey = (docId: string) =>
  ["paper-list-recheck", docId] as const

export function paperListRecheck(
  queryClient: QueryClient,
  list: ListRead,
  docId: string
) {
  return queryOptions({
    queryKey: paperListRecheckKey(docId),
    queryFn: async () => {
      const fresh = await queryClient.fetchQuery({
        queryKey: list.queryKey,
        queryFn: list.queryFn,
        staleTime: 0,
      })
      return { listed: fresh.some((item) => item.id === docId) }
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

export function retryPaperDocReads(
  queryClient: QueryClient,
  keys: readonly QueryKey[]
) {
  return Promise.all(
    keys.map((queryKey) => queryClient.resetQueries({ queryKey }))
  )
}
