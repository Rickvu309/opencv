import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { deleteAccount } from "../account/index.js"
import { hashAgentToken } from "../connections/index.js"
import { withDatabase } from "../db/context.js"
import {
  agentConnections,
  files,
  jobs,
  oauthAccessToken,
  oauthClient,
  paperPackageHeads,
  paperPackageTrash,
  paperPackageVersions,
  user,
} from "../db/schema.js"
import { DELEGATE_REACHABLE } from "../registry/delegate-policy.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { insertWordPage } from "../test/word-page-rows.js"
import { fixturePackage, paragraph } from "./word-package/package-fixtures.js"
import { readPackageZip } from "./word-package/package-zip.js"
import { trashStoredWordPage } from "./word-page-trash.js"
import { collectWordPageExport } from "./word-page-export.js"

type Database = Awaited<ReturnType<typeof createMigratedTestDb>>
type WordPageEntry = {
  id: string
  name: string
  kind: string
  imported: boolean
  file: string | null
  linkedJobs: { id: string; title: string }[]
  deleted: boolean
  deletedAt: string | null
  omitted: string | null
  createdAt: string
  updatedAt: string
}
type Person = { id: string; cookie: string }

let database: Database
let app: ReturnType<typeof createTestApp>
let ada: Person
let bea: Person

async function person(name: string, email: string): Promise<Person> {
  const { cookie } = await signUp(app, { name, email })
  const [row] = await database.db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
  return { id: row!.id, cookie }
}

function inDb<T>(work: () => Promise<T>) {
  return withDatabase(database.db, work)
}

const written = new Map<string, Buffer>()

async function storedPage(
  owner: string,
  name: string,
  text: string,
  options: { kind?: "cv" | "letter"; written?: boolean } = {}
) {
  const bytes = fixturePackage(paragraph(text))
  const { docId } = await insertWordPage(database.db, {
    userId: owner,
    name,
    kind: options.kind ?? "cv",
    bytes,
    ...(options.written ? { canvasProfile: "paper-canvas-1" } : {}),
  })
  written.set(docId, Buffer.from(bytes))
  return docId
}

const typedPage = (
  owner: string,
  name: string,
  kind: "cv" | "letter",
  text: string
) => storedPage(owner, name, text, { kind, written: true })

const importedPage = (owner: string, name: string, text: string) =>
  storedPage(owner, name, text)

async function job(owner: string, title: string, links: object) {
  const id = randomUUID()
  await database.db.insert(jobs).values({
    id,
    userId: owner,
    title,
    company: "Acme",
    position: "a0",
    ...links,
  } as typeof jobs.$inferInsert)
  return id
}

async function exportOf(cookie: string, query = "") {
  const res = await app.request(`/api/account/export${query}`, {
    headers: authHeaders(cookie),
  })
  expect(res.status).toBe(200)
  expect(res.headers.get("content-type")).toBe("application/zip")
  expect(res.headers.get("content-disposition")).toContain("opencv-export.zip")
  const archive = await readPackageZip(new Uint8Array(await res.arrayBuffer()))
  const index = JSON.parse(
    archive.files.get("opencv-export.json")!.toString("utf8")
  ) as { wordPages: WordPageEntry[]; jobs: { id: string }[] }
  return { index, members: archive.files }
}

async function wordText(bytes: Buffer) {
  const archive = await readPackageZip(new Uint8Array(bytes))
  return archive.files.get("word/document.xml")!.toString("utf8")
}

let pages: Record<string, string>
let jobIds: Record<string, string>

beforeAll(async () => {
  database = await createMigratedTestDb()
  app = createTestApp(database.db)
  ada = await person("Ada", "ada-export-word@example.com")
  bea = await person("Bea", "bea-export-word@example.com")
  pages = {
    blank: await typedPage(ada.id, "Blank CV", "cv", "Ada blank typed line"),
    templated: await typedPage(
      ada.id,
      "Templated CV",
      "cv",
      "Ada templated typed line"
    ),
    imported: await importedPage(ada.id, "Imported CV", "Ada imported line"),
    letter: await typedPage(ada.id, "Acme letter", "letter", "Ada letter line"),
    trashed: await typedPage(ada.id, "Old CV", "cv", "Ada deleted line"),
    beaPage: await typedPage(bea.id, "Bea secret CV", "cv", "Bea secret line"),
  }
  jobIds = {
    adaJob: await job(ada.id, "Acme designer", {
      letterPackageId: pages.letter,
    }),
    beaJobOnAdaPage: await job(bea.id, "Bea job on Ada page", {
      cvPackageId: pages.blank,
    }),
    adaJobOnBeaPage: await job(ada.id, "Ada job on Bea page", {
      cvPackageId: pages.beaPage,
    }),
  }
  await inDb(() => trashStoredWordPage(ada.id, pages.trashed!))
}, 60_000)

