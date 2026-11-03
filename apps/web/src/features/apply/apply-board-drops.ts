import type { JobStage, JobView } from "@workspace/domain"

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
