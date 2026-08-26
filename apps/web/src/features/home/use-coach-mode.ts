import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  DEFAULT_COACH_MODE,
  type CoachMode,
  type UserProfile,
} from "@workspace/domain"

import {
  getProfile,
  profileQueryKeys,
  setCoachMode,
} from "@/features/home/profile-api.ts"

export function useCoachMode() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: profileQueryKeys.current(),
    queryFn: getProfile,
  })
  const mode = query.data?.coachMode ?? DEFAULT_COACH_MODE

  const mutation = useMutation({
    mutationFn: setCoachMode,
    onMutate: async (next: CoachMode) => {
      await queryClient.cancelQueries({ queryKey: profileQueryKeys.current() })
      const previous = queryClient.getQueryData<UserProfile>(
        profileQueryKeys.current()
      )
      if (previous) {
        queryClient.setQueryData(profileQueryKeys.current(), {
          ...previous,
          coachMode: next,
        })
      }
      return { previous }
    },
    onError: (_error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          profileQueryKeys.current(),
          context.previous
        )
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKeys.current() })
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
