import { type Document } from "@workspace/domain/paper-doc"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocs } from "../db/schema.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { richInfoRequest } from "../test/paper-live-pages.js"
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
      const [source] = await db
        .select({ snapshot: paperDocs.snapshot })
        .from(paperDocs)
        .where(eq(paperDocs.id, sourceId))
      const page = source?.snapshot as Document
      await db
        .update(paperDocs)
        .set({
          snapshot: {
            ...page,
            content: [
              ...page.content,
              {
                type: "image",
                attrs: {
                  id: "photo-1",
                  fileId,
                  widthMpt: 72000,
                  heightMpt: 72000,
                  align: "left",
                  alt: "Photo",
                },
              },
            ],
          },
        })
        .where(eq(paperDocs.id, sourceId))
      const duplicated = await command("paper.duplicate", {
        docId: sourceId,
      })
      expect(duplicated.status).toBe(200)
      const duplication = (await duplicated.json()) as {
        data: { id: string; activityId: string }
      }
      const copyId = duplication.data.id
      const deletedId = deletedKind === "source" ? sourceId : copyId
      const survivingId = deletedKind === "source" ? copyId : sourceId
      const deletion =
        deletedKind === "copy-undo"
          ? await command("activity.undo", {
              activityId: duplication.data.activityId,
            })
          : await command("paper.delete", { docId: deletedId })
      expect(deletion.status).toBe(200)

      const deleted = await app.request(
        "/api/reads/paper.read",
        richInfoRequest(deletedId, owner.cookie)
      )
      expect(deleted.status).toBe(404)
      const surviving = await app.request(
        "/api/reads/paper.read",
        richInfoRequest(survivingId, owner.cookie)
      )
      expect(surviving.status).toBe(200)
      const [kept] = await db
        .select({ snapshot: paperDocs.snapshot })
        .from(paperDocs)
        .where(eq(paperDocs.id, survivingId))
      expect(JSON.stringify(kept?.snapshot)).toContain(fileId)
      const bytes = await app.request(`/api/paper/files/${fileId}/bytes`, {
        headers: authHeaders(owner.cookie),
      })
      expect(bytes.status).toBe(200)
      expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(png)

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
