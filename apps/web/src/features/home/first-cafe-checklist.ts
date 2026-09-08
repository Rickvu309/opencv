import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { APPLY_OPEN_GUIDE } from "@/features/apply/apply-search.ts"

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
    search: { open: APPLY_OPEN_GUIDE },
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

/** Craft-surface wins the quiet next nudge may follow. Email is optional. */
export const FIRST_CAFE_WIN_IDS = ["sample-cv", "pitch", "apply"] as const

export type FirstCafeWinId = (typeof FIRST_CAFE_WIN_IDS)[number]

export type FirstCafeState = {
  dismissed: boolean
  completed: FirstCafeItemId[]
  nudgeSkipped: boolean
  /** Real surface wins that must not write checklist checks (e.g. Pitch clear). */
  wins: FirstCafeWinId[]
}

export const EMPTY_FIRST_CAFE_STATE: FirstCafeState = {
  dismissed: false,
  completed: [],
  nudgeSkipped: false,
  wins: [],
}

const ITEM_ID_SET = new Set<string>(FIRST_CAFE_ITEM_IDS)
const WIN_ID_SET = new Set<string>(FIRST_CAFE_WIN_IDS)

export function firstCafeStorageKey(userId: string) {
  return `${FIRST_CAFE_STORAGE_PREFIX}:${userId}`
}

export function parseFirstCafeState(raw: string | null): FirstCafeState {
  if (!raw) {
    return { ...EMPTY_FIRST_CAFE_STATE }
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ...EMPTY_FIRST_CAFE_STATE }
    }

    const record = parsed as {
      dismissed?: unknown
      completed?: unknown
      nudgeSkipped?: unknown
      wins?: unknown
    }

    return {
      dismissed: record.dismissed === true,
      completed: Array.isArray(record.completed)
        ? record.completed.filter(
            (id): id is FirstCafeItemId =>
              typeof id === "string" && ITEM_ID_SET.has(id)
          )
        : [],
      nudgeSkipped: record.nudgeSkipped === true,
      wins: Array.isArray(record.wins)
        ? record.wins.filter(
            (id): id is FirstCafeWinId =>
              typeof id === "string" && WIN_ID_SET.has(id)
          )
        : [],
    }
  } catch {
    return { ...EMPTY_FIRST_CAFE_STATE }
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

export function skipFirstCafeNudge(state: FirstCafeState): FirstCafeState {
  if (state.nudgeSkipped) return state
  return { ...state, nudgeSkipped: true }
}

export function noteFirstCafeWin(
  state: FirstCafeState,
  id: FirstCafeWinId
): FirstCafeState {
  if (state.wins.includes(id)) return state
  return { ...state, wins: [...state.wins, id] }
}

export function nextFirstCafeNudge(input: {
  completed: readonly FirstCafeItemId[]
  nudgeSkipped: boolean
  extraWins?: readonly FirstCafeWinId[]
}): FirstCafeItem | null {
  if (input.nudgeSkipped) return null

  const wins = new Set<FirstCafeWinId>()
  for (const id of input.completed) {
    if (WIN_ID_SET.has(id)) wins.add(id as FirstCafeWinId)
  }
  for (const id of input.extraWins ?? []) {
    wins.add(id)
  }
  if (wins.size === 0) return null

  return (
    FIRST_CAFE_CHECKLIST_ITEMS.find(
      (item) => WIN_ID_SET.has(item.id) && !wins.has(item.id as FirstCafeWinId)
    ) ?? null
  )
}

/**
 * Exact leaf path only — never a parent `/app` prefix, never more than
 * one item. This maps a real surface URL to its item; it is not a visit
 * signal by itself. Visiting Apply must not complete Sample CV or Pitch.
 */
export function firstCafeItemForVisit(
  pathname: string,
  search: Record<string, unknown> = {}
): FirstCafeItemId | null {
  const matches = FIRST_CAFE_CHECKLIST_ITEMS.filter((item) => {
    if (item.to !== pathname) return false
    if (item.id === "email") return search.tab === "apps"
    return true
  })
  return matches.length === 1 ? (matches[0]?.id ?? null) : null
}

export function readFirstCafeState(userId: string): FirstCafeState {
  try {
    return parseFirstCafeState(
      window.localStorage.getItem(firstCafeStorageKey(userId))
    )
  } catch {
    return { ...EMPTY_FIRST_CAFE_STATE }
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

/** Completes one item from the mounted surface page — never from a path flash. */
export function recordFirstCafeItem(
  userId: string,
  id: FirstCafeItemId
): FirstCafeState {
  const current = readFirstCafeState(userId)
  const next = completeFirstCafeItem(current, id)
  if (next === current) return current
  writeFirstCafeState(userId, next)
  return next
}

export function recordFirstCafeVisit(
  userId: string,
  pathname: string,
  search: Record<string, unknown> = {}
): FirstCafeState {
  const id = firstCafeItemForVisit(pathname, search)
  if (!id) return readFirstCafeState(userId)
  return recordFirstCafeItem(userId, id)
}

/** Records a real surface win without checking a checklist item. */
export function recordFirstCafeWin(
  userId: string,
  id: FirstCafeWinId
): FirstCafeState {
  const current = readFirstCafeState(userId)
  const next = noteFirstCafeWin(current, id)
  if (next === current) return current
  writeFirstCafeState(userId, next)
  return next
}
