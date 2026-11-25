import { readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { assignShards, secondsOf } from "./recorded-shards.js"

describe("API test shards by recorded seconds", () => {
  it("puts the heaviest file first on the lightest shard", () => {
    const shards = assignShards(
      [
        { path: "a", seconds: 10 },
        { path: "b", seconds: 6 },
        { path: "c", seconds: 5 },
        { path: "d", seconds: 4 },
        { path: "e", seconds: 1 },
      ],
      3
    )
    expect(shards.map((shard) => shard.paths)).toEqual([
      ["a"],
      ["b", "e"],
      ["c", "d"],
    ])
    expect(shards.map((shard) => shard.seconds)).toEqual([10, 7, 9])
  })

  it("gives a file with no record the median time", () => {
    expect(secondsOf(["x", "new"], { x: 1, y: 3, z: 9 })).toEqual([
      { path: "x", seconds: 1 },
      { path: "new", seconds: 3 },
    ])
  })

  it("places every API test file on exactly one shard, within 20 recorded seconds of the others", () => {
    const recorded = JSON.parse(
      readFileSync(new URL("./recorded-seconds.json", import.meta.url), "utf8")
    ) as Record<string, number>
    const root = new URL("../../", import.meta.url)
    const files = readdirSync(new URL("src/", root), { recursive: true })
      .map(String)
      .filter((name) => name.endsWith(".test.ts"))
      .map((name) => `src/${name}`)
    const shards = assignShards(secondsOf(files, recorded), 3)
    const placed = shards.flatMap((shard) => shard.paths).sort()
    expect(placed).toEqual([...files].sort())
    const seconds = shards.map((shard) => shard.seconds)
    expect(Math.max(...seconds) - Math.min(...seconds)).toBeLessThan(20)
  })
})
