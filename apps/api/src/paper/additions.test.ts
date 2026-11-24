import { personActor, parseUserId } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { createMigratedTestDb, createTestApp } from "../test/harness.js"
import { saveFile } from "./store.js"

describe("paper additions", () => {
  it("serves files and pages on the native paper routes", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const files = await app.request("/api/paper/files")
    const pages = await app.request(
      "/api/paper/00000000-0000-7000-8000-000000000001/pages"
    )
    expect(files.status).toBe(401)
    expect(pages.status).toBe(401)
    await client.close()
  })

  it("lists files, counts pages, finds a keyword, and deletes a file", async () => {
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

      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "letter", name: "Northwind letter" },
        actor,
      })
      const docId = (created.output as { id: string }).id
      const pages = (await registry.read(
        "paper.pageCount",
        { docId },
        actor
      )) as { pages: number; pageChoice: string }
      expect(pages).toEqual({ docId, pages: 1, pageChoice: "unset" })

      const job = await registry.execute({
        name: "job.create",
        input: { title: "Designer", company: "Northwind" },
        actor,
      })
      const jobId = (job.output as { id: string }).id
      await registry.execute({
        name: "job.update",
        input: {
          jobId,
          patch: {
            posting: {
              about: "",
              duties: "",
              requirements: "The role needs Meta Ads",
              details: "",
            },
          },
        },
        actor,
      })
      const gap = await registry.read(
        "paper.keywordGap",
        { docId, jobId },
        actor
      )
      expect(gap).toEqual({
        keyword: "Meta Ads",
        sentence: "The job asks for Meta Ads. Add it if you've used it.",
      })

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
