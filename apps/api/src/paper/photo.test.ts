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
  testWebOrigin,
} from "../test/harness.js"
import { imageFile, pageWithPhoto, png, postAvatar } from "./photo.fixtures.js"

describe("CV photo bytes", () => {
  it("stores a file id, serves the owner, and rejects another user or 3 MB", async () => {
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

  it("stores the image type from the bytes and ignores the client Content-Type", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Ada",
      email: "ada-sniff@example.com",
    })
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
    const listed = await app.request("/api/reads/paper.files", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({}),
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
        input: { kind: "cv", name: "Sweep CV" },
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
    const [stored] = await db
      .select({ snapshot: paperDocs.snapshot })
      .from(paperDocs)
      .where(eq(paperDocs.id, docId))
    await db
      .update(paperDocs)
      .set({
        snapshot: pageWithPhoto(stored?.snapshot as Document, attachedId),
      })
      .where(eq(paperDocs.id, docId))

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
