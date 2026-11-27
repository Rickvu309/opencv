import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { delegateActorSchema } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { registry } from "../registry/registry.js"
import {
  expectListIsLivePages,
  richInfoRequest,
} from "../test/paper-live-pages.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"
import { textDocx, textPdf } from "./import/import-fixtures.test.js"
import { PAGE_STORE_FILES, pageInsertingExports } from "./page-writes.js"

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

type Made = {
  docId: string
  kind: "cv" | "letter"
  version: number
  copyOf?: string
}
type Account = { cookie: string; userId: string }
type App = ReturnType<typeof createTestApp>
type Maker = (app: App, owner: Account) => Promise<Made>

const dataOf = z.object({ data: z.unknown() })
const idOf = z.object({
  docId: z.string().uuid().optional(),
  id: z.string().uuid().optional(),
})
const engineDoc = z.object({ doc: z.unknown() }).passthrough()
const listOf = z.array(
  z
    .object({ id: z.string(), kind: z.string(), format: z.string().optional() })
    .passthrough()
)

async function command(
  app: App,
  owner: Account,
  name: string,
  input: unknown
): Promise<unknown> {
  const response = await app.request(`/api/commands/${name}`, {
    method: "POST",
    headers: authHeaders(owner.cookie),
    body: JSON.stringify({ input, idempotencyKey: randomUUID() }),
  })
  expect(response.status, `${name}: ${await response.clone().text()}`).toBe(200)
  return dataOf.parse(await response.json()).data
}

function docIdOf(data: unknown): string {
  const parsed = idOf.parse(data)
  const docId = parsed.docId ?? parsed.id
  if (!docId) throw new Error(`no document id in ${JSON.stringify(data)}`)
  return docId
}

async function importFile(
  app: App,
  owner: Account,
  bytes: Buffer,
  name: string,
  type: string,
  engine?: 2
) {
  const form = new FormData()
  form.set("file", new File([new Uint8Array(bytes)], name, { type }))
  const response = await app.request(
    engine ? "/api/paper/import?engine=2" : "/api/paper/import",
    {
      method: "POST",
      headers: { Origin: testWebOrigin, Cookie: owner.cookie },
      body: form,
    }
  )
  expect(response.status, await response.clone().text()).toBe(200)
  return docIdOf(dataOf.parse(await response.json()).data)
}

