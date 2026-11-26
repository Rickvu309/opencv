import { parseUserId } from "@workspace/domain/kernel"
import { paperPhotoRef } from "@workspace/domain/paper-doc"
import { eq } from "drizzle-orm"
import { expect, it } from "vitest"
import { withDatabase } from "../db/context.js"
import { files, user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { readPackageZip } from "./import/package-zip.js"
import { saveFile } from "./store.js"
import { compileOwnedLayoutNativeDocx } from "./owned-word-output.js"
import {
  paragraph,
  presentation,
} from "./native-output/formatted.test-support.js"

const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6gAAAABJRU5ErkJggg==",
  "base64"
)

function document(source: string) {
  return {
    profile: "private-layout-2",
    kind: "letter",
    presentation: presentation(),
    flow: {
      id: "flow",
      type: "flow",
      children: [
        {
          id: "photo",
          type: "photo",
          source,
          width: 1800,
          height: 1800,
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          rotation: 0,
          shape: "rectangle",
          placement: { kind: "block", alignment: "left" },
          spacing: { top: 0, right: 0, bottom: 0, left: 0 },
          alt: "Owned portrait",
        },
        paragraph("body", "Editable letter"),
      ],
    },
  }
}

it("resolves owned photo bytes and refuses foreign, deleted and non-photo files", async () => {
  const { db, client } = await createMigratedTestDb()
  const owner = parseUserId("word-photo-owner")
  const other = parseUserId("word-photo-other")
  try {
    await db.insert(user).values([
      { id: owner, name: "Ada", email: "word-photo-owner@example.com" },
      { id: other, name: "Bea", email: "word-photo-other@example.com" },
    ])
    await withDatabase(db, async () => {
      const owned = await saveFile({
        userId: owner,
        name: "portrait.png",
        mediaType: "image/png",
        bytes,
        purpose: "avatar",
      })
      const input = {
        userId: owner,
        document: document(paperPhotoRef(owned.id)),
      }
      const result = await compileOwnedLayoutNativeDocx(input)
      if (result.kind === "refused") throw new Error(result.reason)
      const archive = await readPackageZip(result.value)
      expect(archive.files.get("word/media/photo1.png")).toEqual(bytes)
      expect(
        await compileOwnedLayoutNativeDocx({ ...input, userId: other })
      ).toMatchObject({ kind: "refused", reason: "Photo file not found" })
      await db
        .update(files)
        .set({ purpose: "import" })
        .where(eq(files.id, owned.id))
      expect(await compileOwnedLayoutNativeDocx(input)).toMatchObject({
        kind: "refused",
        reason: "Photo file not found",
      })
      await db.delete(files).where(eq(files.id, owned.id))
      expect(await compileOwnedLayoutNativeDocx(input)).toMatchObject({
        kind: "refused",
        reason: "Photo file not found",
      })
    })
  } finally {
    await client.close()
  }
})
