import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  DEFAULT_COACH_MODE,
  type CoachMode,
  type Profile,
} from "@workspace/domain"

import { fetchProfile, profileKey, usageKey } from "@/lib/account-api.ts"
import { runContractCommand } from "@/lib/contract-client.ts"

export function useCoachMode() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: profileKey(),
    queryFn: fetchProfile,
  })
  const mode = query.data?.coachMode ?? DEFAULT_COACH_MODE

  const mutation = useMutation({
    mutationFn: (next: CoachMode) =>
      runContractCommand(
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
      void queryClient.invalidateQueries({ queryKey: profileKey() })
      void queryClient.invalidateQueries({ queryKey: usageKey() })
    },
  })

  return {
    mode,
    setMode: (next: CoachMode) => {
      if (next === mode) return
      mutation.mutate(next)
    },
    isPending: query.isPending,
  }
}
