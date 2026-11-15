import {
  NATIVE_WRITER,
  nativeProvenance,
  nativeSyncOutputSchema,
  nativePaperDocumentSchema,
  paperViewSchema,
  parseUserId,
} from "@workspace/domain"
import { serve } from "@hono/node-server"
import { eq } from "drizzle-orm"
import { beforeAll, afterAll, expect, it, vi } from "vitest"
import { createApp } from "../app.js"
import { codeLine, cookieHeader } from "../auth.fixtures.js"
import { getDb, withDatabase } from "../db/context.js"
import { paperDocs, paperDocUpdates } from "../db/schema.js"
import { testSessionSecret, testWebOrigin } from "../test/harness.js"
import { openStore } from "../test/paper-content.js"
import { seedColumns } from "./content-document.js"
const owner = parseUserId("native-b-http")
let store: Awaited<ReturnType<typeof openStore>>
beforeAll(async () => {
  store = await openStore(owner)
})
afterAll(async () => {
  await store.client.close()
})
const inDatabase = <T>(run: () => Promise<T>) => withDatabase(store.db, run)
const native = (text = "Việt 😀 team") =>
  nativePaperDocumentSchema.parse({
    version: 4,
    schemaRevision: 1,
    kind: "letter",
    clashes: [],
    blocks: [
      { id: "p1", type: "paragraph", content: [{ text, underline: true }] },
    ],
  })
const legacy = {
  version: 3,
  kind: "letter",
  clashes: [],
  blocks: [{ id: "p1", type: "paragraph", content: "Dear team" }],
}
async function seeded() {
  const result = await store.registry.execute({
    name: "paper.create",
    input: { kind: "letter", document: legacy },
    actor: store.actor,
  })
  const view = paperViewSchema.parse(result.output)
  await getDb()
    .update(paperDocs)
    .set(seedColumns("letter", native()))
    .where(eq(paperDocs.id, view.id))
  return view.id
}
async function snapshot(docId: string) {
  return {
    row: (
      await getDb().select().from(paperDocs).where(eq(paperDocs.id, docId))
    )[0]!,
    log: await getDb()
      .select()
      .from(paperDocUpdates)
      .where(eq(paperDocUpdates.paperId, docId)),
  }
}
const responseData = async (response: Response): Promise<unknown> => {
  const body: unknown = await response.json()
  if (!body || typeof body !== "object" || !("data" in body))
    throw new Error("Missing response data")
  return body.data
}
const read = async (docId: string) =>
  paperViewSchema.parse(
    await store.registry.read(
      "paper.get",
      { docId, writer: NATIVE_WRITER },
      store.actor
    )
  )
