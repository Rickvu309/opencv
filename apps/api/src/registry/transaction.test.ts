import { ERROR_CODES, personActor } from "@workspace/domain/kernel"
import type { ZodType } from "zod"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { CommandError } from "../platform/errors.js"
import { installRegistry } from "../install.js"

const UUID = "00000000-0000-4000-8000-000000000001"

type Schema = ZodType & {
  type: string
  def: {
    shape?: Record<string, Schema>
    innerType?: Schema
    in?: Schema
    options?: readonly Schema[]
    element?: Schema
    entries?: Record<string, unknown>
    values?: readonly unknown[]
  }
}

const STRING_CANDIDATES = [
  "ada@example.com",
  UUID,
  "2026-01-02T00:00:00.000Z",
  "2026-01-02",
  "https://example.com/job",
  "a",
  "",
]

function sampleInput(schema: Schema, depth = 0): unknown {
  if (depth > 8) throw new Error(`schema is too deep (${schema.type})`)
  const { type, def } = schema
  if (
    type === "optional" ||
    type === "default" ||
    type === "prefault" ||
    type === "nullable" ||
    type === "readonly" ||
    type === "catch"
  ) {
    if (!def.innerType) throw new Error(`missing inner schema for ${type}`)
    return sampleInput(def.innerType, depth + 1)
  }
  if (type === "pipe") {
    if (!def.in) throw new Error("missing pipe input")
    return sampleInput(def.in, depth + 1)
  }
  if (type === "object") {
    const shape = def.shape ?? {}
    const value: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(shape)) {
      if (
        child.type === "optional" ||
        child.type === "default" ||
        child.type === "prefault"
      ) {
        continue
      }
      value[key] = sampleInput(child, depth + 1)
    }
    return value
  }
  if (type === "array") {
    if (schema.safeParse([]).success) return []
    if (!def.element) throw new Error("missing array element")
    return [sampleInput(def.element, depth + 1)]
  }
  if (type === "union") {
    for (const option of def.options ?? []) {
      const value = sampleInput(option, depth + 1)
      if (schema.safeParse(value).success) return value
    }
    throw new Error("no union option parsed")
  }
  if (type === "enum") {
    const values = Object.values(def.entries ?? {})
    if (values.length === 0) throw new Error("empty enum")
    return values[0]
  }
  if (type === "literal") {
    const value = def.values?.[0]
    if (value === undefined) throw new Error("empty literal")
    return value
  }
  if (type === "string") {
    for (const candidate of STRING_CANDIDATES) {
      if (schema.safeParse(candidate).success) return candidate
    }
    throw new Error("no string candidate parsed")
  }
  if (type === "number" || type === "int") {
    for (const candidate of [1, 0, -1]) {
      if (schema.safeParse(candidate).success) return candidate
    }
    throw new Error("no number candidate parsed")
  }
  if (type === "boolean") return false
  if (type === "unknown" || type === "any") return null
  if (type === "record") return {}
  throw new Error(`cannot sample ${type}`)
}

describe("every command runs in a transaction unless it declares none", () => {
  it("keeps every command in a transaction unless it declares none, because that handler opens its own connection and cannot join the registry transaction", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-transaction"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-transaction@example.com",
    })
    const person = personActor(userId)
    const outside = "account.requestEmailChange"
    const calls: string[] = []
    let label = ""
    const original = db.transaction.bind(db)
    db.transaction = (async (fn) => {
      calls.push(label)
      return original(fn)
    }) as typeof db.transaction

    try {
      await withDatabase(db, async () => {
        const names = registry.commandNames()
        expect(names).toContain(outside)
        label = outside
        const before = calls.length
        await registry.execute({
          name: outside,
          input: { email: "next@example.com" },
          actor: person,
        })
        expect(calls.slice(before)).toEqual([])

        const tools = await registry.tools(person)
        const schemas = new Map(tools.map((tool) => [tool.name, tool.input]))
        const others = names
          .filter((name) => name !== outside)
          .sort(
            (a, b) =>
              Number(a === "account.delete") - Number(b === "account.delete")
          )
        expect(others.length).toBeGreaterThan(0)
        for (const name of others) {
          const schema = schemas.get(name) as Schema | undefined
          if (!schema) throw new Error(`missing schema for ${name}`)
          const input =
            name === "coach.start"
              ? { chatId: UUID, startKey: UUID, text: "Hello Coach" }
              : name === "paper.save"
                ? {
                    docId: UUID,
                    client: "tab-transaction",
                    base: 0,
                    changes: [
                      {
                        edit: "edit-transaction",
                        origin: {
                          kind: "person",
                          actor: "person",
                          client: "tab-transaction",
                        },
                        base: 0,
                        steps: [],
                        inverse: [],
                        commands: [],
                      },
                    ],
                  }
                : name === "paper.update"
                  ? { docId: UUID, patch: { name: "Renamed" } }
                  : name === "paper.edit"
                    ? {
                        docId: UUID,
                        basedOn: 0,
                        commands: [
                          {
                            op: "replaceText",
                            range: {
                              from: { block: "line-1", offset: 0 },
                              to: { block: "line-1", offset: 3 },
                            },
                            expect: "Ada",
                            text: "Ada Lovelace",
                          },
                        ],
                      }
                    : sampleInput(schema)
          const parsed = schema.safeParse(input)
          if (!parsed.success) {
            throw new Error(`${name} rejected the sample input`)
          }
          label = name
          const start = calls.length
          try {
            await registry.execute({ name, input, actor: person })
          } catch (error) {
            if (
              error instanceof CommandError &&
              error.code === ERROR_CODES.VALIDATION_ERROR
            ) {
              throw new Error(`${name} rejected the sample input`, {
                cause: error,
              })
            }
          }
          expect(calls.slice(start), name).not.toEqual([])
        }
      })
    } finally {
      await client.close()
    }
  })
})
