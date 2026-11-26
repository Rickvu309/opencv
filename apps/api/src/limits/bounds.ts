import {
  LIMITS,
  SERVICE_MEMORY_BYTES,
  type LimitId,
} from "@workspace/domain/limits"

export type LimitBound = {
  oneKeyShare: number
  keysToDenyAll: number
  targetedDenialMs: number
  memoryBytes: number
}

export function limitBounds(): Record<LimitId, LimitBound> {
  const bounds = {} as Record<LimitId, LimitBound>
  for (const id of Object.keys(LIMITS) as LimitId[]) {
    const spec = LIMITS[id]
    const memoryBytes =
      spec.shape.kind === "lease" ? spec.shape.total * spec.shape.costBytes : 0
    if (memoryBytes > SERVICE_MEMORY_BYTES)
      throw new Error(`${id} lease exceeds the service memory budget`)
    bounds[id] = {
      oneKeyShare: spec.accepts.oneKeyShare,
      keysToDenyAll: spec.accepts.keysToDenyAll,
      targetedDenialMs: spec.accepts.targetedDenialMs,
      memoryBytes,
    }
  }
  return bounds
}
