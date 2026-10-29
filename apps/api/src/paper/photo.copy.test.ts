import { paperPhotoRef } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { png, postAvatar } from "./photo.fixtures.js"

describe("Copied CV photo lifetime", () => {
  it.each(["source", "copy", "copy-undo"])(
    "keeps shared photo bytes after deleting the %s CV",
    async (deletedKind) => {
      const { db, client } = await createMigratedTestDb()
      const app = createTestApp(db)
      const owner = await signUp(app, {
        name: "Ada",
        email: `ada-copy-${deletedKind}@example.com`,
      })
      const command = (name: string, input: object) =>
        app.request(`/api/commands/${name}`, {
          method: "POST",
          headers: authHeaders(owner.cookie),
          body: JSON.stringify({ input }),
        })
      const created = await command("paper.create", {
        kind: "cv",
        templateId: "with-photo",
        name: "Source CV",
      })
      expect(created.status).toBe(200)
      const sourceId = ((await created.json()) as { data: { id: string } }).data
        .id
      const uploaded = await postAvatar(
        app,
        owner.cookie,
        png,
        "face.png",
        "image/png"
      )
      expect(uploaded.status).toBe(200)
      const fileId = ((await uploaded.json()) as { data: { id: string } }).data
        .id
      expect(
        (await command("paper.attachPhoto", { docId: sourceId, fileId })).status
      ).toBe(200)
      const duplicated = await command("paper.duplicate", { docId: sourceId })
      expect(duplicated.status).toBe(200)
      const duplication = (await duplicated.json()) as {
        data: { id: string; activityId: string }
      }
      const copyId = duplication.data.id
      const deletedId = deletedKind === "source" ? sourceId : copyId
      const survivingId = deletedKind === "source" ? copyId : sourceId
      const shared = await command("paper.share", { docId: survivingId })
      expect(shared.status).toBe(200)
      const token = ((await shared.json()) as { data: { token: string } }).data
        .token
      if (deletedKind === "source") {
        const replacement = await postAvatar(
          app,
          owner.cookie,
          Uint8Array.from([...png, 0x02]),
          "replacement.png",
          "image/png"
        )
        expect(replacement.status).toBe(200)
        const replacementId = (
          (await replacement.json()) as {
            data: { id: string }
          }
        ).data.id
        expect(
          (
            await command("paper.attachPhoto", {
              docId: sourceId,
              fileId: replacementId,
            })
          ).status
        ).toBe(200)
        const afterReplace = await app.request(
          `/api/paper/shared/${token}/photo`
        )
        expect(afterReplace.status).toBe(200)
        expect(new Uint8Array(await afterReplace.arrayBuffer())).toEqual(png)
      }
      const deletion =
        deletedKind === "copy-undo"
          ? await command("activity.undo", {
              activityId: duplication.data.activityId,
            })
          : await command("paper.delete", { docId: deletedId })
      expect(deletion.status).toBe(200)

      const deleted = await app.request(`/api/paper/${deletedId}`, {
        headers: authHeaders(owner.cookie),
      })
      expect(deleted.status).toBe(404)
      const surviving = await app.request(`/api/paper/${survivingId}`, {
        headers: authHeaders(owner.cookie),
      })
      expect(surviving.status).toBe(200)
      expect(await surviving.text()).toContain(paperPhotoRef(fileId))
      const bytes = await app.request(`/api/paper/files/${fileId}/bytes`, {
        headers: authHeaders(owner.cookie),
      })
      expect(bytes.status).toBe(200)
      expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(png)
      const publicPhoto = await app.request(`/api/paper/shared/${token}/photo`)
      expect(publicPhoto.status).toBe(200)
      expect(new Uint8Array(await publicPhoto.arrayBuffer())).toEqual(png)

      const { sweepUnattachedPhotos } = await import("./photo-sweep.js")
      const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      await withDatabase(db, () => sweepUnattachedPhotos(future))
      const retained = await app.request(`/api/paper/files/${fileId}/bytes`, {
        headers: authHeaders(owner.cookie),
      })
      expect(retained.status).toBe(200)
      expect(
        (await command("paper.delete", { docId: survivingId })).status
      ).toBe(200)
      await withDatabase(db, () => sweepUnattachedPhotos(future))
      const collected = await app.request(`/api/paper/files/${fileId}/bytes`, {
        headers: authHeaders(owner.cookie),
      })
      expect(collected.status).toBe(404)
      await client.close()
    }
  )
})
