import {
  blankCv,
  blankLetter,
  nativeProvenance,
  nativeSyncOutputSchema,
  NATIVE_WRITER,
  RICH_NATIVE_WRITER,
  paperPhotoRef,
  paperDocumentInfoSchema,
  paperViewSchema,
  parseUserId,
} from "@workspace/domain"
import { openRichPaperClient } from "@workspace/paper-crdt"
import { serve } from "@hono/node-server"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { createApp } from "../app.js"
import { codeLine, cookieHeader } from "../auth.fixtures.js"
import { getDb, withDatabase } from "../db/context.js"
import { paperDocs, paperDocUpdates } from "../db/schema.js"
import { testSessionSecret, testWebOrigin } from "../test/harness.js"
import { openStore } from "../test/paper-content.js"
import {
  richPaper,
  richElement,
  richFragment,
  richText,
} from "../test/rich-paper.js"
import { seedColumns } from "./content-document.js"
import { png } from "./photo.fixtures.js"
import { saveFile } from "./store.js"

const owner = parseUserId("rich-paper-http")
let store: Awaited<ReturnType<typeof openStore>>
beforeAll(async () => {
  store = await openStore(owner)
})
afterAll(async () => {
  await store.client.close()
})
const inDatabase = <T>(run: () => Promise<T>) => withDatabase(store.db, run)

async function responseData(response: Response): Promise<unknown> {
  const body: unknown = await response.json()
  if (!body || typeof body !== "object" || !("data" in body))
    throw new Error("Missing response data")
  return body.data
}

it("saves and reopens rich CVs and Letters over authenticated HTTP without legacy downgrade", async () => {
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
    throw new Error("Missing HTTP fixture port")
  const origin = `http://127.0.0.1:${address.port}`
  const app = createApp({
    db: store.db,
    authUrl: origin,
    sessionSecret: testSessionSecret,
    webOrigins: [testWebOrigin],
    rateLimitEnabled: false,
    sendCodeLimitEnabled: false,
    logAuthMail: true,
  })
  const post = (path: string, body: unknown, cookie = "") =>
    fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: testWebOrigin,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    })
  try {
    const email = `${owner}@example.com`
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    let otp: string | undefined
    try {
      expect(
        (
          await post("/api/auth/email-otp/send-verification-otp", {
            email,
            type: "sign-in",
          })
        ).ok
      ).toBe(true)
      otp = log.mock.calls
        .map((call) => String(call[0]).match(codeLine))
        .find((match) => match?.[1] === email)?.[3]
    } finally {
      log.mockRestore()
    }
    expect(otp).toBeDefined()
    const signed = await post("/api/auth/sign-in/email-otp", { email, otp })
    expect(signed.ok).toBe(true)
    const cookie = cookieHeader(signed)
    for (const kind of ["cv", "letter"] as const) {
      const { docId, document } = await inDatabase(async () => {
        const file = await saveFile({
          userId: owner,
          name: "portrait.png",
          mediaType: "image/png",
          bytes: Buffer.from(png),
          purpose: "avatar",
        })
        const document = richPaper(kind, paperPhotoRef(file.id))
        const result = await store.registry.execute({
          name: "paper.create",
          input: { kind, document: kind === "cv" ? blankCv() : blankLetter() },
          actor: store.actor,
        })
        const view = paperViewSchema.parse(result.output)
        await getDb()
          .update(paperDocs)
          .set(seedColumns(kind, document))
          .where(eq(paperDocs.id, view.id))
        return { docId: view.id, document }
      })
      const client = openRichPaperClient(null, {
        provenance: nativeProvenance(document),
      })
      const command = (input: unknown, session = cookie) =>
        post(
          "/api/commands/paper.nativeSync",
          { input, idempotencyKey: crypto.randomUUID() },
          session
        )
      const wire = (sent: ReturnType<typeof client.prepare>) => ({
        ...sent,
        docId,
        writer: RICH_NATIVE_WRITER,
        update: Buffer.from(sent.update).toString("base64"),
        stateVector: Buffer.from(sent.stateVector).toString("base64"),
      })
      const receive = async (
        sent: ReturnType<typeof client.prepare>,
        response: Response,
        target = client
      ) => {
        expect(response.status).toBe(200)
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
          testWebOrigin
        )
        const output = nativeSyncOutputSchema.parse(
          await responseData(response)
        )
        expect(
          target.receive(sent, {
            ...output,
            update: Buffer.from(output.update, "base64"),
            stateVector: Buffer.from(output.stateVector, "base64"),
          }).failed
        ).toBe(false)
      }
      try {
        const info = await fetch(`${origin}/api/paper/${docId}/document`, {
          headers: {
            Cookie: cookie,
            "x-paper-writer": JSON.stringify(RICH_NATIVE_WRITER),
          },
        })
        expect(info.status).toBe(200)
        expect(paperDocumentInfoSchema.parse(await responseData(info))).toEqual(
          {
            id: docId,
            name: expect.any(String),
            kind,
            format: "rich",
            provenance: nativeProvenance(document),
          }
        )
        expect(
          (
            await fetch(`${origin}/api/paper/${docId}/document`, {
              headers: {
                Cookie: cookie,
                "x-paper-writer": JSON.stringify(NATIVE_WRITER),
              },
            })
          ).status
        ).toBe(409)
        expect(
          (await fetch(`${origin}/api/paper/${docId}/document`)).status
        ).toBe(401)
        const pull = client.prepare()
        expect((await command(wire(pull), "")).status).toBe(401)
        expect(
          (await command({ ...wire(pull), writer: NATIVE_WRITER })).status
        ).toBe(409)
        await receive(pull, await command(wire(pull)))
        expect(client.document()).toEqual(document)
        richText(richElement(richFragment(client.ydoc), "cell-text")).insert(
          0,
          "HTTP saved "
        )
        const expected = client.document(),
          sent = client.prepare()
        const response = await command(wire(sent))
        expect(response.ok).toBe(true)
        richText(richElement(richFragment(client.ydoc), "after")).insert(
          0,
          "Still typing "
        )
        await receive(sent, response)
        expect(client.hasPending()).toBe(true)
        const second = client.prepare()
        await receive(second, await command(wire(second)))
        expect(client.hasPending()).toBe(false)
        expect(client.document()).not.toEqual(expected)
        const reopened = openRichPaperClient(null, {
          provenance: nativeProvenance(document),
        })
        try {
          const request = reopened.prepare()
          await receive(request, await command(wire(request)), reopened)
          expect(reopened.document()).toEqual(client.document())
        } finally {
          reopened.ydoc.destroy()
        }
        const stored = await inDatabase(async () => ({
          row: (
            await getDb()
              .select()
              .from(paperDocs)
              .where(eq(paperDocs.id, docId))
          )[0],
          log: await getDb()
            .select()
            .from(paperDocUpdates)
            .where(eq(paperDocUpdates.paperId, docId)),
        }))
        expect(stored.row?.crdtDocument).toEqual(client.document())
        expect(stored.row?.contentVersion).toBe(3)
        expect(stored.log).toHaveLength(2)
        const oldRead = await fetch(`${origin}/api/paper/${docId}`, {
          headers: {
            Cookie: cookie,
            Origin: testWebOrigin,
            "x-paper-writer": JSON.stringify(RICH_NATIVE_WRITER),
          },
        })
        expect(oldRead.status).toBe(409)
        expect(await oldRead.text()).toContain("rich Paper editor")
      } finally {
        client.ydoc.destroy()
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
}, 30000)
