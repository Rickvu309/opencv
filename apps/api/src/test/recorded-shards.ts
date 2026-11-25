import { readFileSync } from "node:fs"
import { relative } from "node:path"
import { BaseSequencer, type TestSpecification } from "vitest/node"

const recorded = JSON.parse(
  readFileSync(new URL("./recorded-seconds.json", import.meta.url), "utf8")
) as Record<string, number>

export type TimedFile = { path: string; seconds: number }

export function secondsOf(
  paths: readonly string[],
  seconds: Readonly<Record<string, number>>
): TimedFile[] {
  const known = Object.values(seconds).sort((a, b) => a - b)
  const median = known.length ? known[Math.floor(known.length / 2)]! : 1
  return paths.map((path) => ({ path, seconds: seconds[path] ?? median }))
}

export function assignShards(files: readonly TimedFile[], count: number) {
  const shards = Array.from({ length: count }, () => ({
    seconds: 0,
    paths: [] as string[],
  }))
  const heaviestFirst = [...files].sort(
    (a, b) => b.seconds - a.seconds || a.path.localeCompare(b.path)
  )
  for (const file of heaviestFirst) {
    const lightest = shards.reduce((best, shard) =>
      shard.seconds < best.seconds ? shard : best
    )
    lightest.seconds += file.seconds
    lightest.paths.push(file.path)
  }
  return shards
}

export class RecordedSecondsSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]) {
    const shard = this.ctx.config.shard
    if (!shard) return files
    const pathOf = (file: TestSpecification) =>
      relative(this.ctx.config.root, file.moduleId)
    const shards = assignShards(
      secondsOf(files.map(pathOf), recorded),
      shard.count
    )
    const mine = new Set(shards[shard.index - 1]!.paths)
    return files.filter((file) => mine.has(pathOf(file)))
  }
}
