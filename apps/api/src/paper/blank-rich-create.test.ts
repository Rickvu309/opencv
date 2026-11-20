import { personActor, RICH_NATIVE_WRITER } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "../test/harness.js"

describe("paper.create format rich", () => {
  for (const kind of ["cv", "letter"] as const) {
    it(`creates a blank rich ${kind} that the full editor can open`, async () => {
      const { db, client } = await createMigratedTestDb()
      const registry = installRegistry()
      const userId = `user-blank-rich-${kind}`
      await db.insert(user).values({
        id: userId,
        name: "Ada",
        email: `ada-blank-rich-${kind}@example.com`,
      })
      const actor = personActor(userId)
      await withDatabase(db, async () => {
        const executed = (await registry.execute({
          name: "paper.create",
          input: { kind, format: "rich" },
          actor,
        })) as {
          output: { id: string; name: string; kind: string }
        }
        const created = executed.output

        expect(created.kind).toBe(kind)
        expect(created.name).toBe(
          kind === "cv" ? "Untitled CV" : "Untitled Letter"
        )
        const document = (await registry.read(
          "paper.document",
          { docId: created.id, writer: RICH_NATIVE_WRITER },
          actor
        )) as {
          format: "rich"
          provenance: { documentVersion: number }
        }
        expect(document.format).toBe("rich")
        expect(document.provenance.documentVersion).toBe(4)
        await expect(
          registry.read("paper.document", { docId: created.id }, actor)
        ).rejects.toThrow()
      })
      await client.close()
    })
  }

  it("refuses a rich blank that also asks for a template", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-blank-rich-refused"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-blank-rich-refused@example.com",
    })
    const actor = personActor(userId)
    await withDatabase(db, async () => {
      await expect(
        registry.execute({
          name: "paper.create",
          input: { kind: "cv", format: "rich", templateId: "academic" },
          actor,
        })
      ).rejects.toThrow(/rich blank document cannot start from a template/)
    })
    await client.close()
  })
})
