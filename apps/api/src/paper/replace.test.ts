import { emptyCvDocument, ERROR_CODES, personActor } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "../test/harness.js"

describe("paper.replace", () => {
  it("keeps the first body when two replaces share a content version", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-paper-replace-race"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-paper-replace-race@example.com",
    })
    const actor = personActor(userId)
    await withDatabase(db, async () => {
      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "CV" },
        actor,
      })
      const doc = created.output as {
        id: string
        document: Record<string, unknown>
        contentVersion: number
      }
      const first = { ...emptyCvDocument(), summary: "First body" }
      const second = { ...emptyCvDocument(), summary: "Second body" }
      const replaced = await registry.execute({
        name: "paper.replace",
        input: {
          docId: doc.id,
          contentVersion: doc.contentVersion,
          document: first,
        },
        actor,
      })
      expect(replaced.output).toMatchObject({
        contentVersion: doc.contentVersion + 1,
        document: { summary: "First body" },
      })

      await expect(
        registry.execute({
          name: "paper.replace",
          input: {
            docId: doc.id,
            contentVersion: doc.contentVersion,
            document: second,
          },
          actor,
        }),
        "PGlite is one connection, so this sequential call is the race the UPDATE version predicate protects"
      ).rejects.toMatchObject({
        name: "CommandError",
        code: ERROR_CODES.CONFLICT,
        message: "This document changed. Reload it and try again.",
        detail: {
          document: {
            contentVersion: doc.contentVersion + 1,
            document: { summary: "First body" },
          },
        },
      })

      const read = (await registry.read(
        "paper.get",
        { docId: doc.id },
        actor
      )) as { contentVersion: number; document: { summary: string } }
      expect(read.contentVersion).toBe(doc.contentVersion + 1)
      expect(read.document.summary).toBe("First body")
    })
    await client.close()
  })

  it("increments the content version and returns the previous document", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-paper-replace-version"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-paper-replace-version@example.com",
    })
    const actor = personActor(userId)
    await withDatabase(db, async () => {
      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "CV" },
        actor,
      })
      const doc = created.output as {
        id: string
        document: Record<string, unknown>
        contentVersion: number
      }
      const next = { ...emptyCvDocument(), summary: "Shipped the note." }
      const replaced = await registry.execute({
        name: "paper.replace",
        input: {
          docId: doc.id,
          contentVersion: doc.contentVersion,
          document: next,
        },
        actor,
      })
      expect(replaced.output).toMatchObject({
        contentVersion: doc.contentVersion + 1,
        previousDocument: doc.document,
        document: { summary: "Shipped the note." },
      })
    })
    await client.close()
  })
})
