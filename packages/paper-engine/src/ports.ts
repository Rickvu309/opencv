import type { BlockId } from "@workspace/domain/paper-doc"

export interface Ports {
  ids: () => BlockId
  now: () => number
}

export function seededIds(prefix = "id"): () => BlockId {
  let next = 0
  return () => {
    next += 1
    return `${prefix}-${next}` as BlockId
  }
}

export function fixedClock(at = 0): () => number {
  return () => at
}