async function importWord(app: App, owner: Account) {
  return importFile(
    app,
    owner,
    textDocx("Imported for a copy"),
    "Copy source.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
}

const made = (docId: string, version: 0 | 1, copyOf?: string): Made => ({
  docId,
  kind: "cv",
  version,
  ...(copyOf ? { copyOf } : {}),
})

async function duplicated(app: App, owner: Account, source: string) {
  return made(
    docIdOf(
      await command(app, owner, "paper.duplicate", {
        docId: source,
        writer: RICH_NATIVE_WRITER,
      })
    ),
    0,
    source
  )
}

const ENGINE_IMPORT_CASE = "Import a Word file into the new editor"

const CASES: Record<string, Maker> = {
  "Coach start (paper.start)": async (app, owner) =>
    made(
      docIdOf(
        await command(app, owner, "paper.start", {
          kind: "cv",
          templateId: "modern",
        })
      ),
      0
    ),
  "Import a Word file": async (app, owner) =>
    made(
      await importFile(
        app,
        owner,
        textDocx("Imported Word words"),
        "Imported.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ),
      1
    ),
  [ENGINE_IMPORT_CASE]: async (app, owner) =>
    made(
      await importFile(
        app,
        owner,
        textDocx("Imported Word words"),
        "Imported.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        2
      ),
      1
    ),
  "Import a PDF": async (app, owner) =>
    made(
      await importFile(
        app,
        owner,
        textPdf("Imported PDF words"),
        "Imported.pdf",
        "application/pdf"
      ),
      1
    ),
  "Import a text file": async (app, owner) =>
    made(
      await importFile(
        app,
        owner,
        Buffer.from("Imported text words\nSecond line\n"),
        "Imported.txt",
        "text/plain"
      ),
      1
    ),
  "Duplicate an imported page (paper.duplicate)": async (app, owner) =>
    duplicated(app, owner, await importWord(app, owner)),
  "Rich document (paper.create)": async (app, owner) =>
    made(
      docIdOf(
        await command(app, owner, "paper.create", {
          kind: "cv",
          name: "Rich CV",
          templateId: "modern",
        })
      ),
      0
    ),
  "Duplicate a rich document (paper.duplicate)": async (app, owner) =>
    duplicated(
      app,
      owner,
      docIdOf(
        await command(app, owner, "paper.create", {
          kind: "cv",
          name: "Rich CV to copy",
          templateId: "modern",
        })
      )
    ),
}

const CREATOR_EXPORTS: Record<string, string[]> = {
  "paper/store.ts#duplicatePaper": Object.keys(CASES).filter((name) =>
    name.startsWith("Duplicate")
  ),
  "paper/store.ts#createEngineImportPage": [
    "Import a Word file",
    ENGINE_IMPORT_CASE,
    "Import a PDF",
    "Import a text file",
  ],
  "paper/store.ts#createPaper": [
    "Rich document (paper.create)",
    "Duplicate a rich document (paper.duplicate)",
    "Coach start (paper.start)",
  ],
}

const CREATOR_COMMANDS = [
  "paper.create",
  "paper.duplicate",
  "paper.import",
  "paper.start",
]

describe("every store function that inserts a page has cases", () => {
  it("names exactly the exported store functions that insert a page row", () => {
    const stores = PAGE_STORE_FILES.map((relative) => ({
      path: relative,
      text: readFileSync(path.join(srcRoot, relative), "utf8"),
    }))
    expect(
      pageInsertingExports(stores),
      "A store function that inserts a page needs its cases in CREATOR_EXPORTS and CASES"
    ).toEqual(Object.keys(CREATOR_EXPORTS).sort())
  })

  it("covers every store function with a real case, and every case belongs to one", () => {
    const named = new Set(Object.values(CREATOR_EXPORTS).flat())
    expect([...named].filter((name) => !(name in CASES))).toEqual([])
    expect(Object.keys(CASES).filter((name) => !named.has(name))).toEqual([])
    for (const cases of Object.values(CREATOR_EXPORTS))
      expect(cases.length).toBeGreaterThan(0)
  })

  it("keeps the person's own agent door to its nine operations, none of which makes a page", async () => {
    installRegistry()
    const tools = (
      await registry.tools(
        delegateActorSchema.parse({
          type: "delegate",
          userId: "user-page-creators",
          connectionId: "11111111-1111-4111-8111-111111111111",
          name: "Agent",
          scopes: ["job.read", "job.write", "paper.read", "paper.write"],
          resources: "jobs-and-paper",
          reads: "allow",
          writes: "approval",
        })
      )
    ).map((tool) => tool.name)
    expect(tools).toHaveLength(9)
    expect(tools.filter((name) => CREATOR_COMMANDS.includes(name))).toEqual([])
  })
})

describe("a page made any way is listed, opens, and stays hidden from others", () => {
  let app: App
  let close: () => Promise<void>
  let stranger: Account
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]

  async function account(name: string): Promise<Account> {
    const email = `${randomUUID()}@test.invalid`
    const signed = await signUp(app, { name, email })
    const row = await withDatabase(db, async () =>
      db.select({ id: user.id }).from(user).where(eq(user.email, email))
    )
    return { cookie: signed.cookie, userId: row[0]?.id ?? "" }
  }

  async function listed(who: Account) {
    const response = await app.request("/api/reads/paper.list", {
      method: "POST",
      headers: authHeaders(who.cookie),
      body: JSON.stringify({ writer: RICH_NATIVE_WRITER }),
    })
    expect(response.status).toBe(200)
    return listOf.parse(dataOf.parse(await response.json()).data)
  }

  async function routeReads(who: Account, docId: string) {
    const get = await app.request(`/api/paper/${docId}`, {
      headers: authHeaders(who.cookie),
    })
    const read = await app.request("/api/reads/paper.read", {
      method: "POST",
      headers: authHeaders(who.cookie),
      body: JSON.stringify({ docId }),
    })
    const shape = async (response: Response) => ({
      status: response.status,
      body: (await response.text()).replaceAll(docId, "<id>"),
    })
    return { get: await shape(get), read: await shape(read) }
  }

  beforeAll(async () => {
    const opened = await createMigratedTestDb()
    db = opened.db
    close = () => opened.client.close()
    app = createTestApp(db)
    stranger = await account("Stranger")
  })

  afterAll(async () => {
    await close?.()
  })

  it.each(Object.keys(CASES))("%s", async (name) => {
    const maker = CASES[name]
    if (!maker) throw new Error(name)
    const creator = await account(`Owner of ${name}`)
    const page = await withDatabase(db, () => maker(app, creator))
    const engineRead = (who: Account, docId: string) =>
      app.request("/api/reads/paper.read", {
        method: "POST",
        headers: authHeaders(who.cookie),
        body: JSON.stringify({ docId, view: "engine" }),
      })
    const opened = await engineRead(creator, page.docId)
    expect(opened.status, await opened.clone().text()).toBe(200)
    const read = dataOf.parse(await opened.json()).data
    expect(read).toMatchObject({
      docId: page.docId,
      kind: page.kind,
      version: page.version,
    })
    if (page.copyOf) {
      const source = await engineRead(creator, page.copyOf)
      expect(source.status).toBe(200)
      const original = engineDoc.parse(dataOf.parse(await source.json()).data)
      expect(engineDoc.parse(read).doc).toEqual(original.doc)
    }
    expect((await engineRead(stranger, page.docId)).status).toBe(404)
    expect(
      (await listed(creator)).filter((item) => item.id === page.docId)
    ).toMatchObject([
      { id: page.docId, kind: page.kind, contentVersion: page.version },
    ])
    expect(
      (await listed(stranger)).some((item) => item.id === page.docId)
    ).toBe(false)
    const info = await app.request(
      "/api/reads/paper.read",
      richInfoRequest(page.docId, creator.cookie)
    )
    expect(info.status, await info.clone().text()).toBe(200)
    await expectListIsLivePages(app, db, creator)
    await expectListIsLivePages(app, db, stranger)
    const strangerSees = await routeReads(stranger, page.docId)
    expect(strangerSees.get.status).toBe(404)
    expect(strangerSees).toEqual(await routeReads(stranger, randomUUID()))
  })
})
