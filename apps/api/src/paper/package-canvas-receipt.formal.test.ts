import { randomUUID } from "node:crypto"

import { personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import * as databaseContext from "../db/context.js"
import { getDb, withDatabase } from "../db/context.js"
import { activity, paperPackageHeads, user } from "../db/schema.js"
import { bindCatalog } from "../registry/bind.js"
import { Registry } from "../registry/registry.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import { registerPaper } from "./commands.js"
import { implementation as readWord } from "./operations/read/server.js"

let backend: Backend
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
})

afterAll(async () => {
  await backend?.close()
})

describe("a blank page keeps its receipt with the save", () => {
  it("leaves no page when the receipt insert fails", () =>
    run(async () => {
      const id = randomUUID()
      await getDb()
        .insert(user)
        .values({ id, name: id, email: `${id}@test.invalid` })
      const real = databaseContext.getDb
      let published = 0
      const spy = vi.spyOn(databaseContext, "getDb").mockImplementation(() => {
        const db = real()
        return new Proxy(db, {
          get(target, prop, receiver) {
            if (prop === "insert")
              return (table: unknown) => {
                if (table === paperPackageHeads) published += 1
                if (table === activity) throw new Error("receipt failed")
                return (target.insert as (table: unknown) => unknown).bind(
                  target
                )(table)
              }
            const value: unknown = Reflect.get(target, prop, receiver)
            return typeof value === "function"
              ? (value as (...args: unknown[]) => unknown).bind(target)
              : value
          },
        }) as ReturnType<typeof getDb>
      })
      const registry = new Registry()
      registerPaper(registry)
      bindCatalog(registry, { "paper.read": readWord })
      try {
        await expect(
          registry.execute({
            name: "paper.canvas",
            input: { op: "mint", label: "letter" },
            actor: personActor(id),
            idempotencyKey: randomUUID(),
          })
        ).rejects.toThrow("receipt failed")
        expect(published).toBe(1)
        expect(
          await real()
            .select({ docId: paperPackageHeads.docId })
            .from(paperPackageHeads)
            .where(eq(paperPackageHeads.userId, id))
        ).toEqual([])
      } finally {
        spy.mockRestore()
      }
    }))
})
