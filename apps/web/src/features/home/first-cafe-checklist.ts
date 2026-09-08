import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"

export const FIRST_CAFE_ITEM_IDS = [
  "sample-cv",
  "pitch",
  "apply",
  "email",
] as const

export type FirstCafeItemId = (typeof FIRST_CAFE_ITEM_IDS)[number]

export type FirstCafeItem = {
  id: FirstCafeItemId
  label: string
  optional?: boolean
  to: string
  search?: Record<string, string>
}

export const FIRST_CAFE_CHECKLIST_ITEMS: readonly FirstCafeItem[] = [
  {
    id: "sample-cv",
    label: "Open the sample CV",
    to: SURFACE_PATHS.paper,
    search: { open: "sample" },
  },
  {
    id: "pitch",
    label: "Make Pitch yours",
    to: SURFACE_PATHS.pitch,
  },
  {
    id: "apply",
    label: "Triage one Apply card",
    to: SURFACE_PATHS.apply,
  },
  {
    id: "email",
    label: "Connect email",
    optional: true,
    to: SURFACE_PATHS.settings,
    search: { tab: "apps" },
  },
]

export const FIRST_CAFE_STORAGE_PREFIX = "openpath:home:first-cafe-checklist"

export type FirstCafeState = {
  dismissed: boolean
  completed: FirstCafeItemId[]
}

export const EMPTY_FIRST_CAFE_STATE: FirstCafeState = {
  dismissed: false,
  completed: [],
}

const ITEM_ID_SET = new Set<string>(FIRST_CAFE_ITEM_IDS)

export function firstCafeStorageKey(userId: string) {
  return `${FIRST_CAFE_STORAGE_PREFIX}:${userId}`
}

export function parseFirstCafeState(raw: string | null): FirstCafeState {
  if (!raw) {
    return { dismissed: false, completed: [] }
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return { dismissed: false, completed: [] }
    }

    const record = parsed as {
      dismissed?: unknown
      completed?: unknown
    }

    return {
      dismissed: record.dismissed === true,
      completed: Array.isArray(record.completed)
        ? record.completed.filter(
            (id): id is FirstCafeItemId =>
              typeof id === "string" && ITEM_ID_SET.has(id)
          )
        : [],
    }
  } catch {
    return { dismissed: false, completed: [] }
  }
}

export function completeFirstCafeItem(
  state: FirstCafeState,
  id: FirstCafeItemId
): FirstCafeState {
  if (state.completed.includes(id)) return state
  return { ...state, completed: [...state.completed, id] }
}

export function dismissFirstCafeChecklist(
  state: FirstCafeState
): FirstCafeState {
  if (state.dismissed) return state
  return { ...state, dismissed: true }
}

export function firstCafeItemForVisit(
  pathname: string,
  search: Record<string, unknown> = {}
): FirstCafeItemId | null {
  if (pathname === SURFACE_PATHS.paper) return "sample-cv"
  if (pathname === SURFACE_PATHS.pitch) return "pitch"
  if (pathname === SURFACE_PATHS.apply) return "apply"
  if (pathname === SURFACE_PATHS.settings && search.tab === "apps") {
    return "email"
  }
  return null
}

export function readFirstCafeState(userId: string): FirstCafeState {
  try {
    return parseFirstCafeState(
      window.localStorage.getItem(firstCafeStorageKey(userId))
    )
  } catch {
    return { dismissed: false, completed: [] }
  }
}

export function writeFirstCafeState(userId: string, state: FirstCafeState) {
  try {
    window.localStorage.setItem(
      firstCafeStorageKey(userId),
      JSON.stringify(state)
    )
  } catch {
    // Private mode / blocked storage — keep the session copy only.
  }
}

export function recordFirstCafeVisit(
  userId: string,
  pathname: string,
  search: Record<string, unknown> = {}
): FirstCafeState {
  const current = readFirstCafeState(userId)
  const id = firstCafeItemForVisit(pathname, search)
  if (!id) return current
  const next = completeFirstCafeItem(current, id)
  if (next === current) return current
  writeFirstCafeState(userId, next)
  return next
}
