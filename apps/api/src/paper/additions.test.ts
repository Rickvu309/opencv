import { personActor, parseUserId } from "@workspace/domain/kernel"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { createMigratedTestDb, createTestApp } from "../test/harness.js"
import { saveFile } from "./store.js"

describe("paper additions", () => {
  it("serves files on the native paper routes", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const files = await app.request("/api/paper/files")
    expect(files.status).toBe(401)
    await client.close()
  })

  it("lists files and deletes a file", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-paper-additions"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-paper-additions@example.com",
    })
    const actor = personActor(userId)
    await withDatabase(db, async () => {
      const saved = await saveFile({
        userId: parseUserId(userId),
        name: "cv.pdf",
        mediaType: "application/pdf",
        bytes: Buffer.from("%PDF"),
        purpose: "import",
      })
      const listed = (await registry.read("paper.files", {}, actor)) as {
        id: string
        name: string
        byteSize: number
      }[]
      expect(listed.map((file) => file.name)).toEqual(["cv.pdf"])
      expect(listed[0]?.byteSize).toBe(4)

      await registry.execute({
        name: "paper.deleteFile",
        input: { fileId: saved.id },
        actor,
      })
      const after = (await registry.read("paper.files", {}, actor)) as unknown[]
      expect(after).toEqual([])
    })
    await client.close()
  })
})
