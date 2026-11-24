import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  DEFAULT_COACH_MODE,
  type CoachMode,
  type Profile,
} from "@workspace/domain"

import { fetchProfile, profileKey } from "@/lib/account-api.ts"
import { catalogClient, refreshReads } from "@/lib/contract-client.ts"

export function useCoachMode() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: profileKey(),
    queryFn: fetchProfile,
  })
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
      await queryClient.cancelQueries({ queryKey: profileKey() })
      const previous = queryClient.getQueryData<Profile>(profileKey())
      if (previous) {
        queryClient.setQueryData(profileKey(), {
          ...previous,
          coachMode: next,
        })
      }
      return { previous }
    },
    onError: (_error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileKey(), context.previous)
      }
    },
    onSettled: () => {
      void refreshReads(queryClient, [
        { query: "profile.get" },
        { query: "coach.usage" },
      ])
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