afterAll(async () => {
  await database.client.close()
})

describe("account export of Word pages", () => {
  it("holds every page the person owns as its stored bytes, with its index entry", async () => {
    const { index, members } = await exportOf(ada.cookie)
    const byId = new Map(index.wordPages.map((page) => [page.id, page]))
    expect([...byId.keys()].sort()).toEqual(
      [
        pages.blank,
        pages.templated,
        pages.imported,
        pages.letter,
        pages.trashed,
      ].sort()
    )
    expect(byId.get(pages.blank)).toMatchObject({
      name: "Blank CV",
      kind: "cv",
      imported: false,
      deleted: false,
      deletedAt: null,
      omitted: null,
      linkedJobs: [],
    })
    expect(byId.get(pages.imported)).toMatchObject({ imported: true })
    expect(byId.get(pages.letter)).toMatchObject({
      kind: "letter",
      linkedJobs: [{ id: jobIds.adaJob, title: "Acme designer" }],
    })
    expect(byId.get(pages.trashed)).toMatchObject({ deleted: true })
    expect(byId.get(pages.trashed)!.file).toMatch(/^word-pages\/deleted\//)
    const typed: Record<string, string> = {
      blank: "Ada blank typed line",
      templated: "Ada templated typed line",
      imported: "Ada imported line",
      letter: "Ada letter line",
      trashed: "Ada deleted line",
    }
    for (const [key, text] of Object.entries(typed)) {
      const entry = byId.get(pages[key]!)!
      expect(Date.parse(entry.createdAt)).toBeLessThanOrEqual(
        Date.parse(entry.updatedAt)
      )
      const bytes = members.get(entry.file!)!
      expect(await wordText(bytes)).toContain(text)
      expect(bytes.equals(written.get(entry.id)!)).toBe(true)
    }
  })

  it("never holds another account's page, job or words", async () => {
    for (const [owner, other, otherText] of [
      [ada, bea, "Bea secret line"],
      [bea, ada, "Ada "],
    ] as const) {
      const { index, members } = await exportOf(owner.cookie)
      const otherPages = (
        await database.db
          .select({ docId: paperPackageVersions.docId })
          .from(paperPackageVersions)
          .where(eq(paperPackageVersions.userId, other.id))
      ).map((row) => row.docId)
      for (const page of index.wordPages) {
        expect(otherPages).not.toContain(page.id)
        for (const linked of page.linkedJobs) {
          const [row] = await database.db
            .select({ userId: jobs.userId })
            .from(jobs)
            .where(eq(jobs.id, linked.id))
          expect(row!.userId).toBe(owner.id)
        }
      }
      for (const [path, bytes] of members) {
        if (path.endsWith(".docx"))
          expect(await wordText(bytes)).not.toContain(otherText)
      }
    }
    const { index } = await exportOf(ada.cookie)
    expect(
      index.wordPages.find((page) => page.id === pages.blank)!.linkedJobs
    ).toEqual([])
  })

  it("ignores ids guessed into the request", async () => {
    const plain = await exportOf(ada.cookie)
    const guessed = await exportOf(
      ada.cookie,
      `?docId=${pages.beaPage}&userId=${bea.id}&at=${randomUUID()}`
    )
    expect(guessed.index.wordPages.map((page) => page.id).sort()).toEqual(
      plain.index.wordPages.map((page) => page.id).sort()
    )
  })

  it("refuses an agent client grant and keeps the agent door at its nine operations", async () => {
    expect([...DELEGATE_REACHABLE.keys()].sort()).toEqual([
      "job.calendar",
      "job.get",
      "job.list",
      "job.move",
      "job.priorityCounts",
      "job.setPriority",
      "job.update",
      "paper.edit",
      "paper.read",
    ])
    const clientId = `client-${randomUUID()}`
    const codeId = randomUUID()
    const token = `export-token-${randomUUID()}`
    const scopes = ["connection.status", "paper.read", "paper.write"]
    await database.db.insert(oauthClient).values({
      id: randomUUID(),
      clientId,
      redirectUris: ["http://127.0.0.1/callback"],
      disabled: false,
    })
    await database.db.insert(agentConnections).values({
      id: randomUUID(),
      userId: ada.id,
      clientId,
      authorizationCodeId: codeId,
      name: "Export probe",
      audience: "http://localhost/mcp",
      scopes,
      resources: { kind: "paper" },
      policy: { reads: "allow", writes: "approval" },
      expiresAt: new Date(Date.now() + 60_000),
    })
    await database.db.insert(oauthAccessToken).values({
      id: randomUUID(),
      token: hashAgentToken(token),
      clientId,
      userId: ada.id,
      authorizationCodeId: codeId,
      resources: ["http://localhost/mcp"],
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      scopes,
    })
    for (const authorization of [`Bearer ${token}`, token]) {
      const res = await app.request("/api/account/export", {
        headers: { Origin: "https://opencv.me", Authorization: authorization },
      })
      expect(res.status).toBe(401)
    }
  })

  it("lists pages over the export limit without their bytes, newest first", async () => {
    const all = await inDb(() => collectWordPageExport(ada.id))
    const live = all.pages.filter((page) => !page.deleted)
    const firstSize = live[0]!.byteSize
    const capped = await inDb(() => collectWordPageExport(ada.id, firstSize))
    expect(capped.pages.map((page) => page.id)).toEqual(
      all.pages.map((page) => page.id)
    )
    expect(capped.pages[0]).toMatchObject({ omitted: null })
    expect(capped.pages.slice(1).every((page) => page.file === null)).toBe(true)
    expect(
      capped.pages
        .slice(1)
        .every((page) => page.omitted === "over-export-limit")
    ).toBe(true)
    expect(capped.files).toHaveLength(1)
    expect(all.files.map((file) => file.path)).toEqual(
      all.pages.map((page) => page.file)
    )
    expect(
      live.every(
        (page, at) =>
          at === 0 ||
          Date.parse(live[at - 1]!.updatedAt) >= Date.parse(page.updatedAt)
      )
    ).toBe(true)
  })

  it("keeps every file name inside its folder whatever the page is called", async () => {
    const cy = await person("Cy", "cy-export-word@example.com")
    for (const name of ["../../etc/passwd", "a\\b:c*?<>|", "...", "\u0007bell"])
      await importedPage(cy.id, name, "Cy line")
    const { index, members } = await exportOf(cy.cookie)
    const paths = index.wordPages.map((page) => page.file!)
    expect(new Set(paths).size).toBe(4)
    for (const path of paths) {
      expect(members.has(path)).toBe(true)
      expect(path).toMatch(/^word-pages\/[^/\\:*?"<>|]+\.docx$/)
      expect(
        [...path].every((character) => character.charCodeAt(0) >= 32)
      ).toBe(true)
      expect(path.split("/")).not.toContain("..")
    }
  })

  it("keeps whole characters and drops direction controls in file names", async () => {
    const di = await person("Di", "di-export-word@example.com")
    await importedPage(di.id, "CV \u202egnp.exe", "Di line")
    await importedPage(di.id, `${"a".repeat(79)}\u{1f600}tail`, "Di line")
    const { index, members } = await exportOf(di.cookie)
    const paths = index.wordPages.map((page) => page.file!)
    expect(paths).toHaveLength(2)
    for (const path of paths) {
      expect(members.has(path)).toBe(true)
      expect(path).not.toMatch(
        /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u
      )
      expect(path).not.toContain("\ufffd")
      expect(Buffer.from(path, "utf8").toString("utf8")).toBe(path)
    }
    expect(paths).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^word-pages\/a{79}\u{1f600} \([0-9a-f-]{8}\)\.docx$/u
        ),
      ])
    )
  })

  it("leaves no Word page or stored bytes behind when the account is deleted", async () => {
    await inDb(() =>
      deleteAccount(bea.id as Parameters<typeof deleteAccount>[0])
    )
    for (const table of [
      paperPackageHeads,
      paperPackageTrash,
      paperPackageVersions,
      files,
    ])
      expect(
        await database.db.select().from(table).where(eq(table.userId, bea.id))
      ).toEqual([])
  })
})
