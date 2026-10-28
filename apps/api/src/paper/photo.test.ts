import {
  blankBlockDocument,
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
      const blobDocument = blankBlockDocument()
      blobDocument.header.photo = "blob:http://localhost/photo"
      await expect(
        registry.execute({
          name: "paper.replace",
          input: {
            docId,
            contentVersion: 2,
            document: blobDocument,
          },
          actor,
        })
      ).rejects.toThrow("Invalid content")

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

  it("sniffs avatar bytes, rejects other types, and sets safe response headers", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Ada",
      email: "ada-sniff@example.com",
    })
    const created = await app.request("/api/commands/paper.create", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({
        input: { kind: "cv", templateId: "with-photo", name: "Sniff CV" },
      }),
    })
    const docId = ((await created.json()) as { data: { id: string } }).data.id

    const svg = await postAvatar(
      app,
      owner.cookie,
      new TextEncoder().encode(
        "<svg xmlns='http://www.w3.org/2000/svg'></svg>"
      ),
      "face.svg",
      "image/svg+xml"
    )
    expect(svg.status).toBe(415)
    expect(await svg.json()).toMatchObject({
      error: { message: "Upload an image." },
    })

    const text = await postAvatar(
      app,
      owner.cookie,
      new TextEncoder().encode("not an image file"),
      "not-image.png",
      "image/png"
    )
    expect(text.status).toBe(415)
    expect(await text.json()).toMatchObject({
      error: { message: "Upload an image." },
    })

    const lying = await postAvatar(
      app,
      owner.cookie,
      png,
      "face.svg",
      "image/svg+xml"
    )
    expect(lying.status).toBe(200)
    const fileId = ((await lying.json()) as { data: { id: string } }).data.id
    const listed = await app.request("/api/paper/files", {
      headers: authHeaders(owner.cookie),
    })
    const files = (
      (await listed.json()) as { data: { id: string; mediaType: string }[] }
    ).data
    expect(files.find((file) => file.id === fileId)?.mediaType).toBe(
      "image/png"
    )

    const bytes = await app.request(`/api/paper/files/${fileId}/bytes`, {
      headers: authHeaders(owner.cookie),
    })
    expectPhotoHeaders(bytes, "image/png", "png", "private, no-store")

    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])
    const jpegSaved = await postAvatar(
      app,
      owner.cookie,
      jpeg,
      "face.png",
      "image/png"
    )
    const jpegId = ((await jpegSaved.json()) as { data: { id: string } }).data
      .id
    const jpegBytes = await app.request(`/api/paper/files/${jpegId}/bytes`, {
      headers: authHeaders(owner.cookie),
    })
    expectPhotoHeaders(jpegBytes, "image/jpeg", "jpg", "private, no-store")

    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0x18, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ])
    const webpSaved = await postAvatar(
      app,
      owner.cookie,
      webp,
      "face.gif",
      "image/gif"
    )
    const webpId = ((await webpSaved.json()) as { data: { id: string } }).data
      .id
    const webpBytes = await app.request(`/api/paper/files/${webpId}/bytes`, {
      headers: authHeaders(owner.cookie),
    })
    expectPhotoHeaders(webpBytes, "image/webp", "webp", "private, no-store")

    const gif = new TextEncoder().encode("GIF89a")
    const gifSaved = await postAvatar(
      app,
      owner.cookie,
      gif,
      "face.png",
      "image/png"
    )
    const gifId = ((await gifSaved.json()) as { data: { id: string } }).data.id
    const gifBytes = await app.request(`/api/paper/files/${gifId}/bytes`, {
      headers: authHeaders(owner.cookie),
    })
    expectPhotoHeaders(gifBytes, "image/gif", "gif", "private, no-store")

    const attached = await app.request("/api/commands/paper.attachPhoto", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({ input: { docId, fileId } }),
    })
    expect(attached.status).toBe(200)
    const shared = await app.request("/api/commands/paper.share", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({ input: { docId } }),
    })
    const token = ((await shared.json()) as { data: { token: string } }).data
      .token
    const publicPhoto = await app.request(`/api/paper/shared/${token}/photo`)
    expectPhotoHeaders(publicPhoto, "image/png", "png", "public, max-age=60")

    await client.close()
  })

  it("deletes the previous avatar on replace and the avatar when the CV is deleted", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Ada",
      email: "ada-orphan@example.com",
    })
    const created = await app.request("/api/commands/paper.create", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({
        input: { kind: "cv", templateId: "with-photo", name: "Orphan CV" },
      }),
    })
    const docId = ((await created.json()) as { data: { id: string } }).data.id
    const first = await postAvatar(
      app,
      owner.cookie,
      png,
      "one.png",
      "image/png"
    )
    const firstId = ((await first.json()) as { data: { id: string } }).data.id
    const secondBytes = Uint8Array.from([...png, 0x02])
    const second = await postAvatar(
      app,
      owner.cookie,
      secondBytes,
      "two.png",
      "image/png"
    )
    const secondId = ((await second.json()) as { data: { id: string } }).data.id

    const attach = (fileId: string) =>
      app.request("/api/commands/paper.attachPhoto", {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ input: { docId, fileId } }),
      })
    expect((await attach(firstId)).status).toBe(200)
    expect((await attach(secondId)).status).toBe(200)

    const afterReplace = await app.request("/api/paper/files", {
      headers: authHeaders(owner.cookie),
    })
    const ids = (
      (await afterReplace.json()) as { data: { id: string }[] }
    ).data.map((file) => file.id)
    expect(ids).toEqual([secondId])
    const gone = await app.request(`/api/paper/files/${firstId}/bytes`, {
      headers: authHeaders(owner.cookie),
    })
    expect(gone.status).toBe(404)
    const stored = await app.request(`/api/paper/${docId}`, {
      headers: authHeaders(owner.cookie),
    })
    expect(await stored.text()).toContain(paperPhotoRef(secondId))

    const deleted = await app.request("/api/commands/paper.delete", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({ input: { docId } }),
    })
    expect(deleted.status).toBe(200)
    const afterDelete = await app.request("/api/paper/files", {
      headers: authHeaders(owner.cookie),
    })
    expect(((await afterDelete.json()) as { data: unknown[] }).data).toEqual([])

    await client.close()
  })
})

function formFile(bytes: Uint8Array, name: string, type: string) {
  const form = new FormData()
  form.set("file", imageFile(bytes, name, type))
  return form
}

function postAvatar(
  app: ReturnType<typeof createTestApp>,
  cookie: string,
  bytes: Uint8Array,
  name: string,
  type: string
) {
  return app.request("/api/paper/files", {
    method: "POST",
    headers: { Origin: testWebOrigin, Cookie: cookie },
    body: formFile(bytes, name, type),
  })
}

function expectPhotoHeaders(
  res: Response,
  mime: string,
  ext: string,
  cache: string
) {
  expect(res.status).toBe(200)
  expect(res.headers.get("content-type")).toBe(mime)
  expect(res.headers.get("x-content-type-options")).toBe("nosniff")
  expect(res.headers.get("content-disposition")).toBe(
    `inline; filename="photo.${ext}"`
  )
  expect(res.headers.get("cache-control")).toBe(cache)
}
