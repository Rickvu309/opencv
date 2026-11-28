import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { paperDocs } from "../db/schema.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"
import { paperPhotoRef, richPaper } from "../test/rich-paper.js"
import { seedColumns } from "./content/content-document.js"

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const idResponse = z.object({ data: z.object({ id: z.string() }) })

describe("Deleting photo files", () => {
  it.each(["CV", "profile"])(
    "keeps bytes required by a %s reference and permits orphan deletion",
    async (reference) => {
      const { db, client } = await createMigratedTestDb()
      try {
        const app = createTestApp(db)
        const owner = await signUp(app, {
          name: "Ada",
          email: `photo-delete-${reference.toLowerCase()}@example.com`,
        })
        const command = async (name: string, input: object) =>
          app.request(`/api/commands/${name}`, {
            method: "POST",
            headers: authHeaders(owner.cookie),
            body: JSON.stringify({ input }),
          })
        const upload = async (name: string) => {
          const form = new FormData()
          form.set("file", new File([png], name, { type: "image/png" }))
          const response = await app.request("/api/paper/files", {
            method: "POST",
            headers: { Origin: testWebOrigin, Cookie: owner.cookie },
            body: form,
          })
          expect(response.status).toBe(200)
          return idResponse.parse(await response.json()).data.id
        }
        const bytes = (fileId: string) =>
          app.request(`/api/paper/files/${fileId}/bytes`, {
            headers: authHeaders(owner.cookie),
          })
        const fileId = await upload("retained.png")
        const orphanId = await upload("orphan.png")
        expect(
          (await command("paper.deleteFile", { fileId: orphanId })).status
        ).toBe(200)
        expect((await bytes(orphanId)).status).toBe(404)

        let releaseReference: () => Promise<Response>
        if (reference === "profile") {
          expect((await command("profile.setPhoto", { fileId })).status).toBe(
            200
          )
          releaseReference = async () => {
            const replacementId = await upload("profile-replacement.png")
            return command("profile.setPhoto", { fileId: replacementId })
          }
        } else {
          const created = await command("paper.create", {
            kind: "cv",
            name: "Protected photo CV",
          })
          expect(created.status).toBe(200)
          const docId = idResponse.parse(await created.json()).data.id
          await db
            .update(paperDocs)
            .set(seedColumns("cv", richPaper("cv", paperPhotoRef(fileId))))
            .where(eq(paperDocs.id, docId))
          releaseReference = () => command("paper.delete", { docId })
        }

        const blocked = await command("paper.deleteFile", { fileId })
        expect(blocked.status).toBe(409)
        expect(await blocked.text()).toContain("still in use")
        const retained = await bytes(fileId)
        expect(retained.status).toBe(200)
        expect(new Uint8Array(await retained.arrayBuffer())).toEqual(png)
        expect((await releaseReference()).status).toBe(200)
        expect((await command("paper.deleteFile", { fileId })).status).toBe(200)
        expect((await bytes(fileId)).status).toBe(404)
      } finally {
        await client.close()
      }
    }
  )
})
