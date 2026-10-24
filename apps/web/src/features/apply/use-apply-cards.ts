import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import {
  isDemoApplyCard,
  type ApplyCard,
  type ApplyCreateCardInput,
  type ApplyStage,
  type ApplyUpdateCardInput,
} from "@workspace/domain"

import { ApiError } from "@/lib/api-error.ts"

import {
  applyQueryKeys,
  createApplyCard,
  deleteApplyCard,
  listApplyCards,
  moveApplyCard,
  optimisticMoveCard,
  toggleApplyStar,
  updateApplyCard,
  upsertApplyCard,
} from "./apply-api.ts"

const EMPTY_CARDS: ApplyCard[] = []

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return "Something went wrong"
}

export function useApplyCards() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [revertKey, setRevertKey] = useState(0)
  const [clearing, setClearing] = useState(false)

  const listQuery = useQuery({
    queryKey: applyQueryKeys.list(),
    queryFn: listApplyCards,
  })
  const cards = listQuery.data ?? EMPTY_CARDS

  const rollback = useCallback(
    (previous: ApplyCard[] | undefined) => {
      queryClient.setQueryData(applyQueryKeys.list(), previous)
      setRevertKey((key) => key + 1)
    },
    [queryClient]
  )

  const createMutation = useMutation({
    mutationFn: (input: ApplyCreateCardInput = {}) => createApplyCard(input),
    onMutate: () => {
      setError(null)
    },
    onError: (err) => {
      setError(errorMessage(err))
    },
    onSuccess: (created) => {
      queryClient.setQueryData(
        applyQueryKeys.list(),
        (prev: ApplyCard[] | undefined) => upsertApplyCard(prev ?? [], created)
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: ApplyUpdateCardInput) => updateApplyCard(input),
    onMutate: async (input) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey: applyQueryKeys.list() })
      const previous = queryClient.getQueryData<ApplyCard[]>(
        applyQueryKeys.list()
      )
      queryClient.setQueryData(
        applyQueryKeys.list(),
        (prev: ApplyCard[] | undefined) =>
          (prev ?? []).map((card) =>
            card.id === input.cardId
              ? {
                  ...card,
                  ...("title" in input && input.title !== undefined
                    ? { title: input.title }
                    : {}),
                  ...("company" in input && input.company !== undefined
                    ? { company: input.company }
                    : {}),
                  ...("note" in input && input.note !== undefined
                    ? { note: input.note }
                    : {}),
                  ...("jobUrl" in input && input.jobUrl !== undefined
                    ? { jobUrl: input.jobUrl }
                    : {}),
                  ...("trackDate" in input && input.trackDate !== undefined
                    ? { trackDate: input.trackDate }
                    : {}),
                  ...("trackKind" in input && input.trackKind !== undefined
                    ? { trackKind: input.trackKind }
                    : {}),
                  demo: false,
                  updatedAt: new Date().toISOString(),
                }
              : card
          )
      )
      return { previous }
    },
    onError: (err, _input, ctx) => {
      rollback(ctx?.previous)
      setError(errorMessage(err))
    },
    onSuccess: (next) => {
      queryClient.setQueryData(
        applyQueryKeys.list(),
        (prev: ApplyCard[] | undefined) => upsertApplyCard(prev ?? [], next)
      )
    },
  })

  const moveMutation = useMutation({
    mutationFn: (input: {
      cardId: string
      stage: ApplyStage
      beforeCardId?: string | null
    }) => moveApplyCard(input),
    onMutate: async (input) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey: applyQueryKeys.list() })
      const previous = queryClient.getQueryData<ApplyCard[]>(
        applyQueryKeys.list()
      )
      queryClient.setQueryData(
        applyQueryKeys.list(),
        optimisticMoveCard(
          previous ?? [],
          input.cardId,
          input.stage,
          input.beforeCardId
        )
      )
      return { previous }
    },
    onError: (err, _input, ctx) => {
      rollback(ctx?.previous)
      setError(errorMessage(err))
    },
    onSuccess: (next) => {
      queryClient.setQueryData(
        applyQueryKeys.list(),
        (prev: ApplyCard[] | undefined) => upsertApplyCard(prev ?? [], next)
      )
    },
  })

  const starMutation = useMutation({
    mutationFn: (cardId: string) => toggleApplyStar({ cardId }),
    onMutate: async (cardId) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey: applyQueryKeys.list() })
      const previous = queryClient.getQueryData<ApplyCard[]>(
        applyQueryKeys.list()
      )
      queryClient.setQueryData(
        applyQueryKeys.list(),
        (prev: ApplyCard[] | undefined) =>
          (prev ?? []).map((card) =>
            card.id === cardId
              ? {
                  ...card,
                  starred: !card.starred,
                  demo: false,
                  updatedAt: new Date().toISOString(),
                }
              : card
          )
      )
      return { previous }
    },
    onError: (err, _cardId, ctx) => {
      rollback(ctx?.previous)
      setError(errorMessage(err))
    },
    onSuccess: (next) => {
      queryClient.setQueryData(
        applyQueryKeys.list(),
        (prev: ApplyCard[] | undefined) => upsertApplyCard(prev ?? [], next)
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (cardId: string) => deleteApplyCard({ cardId }),
    onMutate: async (cardId) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey: applyQueryKeys.list() })
      const previous = queryClient.getQueryData<ApplyCard[]>(
        applyQueryKeys.list()
      )
      queryClient.setQueryData(
        applyQueryKeys.list(),
        (prev: ApplyCard[] | undefined) =>
          (prev ?? []).filter((card) => card.id !== cardId)
      )
      return { previous }
    },
    onError: (err, _cardId, ctx) => {
      rollback(ctx?.previous)
      setError(errorMessage(err))
    },
  })

  return {
    cards,
    isLoading: listQuery.isPending,
    error,
    revertKey,
    dismissError: () => setError(null),
    createCard: (input?: ApplyCreateCardInput) =>
      createMutation.mutateAsync(input ?? {}),
    creating: createMutation.isPending,
    updateCard: (input: ApplyUpdateCardInput) => {
      updateMutation.mutate(input)
    },
    moveCard: (
      cardId: string,
      stage: ApplyStage,
      beforeCardId?: string | null
    ) => {
      moveMutation.mutate({ cardId, stage, beforeCardId })
    },
    toggleStar: (cardId: string) => {
      starMutation.mutate(cardId)
    },
    deleteCard: (cardId: string) => deleteMutation.mutateAsync(cardId),
    clearing,
    clearDemo: async () => {
      setClearing(true)
      try {
        for (const card of cards.filter(isDemoApplyCard)) {
          await deleteMutation.mutateAsync(card.id)
        }
      } catch {
        // deleteMutation.onError already rolled back and set the error banner
      } finally {
        setClearing(false)
      }
    },
  }
}
