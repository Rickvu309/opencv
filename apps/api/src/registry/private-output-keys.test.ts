import { commands } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { PRIVATE_OUTPUT_KEYS } from "./http.js"

const reversalKey = /^(previous|from)[A-Z]/

type SchemaLike = {
  shape?: Record<string, unknown>
  options?: unknown[]
  _zod?: { def?: { options?: unknown[]; in?: unknown; innerType?: unknown } }
}

function outputKeys(schema: unknown): string[] {
  const node = schema as SchemaLike
  if (node.shape) return Object.keys(node.shape)
  const options = node.options ?? node._zod?.def?.options
  if (Array.isArray(options)) return options.flatMap(outputKeys)
  const inner = node._zod?.def?.in ?? node._zod?.def?.innerType
  return inner ? outputKeys(inner) : []
}

export function publishedReversalKeys(
  outputs: Record<string, string[]>,
  privateKeys: ReadonlySet<string>
) {
  return Object.entries(outputs).flatMap(([command, keys]) =>
    keys
      .filter((key) => reversalKey.test(key) && !privateKeys.has(key))
      .map((key) => `${command}.${key}`)
  )
}

describe("public command output", () => {
  it("flags an undo-only field that is not kept private", () => {
    const outputs = {
      "job.setPriority": ["id", "priority", "previousPriority"],
    }
    expect(publishedReversalKeys(outputs, new Set())).toEqual([
      "job.setPriority.previousPriority",
    ])
    expect(
      publishedReversalKeys(outputs, new Set(["previousPriority"]))
    ).toEqual([])
  })

  it("keeps every undo-only field of every command off the wire", () => {
    const outputs = Object.fromEntries(
      Object.entries(commands).map(([name, entry]) => [
        name,
        outputKeys(entry.output),
      ])
    )
    expect(
      Object.values(outputs).some((keys) => keys.includes("fromStage"))
    ).toBe(true)
    expect(publishedReversalKeys(outputs, PRIVATE_OUTPUT_KEYS)).toEqual([])
  })
})
