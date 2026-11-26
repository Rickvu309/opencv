import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type Profile } from "@workspace/domain/account"
import { DEFAULT_COACH_MODE, type CoachMode } from "@workspace/domain/coach"

import { profileKey, profileQuery } from "@/lib/account-api.ts"
import { catalogClient, refreshCatalogReads } from "@/lib/contract-client.ts"
import { useOwnerId } from "@/lib/owner-id.ts"

export function useCoachMode() {
  const queryClient = useQueryClient()
  const ownerId = useOwnerId()
  const query = useQuery(profileQuery(ownerId))
  const mode = query.data?.coachMode ?? DEFAULT_COACH_MODE

  const mutation = useMutation({
    mutationFn: (next: CoachMode) =>
      catalogClient.run(
        queryClient,
        "profile.update",
        { coachMode: next },
        { refresh: false }
      ),
    onMutate: async (next: CoachMode) => {
      await queryClient.cancelQueries({ queryKey: profileKey(ownerId) })
      const previous = queryClient.getQueryData<Profile>(profileKey(ownerId))
      if (previous) {
        queryClient.setQueryData(profileKey(ownerId), {
          ...previous,
          coachMode: next,
        })
      }
      return { previous }
    },
    onError: (_error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileKey(ownerId), context.previous)
      }
    },
    onSettled: () => {
      void refreshCatalogReads(queryClient, [{ ownerId, name: "profile" }])
    },
  })

  return {
    mode,
    plan: query.data?.plan ?? "free",
    enabled: query.data?.agentChat ?? true,
    setMode: (next: CoachMode) => {
      if (next === mode) return
      mutation.mutate(next)
    },
    isPending: query.isPending,
  }
}
