import type { CvData } from "./paper-cv-types.ts"

/** Café undo grouping: keep typing in one field as a single step. */
export const CV_HISTORY_COALESCE_MS = 800
export const CV_HISTORY_LIMIT = 50

export type CvHistory = {
  past: CvData[]
  present: CvData
  future: CvData[]
  lastPath: string
  lastPushedAt: number
  /** Bumps when undo/redo applies so focused fields resync from React state. */
  revision: number
}

export function cloneCvData(data: CvData): CvData {
  return structuredClone(data)
}

export function cvSnapshotsEqual(a: CvData, b: CvData): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function createCvHistory(present: CvData): CvHistory {
  return {
    past: [],
    present: cloneCvData(present),
    future: [],
    lastPath: "",
    lastPushedAt: 0,
    revision: 0,
  }
}

/** First differing JSON path — used to coalesce keystrokes in one field. */
export function firstChangedPath(a: unknown, b: unknown, prefix = ""): string {
  if (Object.is(a, b)) return ""
  const aObj = a !== null && typeof a === "object"
  const bObj = b !== null && typeof b === "object"
  if (!aObj || !bObj) return prefix || "$"
  if (Array.isArray(a) !== Array.isArray(b)) return prefix || "$"

  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length)
    for (let i = 0; i < n; i++) {
      const path = firstChangedPath(
        a[i],
        b[i],
        prefix ? `${prefix}.${i}` : String(i)
      )
      if (path) return path
    }
    return ""
  }

  const aRec = a as Record<string, unknown>
  const bRec = b as Record<string, unknown>
  const keys = new Set([...Object.keys(aRec), ...Object.keys(bRec)])
  for (const key of keys) {
    const path = firstChangedPath(
      aRec[key],
      bRec[key],
      prefix ? `${prefix}.${key}` : key
    )
    if (path) return path
  }
  return ""
}

export function pushCvChange(
  history: CvHistory,
  next: CvData,
  now = Date.now(),
  coalesceMs = CV_HISTORY_COALESCE_MS
): CvHistory {
  if (cvSnapshotsEqual(history.present, next)) return history

  const path = firstChangedPath(history.present, next)
  const coalesced =
    history.future.length === 0 &&
    path !== "" &&
    path === history.lastPath &&
    history.lastPushedAt > 0 &&
    now - history.lastPushedAt < coalesceMs

  if (coalesced) {
    return {
      ...history,
      present: cloneCvData(next),
      lastPushedAt: now,
    }
  }

  return {
    past: [...history.past, history.present].slice(-CV_HISTORY_LIMIT),
    present: cloneCvData(next),
    future: [],
    lastPath: path,
    lastPushedAt: now,
    revision: history.revision,
  }
}

export function undoCv(history: CvHistory): CvHistory | null {
  const previous = history.past.at(-1)
  if (!previous) return null
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastPath: "",
    lastPushedAt: 0,
    revision: history.revision + 1,
  }
}

export function redoCv(history: CvHistory): CvHistory | null {
  const next = history.future[0]
  if (!next) return null
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    lastPath: "",
    lastPushedAt: 0,
    revision: history.revision + 1,
  }
}

export function canUndoCv(history: CvHistory) {
  return history.past.length > 0
}

export function canRedoCv(history: CvHistory) {
  return history.future.length > 0
}

/**
 * Autosave echo keeps the stack. A Coach/server snapshot that actually
 * differs (or a document switch) starts a fresh history.
 */
export function absorbCvServerSnapshot(
  history: CvHistory,
  incoming: CvData
): CvHistory {
  if (cvSnapshotsEqual(history.present, incoming)) return history
  return createCvHistory(incoming)
}

type KeyChord = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey?: boolean
}

function hasMod(event: KeyChord) {
  return event.metaKey || event.ctrlKey
}

export function isPaperUndoShortcut(event: KeyChord): boolean {
  if (event.altKey) return false
  if (!hasMod(event) || event.shiftKey) return false
  return event.key === "z" || event.key === "Z"
}

export function isPaperRedoShortcut(event: KeyChord): boolean {
  if (event.altKey) return false
  if (
    (event.key === "z" || event.key === "Z") &&
    hasMod(event) &&
    event.shiftKey
  ) {
    return true
  }
  return (
    (event.key === "y" || event.key === "Y") &&
    event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  )
}

const HISTORY_SHORTCUT_IGNORE =
  "[data-coach-float-card], [data-coach-float-pill], [role='dialog']"

/** Coach composer and the doc-title field keep their own native undo. */
export function shouldIgnoreCvHistoryShortcut(
  target: EventTarget | null
): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest(HISTORY_SHORTCUT_IGNORE)) return true
  if (
    (target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement) &&
    !target.closest("[data-paper-canvas]") &&
    !target.closest("[data-paper-toolbar]")
  ) {
    return true
  }
  return false
}
