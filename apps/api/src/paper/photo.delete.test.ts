import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const idResponse = z.object({ data: z.object({ id: z.string() }) })
const activityResponse = z.object({
  data: z.object({ activityId: z.string() }),
})

describe("Deleting photo files", () => {
  it.each(["CV", "Undo", "profile"])(
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
            templateId: "with-photo",
            name: "Protected photo CV",
          })
          expect(created.status).toBe(200)
          const docId = idResponse.parse(await created.json()).data.id
          const attached = await command("paper.attachPhoto", { docId, fileId })
          expect(attached.status).toBe(200)
          const attachmentActivityId = activityResponse.parse(
            await attached.json()
          ).data.activityId
          if (reference === "Undo") {
            const replacementId = await upload("cv-replacement.png")
            const replaced = await command("paper.attachPhoto", {
              docId,
              fileId: replacementId,
            })
            expect(replaced.status).toBe(200)
            const activityId = activityResponse.parse(await replaced.json())
              .data.activityId
            const blocked = await command("paper.deleteFile", { fileId })
            expect(blocked.status).toBe(409)
            expect(
              (await command("activity.undo", { activityId })).status
            ).toBe(200)
            expect((await bytes(fileId)).status).toBe(200)
            expect(
              (await command("paper.deleteFile", { fileId: replacementId }))
                .status
            ).toBe(200)
          }
          releaseReference = () =>
            command("activity.undo", { activityId: attachmentActivityId })
        }

        const blocked = await command("paper.deleteFile", { fileId })
        expect(blocked.status).toBe(409)
        expect(await blocked.text()).toContain("still in use")
        const retained = await bytes(fileId)
        expect(retained.status).toBe(200)
        expect(new Uint8Array(await retained.arrayBuffer())).toEqual(png)
        if (reference !== "Undo") {
          expect((await releaseReference()).status).toBe(200)
          expect((await command("paper.deleteFile", { fileId })).status).toBe(
            200
          )
          expect((await bytes(fileId)).status).toBe(404)
        }
      } finally {
        await client.close()
      }
    }
  )
})
