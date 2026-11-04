import { paperPhotoRef, personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { activity } from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"

import { imageFile, png, postAvatar } from "./photo.fixtures.js"

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

    const refused = await app.request("/api/commands/paper.attachPhoto", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({ input: { docId, fileId: null, quiet: true } }),
    })
    expect(refused.status).toBe(400)
    const kept = await app.request(`/api/paper/${docId}`, {
      headers: authHeaders(owner.cookie),
    })
    expect(await kept.text()).toContain(paperPhotoRef(fileId))

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

  it("writes a header photo and clears it when that attach is undone", async () => {
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
      await expect(
        registry.execute({
          name: "paper.attachPhoto",
          input: { docId, fileId: "blob:http://localhost/photo" },
          actor,
        })
      ).rejects.toThrow()

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
        paper: { header: { photo?: string } }
      }
      expect(view.paper.header.photo).toBe(paperPhotoRef(saved.id))
      const reversal = attached.reversal
      if (!reversal) throw new Error("missing reversal")
      expect(reversal).toMatchObject({
        command: "paper.attachPhoto",
        input: { docId, fileId: null },
      })
      expect(reversal.input).not.toHaveProperty("quiet")
      expect(attached.activityId).toEqual(expect.any(String))
      await registry.undo(userId, attached.activityId!)
      const cleared = (await registry.read("paper.get", { docId }, actor)) as {
        paper: { header: { photo?: string } }
      }
      expect(cleared.paper.header.photo).toBeUndefined()
      const rows = await db
        .select()
        .from(activity)
        .where(eq(activity.subjectId, docId))
      expect(
        rows.filter((row) => row.command === "paper.attachPhoto")
      ).toHaveLength(1)
      await expect(
        registry.execute({
          name: "paper.attachPhoto",
          input: { docId, fileId: saved.id, quiet: true },
          actor,
          idempotencyKey: "undo:client-supplied",
        })
      ).rejects.toThrow(/quiet/i)
      const visible = await registry.execute({
        name: "paper.attachPhoto",
        input: { docId, fileId: saved.id },
        actor,
        idempotencyKey: "undo:client-supplied",
      })
      expect(visible.activityId).toEqual(expect.any(String))
    })
    await client.close()
  })

  it("stores the image type from the bytes and ignores the client Content-Type", async () => {
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

  it("restores replaced photo bytes through Undo, including after the daily sweep", async () => {
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
    const replacement = await attach(secondId)
    expect(replacement.status).toBe(200)
    const replacementActivity = (await replacement.json()) as {
      data: { activityId: string }
    }

    const bytes = (fileId: string) =>
      app.request(`/api/paper/files/${fileId}/bytes`, {
        headers: authHeaders(owner.cookie),
      })
    const oldPhoto = await bytes(firstId)
    expect(oldPhoto.status).toBe(200)
    expect(new Uint8Array(await oldPhoto.arrayBuffer())).toEqual(png)

    const afterTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const sweep = () =>
      withDatabase(db, async () => {
        const { sweepUnattachedPhotos } = await import("./photo-sweep.js")
        return sweepUnattachedPhotos(afterTwoDays)
      })
    expect(await sweep()).not.toContain(firstId)
    expect((await bytes(firstId)).status).toBe(200)

    const undone = await app.request("/api/commands/activity.undo", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({
        input: { activityId: replacementActivity.data.activityId },
      }),
    })
    expect(undone.status).toBe(200)
    const reopened = await app.request(`/api/paper/${docId}`, {
      headers: authHeaders(owner.cookie),
    })
    expect(await reopened.text()).toContain(paperPhotoRef(firstId))
    const restored = await bytes(firstId)
    expect(restored.status).toBe(200)
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(png)

    expect(await sweep()).not.toContain(secondId)
    expect((await bytes(firstId)).status).toBe(200)
    expect((await bytes(secondId)).status).toBe(200)

    await client.close()
  })

  it("sweeps old orphan avatars while retaining document and profile photos", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Ada",
      email: "ada-sweep@example.com",
    })
    const created = await app.request("/api/commands/paper.create", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({
        input: { kind: "cv", templateId: "with-photo", name: "Sweep CV" },
      }),
    })
    expect(created.status).toBe(200)
    const docId = ((await created.json()) as { data: { id: string } }).data.id

    const upload = async (bytes: Uint8Array, name: string) =>
      (
        (await (
          await postAvatar(app, owner.cookie, bytes, name, "image/png")
        ).json()) as { data: { id: string } }
      ).data.id
    const attachedId = await upload(png, "kept.png")
    const orphanId = await upload(Uint8Array.from([...png, 0x02]), "orphan.png")
    const freshId = await upload(Uint8Array.from([...png, 0x03]), "fresh.png")
    const profileId = await upload(
      Uint8Array.from([...png, 0x04]),
      "profile.png"
    )
    const profile = await app.request("/api/commands/profile.setPhoto", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({ input: { fileId: profileId } }),
    })
    expect(profile.status).toBe(200)
    const attached = await app.request("/api/commands/paper.attachPhoto", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({ input: { docId, fileId: attachedId } }),
    })
    expect(attached.status).toBe(200)

    const { files } = await import("../db/schema.js")
    const { inArray } = await import("drizzle-orm")
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    await db
      .update(files)
      .set({ createdAt: twoDaysAgo })
      .where(inArray(files.id, [attachedId, orphanId, profileId]))

    const swept = await withDatabase(db, async () => {
      const { sweepUnattachedPhotos } = await import("./photo-sweep.js")
      return sweepUnattachedPhotos()
    })
    expect(swept).toEqual([orphanId])

    const bytes = async (fileId: string) =>
      app.request(`/api/paper/files/${fileId}/bytes`, {
        headers: authHeaders(owner.cookie),
      })
    expect((await bytes(attachedId)).status).toBe(200)
    expect((await bytes(freshId)).status).toBe(200)
    expect((await bytes(profileId)).status).toBe(200)
    expect((await bytes(orphanId)).status).toBe(404)

    await client.close()
  })
})

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
