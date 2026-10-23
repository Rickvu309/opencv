import {
  APPLY_COMMANDS,
  generateKeyBetween,
  type ApplyCard,
  type ApplyCreateCardInput,
  type ApplyScanInput,
  type ApplyScanResult,
  type ApplyStage,
  type ApplyUpdateCardInput,
} from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { runCommand, unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

import { sortApplyCards } from "./apply-types.ts"

export const applyQueryKeys = {
  all: ["apply"] as const,
  list: () => ["apply", "list"] as const,
  detail: (id: string) => ["apply", "detail", id] as const,
}

export async function listApplyCards(): Promise<ApplyCard[]> {
  const body = await apiFetch<SuccessBody<ApplyCard[]>>("/api/apply")
  return unwrapData(body)
}

export function createApplyCard(
  input: ApplyCreateCardInput = {}
): Promise<ApplyCard> {
  return runCommand<ApplyCard>(APPLY_COMMANDS.createCard, input)
}

export function updateApplyCard(
  input: ApplyUpdateCardInput
): Promise<ApplyCard> {
  return runCommand<ApplyCard>(APPLY_COMMANDS.updateCard, input)
}

export function moveApplyCard(input: {
  cardId: string
  stage: ApplyStage
  beforeCardId?: string | null
}): Promise<ApplyCard> {
  return runCommand<ApplyCard>(APPLY_COMMANDS.moveCard, input)
}

export function toggleApplyStar(input: { cardId: string }): Promise<ApplyCard> {
  return runCommand<ApplyCard>(APPLY_COMMANDS.toggleStar, input)
}

export function deleteApplyCard(input: {
  cardId: string
}): Promise<{ id: string }> {
  return runCommand<{ id: string }>(APPLY_COMMANDS.deleteCard, input)
}

export function scanApplyJob(input: ApplyScanInput): Promise<ApplyScanResult> {
  return apiFetch<SuccessBody<ApplyScanResult>>("/api/apply/scan", {
    method: "POST",
    body: JSON.stringify(input),
  }).then(unwrapData)
}

export function upsertApplyCard(
  cards: ApplyCard[],
  next: ApplyCard
): ApplyCard[] {
  return sortApplyCards([next, ...cards.filter((card) => card.id !== next.id)])
}

export function optimisticMoveCard(
  cards: ApplyCard[],
  cardId: string,
  stage: ApplyStage,
  beforeCardId?: string | null
): ApplyCard[] {
  const card = cards.find((item) => item.id === cardId)
  if (!card) return cards

  const others = cards.filter((item) => item.id !== cardId)
  const column = sortApplyCards(others.filter((item) => item.stage === stage))
  const index = beforeCardId
    ? column.findIndex((item) => item.id === beforeCardId)
    : -1
  const left =
    index > 0
      ? column[index - 1]!.position
      : index === 0
        ? null
        : (column.at(-1)?.position ?? null)
  const right = index >= 0 ? column[index]!.position : null

  return upsertApplyCard(others, {
    ...card,
    stage,
    position: generateKeyBetween(left, right),
    updatedAt: new Date().toISOString(),
  })
}
