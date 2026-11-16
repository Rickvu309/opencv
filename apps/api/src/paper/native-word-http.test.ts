import { createHash, randomUUID } from "node:crypto"
import { writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import { serve } from "@hono/node-server"
import {
  canonicalPaper,
  nativeProvenance,
  nativeSyncOutputSchema,
  RICH_NATIVE_WRITER,
  parseUserId,
} from "@workspace/domain"
import { openRichPaperClient } from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { expect, it } from "vitest"
import {
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"
import { paperDocs, user } from "../db/schema.js"
import { richElement, richFragment, richText } from "../test/rich-paper.js"
import {
  savedRichWord,
  wordHeaders,
  portraitBytes,
} from "./native-word.test-support.js"
import { readPackageZip } from "./package-zip.js"
import { parsePackageXml } from "./package-xml.js"
import { textOf } from "./native-output/inspect.test-support.js"
import { WORD_PACKAGE_MEDIA_TYPE } from "./package-store.js"

async function responseData(response: Response): Promise<unknown> {
  const body: unknown = await response.json()
  if (!body || typeof body !== "object" || !("data" in body))
    throw new Error("Missing response data")
  return body.data
}

it("downloads real saved CV and Letter HTTP edits, refuses stale requests and preserves exact DOCX artifacts", async () => {
  const { db, client: database } = await createMigratedTestDb()
  const app = createTestApp(db)
  const server = serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request) => app.fetch(request),
  })
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve)
    server.once("error", reject)
  })
  const address = server.address()
  if (!address || typeof address === "string")
    throw new Error("Missing HTTP port")
  const origin = `http://127.0.0.1:${address.port}`
  try {
    const owner = await signUp(app, {
      name: "Linh",
      email: "word-http@example.com",
    })
    const stranger = await signUp(app, {
      name: "Other",
      email: "word-http-other@example.com",
    })
    const [person] = await db
      .select()
      .from(user)
      .where(eq(user.email, owner.user.email))
    if (!person) throw new Error("Missing owner")
    for (const kind of ["cv", "letter"] as const) {
      const saved = await savedRichWord(db, parseUserId(person.id), kind)
      const documentClient = openRichPaperClient(null, {
        provenance: nativeProvenance(saved.document),
      })
      const sync = async () => {
        const sent = documentClient.prepare()
        const response = await fetch(
          `${origin}/api/commands/paper.nativeSync`,
          {
            method: "POST",
            headers: {
              Cookie: owner.cookie,
              Origin: testWebOrigin,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              idempotencyKey: randomUUID(),
              input: {
                ...sent,
                docId: saved.id,
                writer: RICH_NATIVE_WRITER,
                update: Buffer.from(sent.update).toString("base64"),
                stateVector: Buffer.from(sent.stateVector).toString("base64"),
              },
            }),
          }
        )
        expect(response.status).toBe(200)
        const output = nativeSyncOutputSchema.parse(
          await responseData(response)
        )
        expect(
          documentClient.receive(sent, {
            ...output,
            update: Buffer.from(output.update, "base64"),
            stateVector: Buffer.from(output.stateVector, "base64"),
          }).failed
        ).toBe(false)
        return {
          provenance: output.provenance,
          epoch: output.epoch,
          revision: output.revision,
          digest: createHash("sha256")
            .update(canonicalPaper(documentClient.document()))
            .digest("hex"),
        }
      }
      const url = `${origin}/api/paper/${saved.id}/native-word?kind=${kind}`
      try {
        await sync()
        richText(
          richElement(richFragment(documentClient.ydoc), "cell-text")
        ).insert(0, "Saved over HTTP — ")
        const basis = await sync()
        const before = await db
          .select()
          .from(paperDocs)
          .where(eq(paperDocs.id, saved.id))
        const response = await fetch(url, {
          headers: wordHeaders(owner.cookie, basis),
        })
        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe(
          WORD_PACKAGE_MEDIA_TYPE
        )
        expect(response.headers.get("cache-control")).toBe("private, no-store")
        expect(response.headers.get("x-content-type-options")).toBe("nosniff")
        expect(response.headers.get("content-disposition")).toContain(
          "filename*=UTF-8''Linh%20Vi%E1%BB%87t"
        )
        expect(
          JSON.parse(response.headers.get("x-paper-basis") ?? "null")
        ).toEqual(basis)
        const bytes = new Uint8Array(await response.arrayBuffer())
        const archive = await readPackageZip(bytes)
        expect(archive.files.get("word/media/photo1.png")).toEqual(
          portraitBytes
        )
        const xml = archive.files.get("word/document.xml")
        if (!xml) throw new Error("Missing Word body")
        const part = parsePackageXml(xml)
        expect(textOf(part, part.root)).toContain("Saved over HTTP — Việt")
        expect(
          await db.select().from(paperDocs).where(eq(paperDocs.id, saved.id))
        ).toEqual(before)
        expect((await fetch(url)).status).toBe(401)
        expect(
          (await fetch(url, { headers: wordHeaders(stranger.cookie, basis) }))
            .status
        ).toBe(404)
        expect(
          (
            await fetch(url, {
              headers: wordHeaders(owner.cookie, saved.basis),
            })
          ).status
        ).toBe(409)
        expect(
          (
            await fetch(url, {
              headers: {
                ...wordHeaders(owner.cookie, basis),
                "x-paper-basis": "{",
              },
            })
          ).status
        ).toBe(400)
        expect(
          (await fetch(url, { headers: { Cookie: owner.cookie } })).status
        ).toBe(400)
        expect(
          (
            await fetch(
              `${origin}/api/paper/${randomUUID()}/native-word?kind=${kind}`,
              { headers: wordHeaders(owner.cookie, basis) }
            )
          ).status
        ).toBe(404)
        const artifacts = join(homedir(), "tmp/paper-autopilot/1574-render")
        await mkdir(artifacts, { recursive: true })
        await writeFile(join(artifacts, `${kind}.docx`), bytes)
      } finally {
        documentClient.ydoc.destroy()
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
    await database.close()
  }
})
