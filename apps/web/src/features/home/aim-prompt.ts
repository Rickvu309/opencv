import { readStored, writeStored } from "@/lib/local-storage.ts"

export const AIM_PROMPT_STORAGE_PREFIX = "opencv:home:aim-prompt"

export const AIM_OPTIONS = [
  {
    id: "cafe-part-time",
    label: "A café or part-time job",
    headline: "Working café shifts while I study",
  },
  {
    id: "summer-intern",
    label: "A summer internship",
    headline: "Looking for a summer internship",
  },
  {
    id: "product-intern",
    label: "A product intern role",
    headline: "Aiming for a product intern role",
  },
  {
    id: "first-job",
    label: "A first full-time job",
    headline: "Looking for a first full-time role",
  },
] as const

export type AimId = (typeof AIM_OPTIONS)[number]["id"]

export type AimPromptState = {
  resolved: boolean
  aimId: AimId | null
}

export const EMPTY_AIM_PROMPT_STATE: AimPromptState = {
  resolved: false,
  aimId: null,
}

const AIM_ID_SET = new Set<string>(AIM_OPTIONS.map((option) => option.id))

export function aimPromptStorageKey(userId: string) {
  return `${AIM_PROMPT_STORAGE_PREFIX}:${userId}`
}

export function parseAimPromptState(raw: string | null): AimPromptState {
  if (!raw) return { resolved: false, aimId: null }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return { resolved: false, aimId: null }
    }

    const record = parsed as {
      resolved?: unknown
      aimId?: unknown
    }
    const aimId =
      typeof record.aimId === "string" && AIM_ID_SET.has(record.aimId)
        ? (record.aimId as AimId)
        : null

    return {
      resolved: record.resolved === true,
      aimId,
    }
  } catch {
    return { resolved: false, aimId: null }
  }
}

export function resolveAimPrompt(
  state: AimPromptState,
  aimId: AimId | null
): AimPromptState {
  if (state.resolved && state.aimId === aimId) return state
  return { resolved: true, aimId }
}

export function headlineForAim(id: AimId) {
  const option = AIM_OPTIONS.find((item) => item.id === id)
  return option?.headline ?? ""
}

export function readAimPromptState(userId: string): AimPromptState {
  return readStored(aimPromptStorageKey(userId), parseAimPromptState, {
    resolved: false,
    aimId: null,
  })
}

export function writeAimPromptState(userId: string, state: AimPromptState) {
  writeStored(aimPromptStorageKey(userId), JSON.stringify(state))
}
