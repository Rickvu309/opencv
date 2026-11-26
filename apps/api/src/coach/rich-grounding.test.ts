import { createHash } from "node:crypto"

import { parseUserId, personActor } from "@workspace/domain/kernel"
import {
  canonicalPaper,
  paperPhotoRef,
  richPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocs, user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { seedColumns } from "../paper/content/content-document.js"
import { saveFile } from "../paper/index.js"
import { png } from "../paper/photo.fixtures.js"
import { createMigratedTestDb } from "../test/harness.js"
import { richPaper } from "../test/rich-paper.js"
import { resolveTurnGrounding } from "./context.js"

describe("the Coach reads a rich CV", () => {
  it("grounds on the rich CV's text and its saved basis, and marks the selected block", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-rich-grounding"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-rich-grounding@example.com",
    })
    const actor = personActor(userId)
    await withDatabase(db, async () => {
      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "Rich CV" },
        actor,
      })
      const docId = (created.output as { id: string }).id
      const photo = await saveFile({
        userId: parseUserId(userId),
        name: "portrait.png",
        mediaType: "image/png",
        bytes: Buffer.from(png),
        purpose: "avatar",
      })
      const document = richPaperDocumentSchema.parse(
        richPaper("cv", paperPhotoRef(photo.id))
      )
      await db
        .update(paperDocs)
        .set(seedColumns("cv", document))
        .where(eq(paperDocs.id, docId))
      const [row] = await db
        .select()
        .from(paperDocs)
        .where(eq(paperDocs.id, docId))
      const grounding = await resolveTurnGrounding({
        registry,
        actor,
        requestFocusDocId: docId,
        storedKind: null,
        storedId: null,
        memoryEnabled: false,
        context: [{ kind: "paper", id: docId, blockIds: ["intro"] }],
      })
      const line = (grounding.note ?? "")
        .split("\n")
        .find((entry) => entry.startsWith("Paper context (untrusted data): "))
      if (!line) throw new Error("The Coach has no Paper context")
      const context = JSON.parse(
        line.slice("Paper context (untrusted data): ".length)
      ) as {
        outline: string
        revision: number
        nativeBasis: { digest: string; revision: number }
      }
      const nodes = JSON.parse(context.outline) as {
        id: string
        selected: boolean
        content: { text: string }[]
      }[]
      expect(nodes.find((node) => node.id === "intro")?.selected).toBe(true)
      expect(
        nodes.some((node) =>
          node.content.some((run) => run.text.includes("Việt"))
        )
      ).toBe(true)
      expect(context.nativeBasis.digest).toBe(
        createHash("sha256").update(canonicalPaper(document)).digest("hex")
      )
      expect(context.revision).toBe(row?.contentVersion)
      expect(context.nativeBasis.revision).toBe(row?.contentVersion)
    })
    await client.close()
  })
})
