import {
  blankBlockDocument,
  emptyCvDocument,
  paperPhotoRef,
  personActor,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { installRegistry } from "../registry/install.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function imageFile(bytes: Uint8Array, name: string, type = "image/png") {
  return new File([bytes], name, { type })
}

describe("CV photo bytes", () => {
  it("stores a file id, serves the owner and a share, and rejects another user or 3 MB", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Ada",
      email: "ada-photo@example.com",
    })
    const other = await signUp(app, {
      name: "Bea",
      email: "bea-photo@example.com",
    })
    const created = await app.request("/api/commands/paper.create", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({
        input: { kind: "cv", templateId: "with-photo", name: "Photo CV" },
      }),
    })
    expect(created.status).toBe(200)
    const docId = ((await created.json()) as { data: { id: string } }).data.id

    const uploaded = await app.request("/api/paper/files", {
      method: "POST",
      headers: { Origin: testWebOrigin, Cookie: owner.cookie },
      body: (() => {
        const form = new FormData()
        form.set("file", imageFile(png, "face.png"))
        return form
      })(),
    })
    expect(uploaded.status).toBe(200)
    const fileId = ((await uploaded.json()) as { data: { id: string } }).data.id
    const attached = await app.request("/api/commands/paper.attachPhoto", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({ input: { docId, fileId } }),
    })
    expect(attached.status).toBe(200)
    const attachment = (await attached.json()) as {
      data: { activityId: string; contentVersion: number }
    }
    expect(attachment.data.activityId).toEqual(expect.any(String))

    const stored = await app.request(`/api/paper/${docId}`, {
      headers: authHeaders(owner.cookie),
    })
    const storedText = await stored.text()
    expect(storedText).toContain(paperPhotoRef(fileId))
    expect(storedText).not.toContain("blob:")
    expect(storedText).not.toContain(Buffer.from(png).toString("base64"))

    const bytes = await app.request(`/api/paper/files/${fileId}/bytes`, {
      headers: authHeaders(owner.cookie),
    })
    expect(bytes.status).toBe(200)
    expect(bytes.headers.get("content-type")).toBe("image/png")
    expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(png)

    const hidden = await app.request(`/api/paper/files/${fileId}/bytes`, {
      headers: authHeaders(other.cookie),
    })
    expect(hidden.status).toBe(404)

    const shared = await app.request("/api/commands/paper.share", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({ input: { docId } }),
    })
    const token = ((await shared.json()) as { data: { token: string } }).data
      .token
    const publicPhoto = await app.request(`/api/paper/shared/${token}/photo`)
    expect(publicPhoto.status).toBe(200)
    expect(new Uint8Array(await publicPhoto.arrayBuffer())).toEqual(png)
    const missing = await app.request("/api/paper/shared/not-a-share/photo")
    expect(missing.status).toBe(404)

    const undone = await app.request("/api/commands/activity.undo", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({
        input: { activityId: attachment.data.activityId },
      }),
    })
    expect(undone.status).toBe(200)
    const cleared = await app.request(`/api/paper/${docId}`, {
      headers: authHeaders(owner.cookie),
    })
    const clearedText = await cleared.text()
    expect(clearedText).not.toContain("file:")
    expect(clearedText).not.toContain("blob:")

    const big = await app.request("/api/paper/files", {
      method: "POST",
      headers: { Origin: testWebOrigin, Cookie: owner.cookie },
      body: (() => {
        const form = new FormData()
        form.set("file", imageFile(new Uint8Array(3_000_000), "big.png"))
        return form
      })(),
    })
    expect(big.status).toBe(400)
    expect(await big.json()).toMatchObject({
      error: { message: "Photo must be 2 MB or smaller." },
    })

    const text = await app.request("/api/paper/files", {
      method: "POST",
      headers: { Origin: testWebOrigin, Cookie: owner.cookie },
      body: (() => {
        const form = new FormData()
        form.set(
          "file",
          new File(["hello"], "notes.txt", { type: "text/plain" })
        )
        return form
      })(),
    })
    expect(text.status).toBe(415)
    expect(await text.json()).toMatchObject({
      error: { message: "Upload an image." },
    })

    await client.close()
  })

  it("writes a version 2 header photo and refuses a blob url", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-photo-v2"
    await db.insert((await import("../db/schema.js")).user).values({
      id: userId,
      name: "Ada",
      email: "ada-photo-v2@example.com",
    })
    const actor = personActor(userId)
    await withDatabase(db, async () => {
      const { saveFile } = await import("./store.js")
      const { parseUserId } = await import("@workspace/domain")
      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "Blocks" },
        actor,
      })
      const docId = (created.output as { id: string }).id
      await registry.execute({
        name: "paper.replace",
        input: {
          docId,
          contentVersion: 1,
          document: blankBlockDocument(),
        },
        actor,
      })
      await expect(
        registry.execute({
          name: "paper.replace",
          input: {
            docId,
            contentVersion: 2,
            document: {
              ...emptyCvDocument(),
              photoUrl: "blob:http://localhost/photo",
            },
          },
          actor,
        })
      ).rejects.toThrow(/blob/i)

      const saved = await saveFile({
        userId: parseUserId(userId),
        name: "face.png",
        mediaType: "image/png",
        bytes: Buffer.from(png),
        purpose: "avatar",
      })
      const attached = await registry.execute({
        name: "paper.attachPhoto",
        input: { docId, fileId: saved.id },
        actor,
      })
      const view = attached.output as {
        document: { header: { photo?: string } }
      }
      expect(view.document.header.photo).toBe(paperPhotoRef(saved.id))
      const reversal = attached.reversal
      if (!reversal) throw new Error("missing reversal")
      await registry.execute({
        name: reversal.command,
        input: reversal.input,
        actor,
      })
      const cleared = (await registry.read("paper.get", { docId }, actor)) as {
        document: { header: { photo?: string } }
      }
      expect(cleared.document.header.photo).toBeUndefined()
    })
    await client.close()
  })
})
