import type { QueryClient } from "@tanstack/react-query"
import type { JobStage, JobView } from "@workspace/domain"

import { refreshQueries } from "@/lib/contract-client.ts"

type Drop = { stage: JobStage; queued: number }

export type Drops = ReadonlyMap<string, Drop>

export const noDrops: Drops = new Map()

export function dropOn(drops: Drops, jobId: string, stage: JobStage): Drops {
  const next = new Map(drops)
  next.set(jobId, { stage, queued: (drops.get(jobId)?.queued ?? 0) + 1 })
  return next
}

function settleDrop(drops: Drops, jobId: string): Drops {
  const drop = drops.get(jobId)
  if (!drop) return drops
  const next = new Map(drops)
  next.set(jobId, { ...drop, queued: Math.max(0, drop.queued - 1) })
  return next
}

export function allSettled(drops: Drops): boolean {
  return [...drops.values()].every((drop) => drop.queued === 0)
}

export function clearSettled(drops: Drops): Drops {
  const next = new Map<string, Drop>()
  for (const [jobId, drop] of drops) {
    if (drop.queued > 0) next.set(jobId, drop)
  }
  return next.size === drops.size ? drops : next
}

export function forgetSettled(drops: Drops, jobId: string): Drops {
  if (drops.get(jobId)?.queued !== 0) return drops
  const next = new Map(drops)
  next.delete(jobId)
  return next
}

export function stageShown(
  drops: Drops,
  jobId: string,
  stage: JobStage
): JobStage {
  return drops.get(jobId)?.stage ?? stage
}

export function shownJobs(jobs: JobView[], drops: Drops): JobView[] {
  if (drops.size === 0) return jobs
  return jobs.map((job) => {
    const stage = stageShown(drops, job.id, job.stage)
    return stage === job.stage ? job : { ...job, stage }
  })
}

export function afterMove(
  drops: Drops,
  jobId: string
): { drops: Drops; refresh: boolean } {
  const settled = settleDrop(drops, jobId)
  return { drops: settled, refresh: allSettled(settled) }
}

export type DropsAction =
  | { type: "dropped"; jobId: string; stage: JobStage }
  | { type: "move_settled"; jobId: string }
  | { type: "undone"; jobId: string }
  | { type: "landed" }

export function dropsReducer(drops: Drops, action: DropsAction): Drops {
  switch (action.type) {
    case "dropped":
      return dropOn(drops, action.jobId, action.stage)
    case "move_settled":
      return afterMove(drops, action.jobId).drops
    case "undone":
      return forgetSettled(drops, action.jobId)
    case "landed":
      return clearSettled(drops)
  }
}

export function refetchBoard(queryClient: QueryClient) {
  return refreshQueries(queryClient, [
    { query: "job.list" },
    { query: "job.get" },
    { query: "job.calendar" },
  ])
}