it("admits native HTTP reads and writes while refused requests leave canonical data unchanged", async () => {
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
    for (const [method, path, requestHeaders] of [
      ["GET", "/api/paper", "x-paper-writer"],
      ["POST", "/api/commands/paper.edit", "content-type,x-paper-writer"],
    ]) {
      const preflight = await fetch(`${origin}${path}`, {
        method: "OPTIONS",
        headers: {
          Origin: testWebOrigin,
          "Access-Control-Request-Method": method!,
          "Access-Control-Request-Headers": requestHeaders!,
        },
      })
      expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(
        testWebOrigin
      )
      expect(preflight.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true"
      )
      expect(
        preflight.headers.get("Access-Control-Allow-Headers")?.toLowerCase()
      ).toContain("x-paper-writer")
    }
    const denied = await fetch(`${origin}/api/paper`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://denied.example",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "x-paper-writer",
      },
    })
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull()
    const email = `${owner}@example.com`
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    let otp: string | undefined
    try {
      const sent = await post("/api/auth/email-otp/send-verification-otp", {
        email,
        type: "sign-in",
      })
      expect(sent.ok).toBe(true)
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
    const docId = await inDatabase(seeded)
    const before = await inDatabase(() => snapshot(docId))
    const get = (writer?: string, session = cookie) =>
      fetch(`${origin}/api/paper/${docId}`, {
        headers: {
          Cookie: session,
          Origin: testWebOrigin,
          ...(writer === undefined ? {} : { "x-paper-writer": writer }),
        },
      })
    expect((await get(JSON.stringify(NATIVE_WRITER), "")).status).toBe(401)
    for (const [writer, status] of [
      [undefined, 409],
      ["{", 400],
      [JSON.stringify({ ...NATIVE_WRITER, extra: true }), 400],
      [
        JSON.stringify({ ...NATIVE_WRITER, supportedSchemaRevisions: [2] }),
        409,
      ],
    ] as const)
      expect((await get(writer)).status).toBe(status)
    expect(await inDatabase(() => snapshot(docId))).toEqual(before)
    const readResponse = await get(JSON.stringify(NATIVE_WRITER))
    expect(readResponse.ok).toBe(true)
    expect(readResponse.headers.get("Access-Control-Allow-Origin")).toBe(
      testWebOrigin
    )
    expect(readResponse.headers.get("Access-Control-Allow-Credentials")).toBe(
      "true"
    )
    const current = paperViewSchema.parse(await responseData(readResponse))
    const command = (name: string, input: unknown, session = cookie) =>
      post(
        `/api/commands/${name}`,
        { input, idempotencyKey: crypto.randomUUID() },
        session
      )
    const editedPaper = native("Việt 😀 colleagues")
    const input = {
      docId,
      writer: NATIVE_WRITER,
      basedOn: current.contentVersion,
      nativeBasis: current.nativeBasis,
      edits: [
        {
          op: "setText",
          blockId: "p1",
          text: "Việt 😀 colleagues",
        },
      ],
    }
    expect(
      (
        await command("paper.edit", {
          ...input,
          nativeBasis: { ...current.nativeBasis, digest: "0".repeat(64) },
        })
      ).status
    ).toBe(409)
    expect((await command("paper.edit", input, "")).status).toBe(401)
    expect(await inDatabase(() => snapshot(docId))).toEqual(before)
    const edited = await command("paper.edit", input)
    expect(edited.ok).toBe(true)
    const receipt = await responseData(edited)
    if (!receipt || typeof receipt !== "object" || !("activityId" in receipt))
      throw new Error("Missing activity receipt")
    const stale = await command("paper.edit", input)
    expect(stale.status).toBe(409)
    const afterEdit = await inDatabase(() => snapshot(docId))
    expect(afterEdit.row.crdtDocument).toEqual(editedPaper)
    expect(
      (
        await command("paper.rename", {
          docId,
          name: "HTTP native",
          writer: NATIVE_WRITER,
        })
      ).ok
    ).toBe(true)
    expect(
      (
        await command("paper.setStatus", {
          docId,
          status: "draft",
          writer: NATIVE_WRITER,
        })
      ).ok
    ).toBe(true)
    const duplicate = await command("paper.duplicate", {
      docId,
      writer: NATIVE_WRITER,
    })
    expect(duplicate.ok).toBe(true)
    const duplicated = paperViewSchema
      .strip()
      .parse(await responseData(duplicate))
    expect(duplicated.paper).toEqual(editedPaper)
    const reverted = await command("activity.undo", {
      activityId: receipt.activityId,
    })
    expect(reverted.ok).toBe(true)
    expect((await inDatabase(() => read(docId))).paper).toEqual(native())
    const legacyCreated = await command("paper.create", {
      kind: "letter",
      document: legacy,
    })
    expect(legacyCreated.ok).toBe(true)
    const legacyView = paperViewSchema
      .strip()
      .parse(await responseData(legacyCreated))
    expect(
      (
        await fetch(`${origin}/api/paper/${legacyView.id}`, {
          headers: { Cookie: cookie },
        })
      ).ok
    ).toBe(true)
    const nativeInput = {
      docId,
      writer: NATIVE_WRITER,
      provenance: nativeProvenance(native()),
      epoch: 0,
      update: "",
      stateVector: "",
    }
    const nativeBefore = await inDatabase(() => snapshot(docId))
    const legacyBefore = await inDatabase(() => snapshot(legacyView.id))
    expect((await command("paper.nativeSync", nativeInput, "")).status).toBe(
      401
    )
    for (const [input, expected] of [
      [{ ...nativeInput, writer: undefined }, 400],
      [{ ...nativeInput, writer: { ...NATIVE_WRITER, capabilities: [] } }, 409],
      [
        {
          ...nativeInput,
          provenance: { ...nativeInput.provenance, schemaRevision: 2 },
        },
        400,
      ],
      [{ ...nativeInput, docId: legacyView.id }, 400],
    ] as const) {
      expect((await command("paper.nativeSync", input)).status).toBe(expected)
      expect(await inDatabase(() => snapshot(docId))).toEqual(nativeBefore)
      expect(await inDatabase(() => snapshot(legacyView.id))).toEqual(
        legacyBefore
      )
    }
    const synced = await command("paper.nativeSync", nativeInput)
    expect(synced.ok).toBe(true)
    const syncedOutput = await responseData(synced)
    expect(nativeSyncOutputSchema.parse(syncedOutput).provenance).toEqual(
      nativeInput.provenance
    )
    expect(syncedOutput).not.toHaveProperty("activityId")
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
}, 30000)
