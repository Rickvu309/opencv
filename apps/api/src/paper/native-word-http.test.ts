import { createHash, randomUUID } from "node:crypto"
import { writeFile, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { serve } from "@hono/node-server"
import { parseUserId } from "@workspace/domain/kernel"
import {
  canonicalPaper,
  nativeProvenance,
  nativeSyncOutputSchema,
  RICH_NATIVE_WRITER,
} from "@workspace/domain/paper-doc"
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
  richFormattingPaper,
} from "./native-word.test-support.js"
import { readPackageZip } from "./import/package-zip.js"
import { parsePackageXml } from "./import/package-xml.js"
import {
  elements,
  attribute,
  one,
  textOf,
} from "./native-output/inspect.test-support.js"
const WORD_PACKAGE_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

async function responseData(response: Response): Promise<unknown> {
  const body: unknown = await response.json()
  if (!body || typeof body !== "object" || !("data" in body))
    throw new Error("Missing response data")
  return body.data
}

it("downloads the saved table border mode, palette color and weight in CVs and Letters", async () => {
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
  try {
    const owner = await signUp(app, {
      name: "Linh",
      email: "table-borders@example.com",
    })
    const [person] = await db
      .select()
      .from(user)
      .where(eq(user.email, owner.user.email))
    if (!person) throw new Error("Missing owner")
    for (const kind of ["cv", "letter"] as const) {
      for (const mode of ["none", "all", "outer"] as const) {
        for (const weight of ["thin", "medium"] as const) {
          const saved = await savedRichWord(db, person.id, kind, (document) => {
            const table = document.flow.children
              .flatMap((section) => section.children)
              .find((node) => node.type === "table")
            if (!table || table.type !== "table")
              throw new Error("Missing test table")
            table.borders = { mode, color: "#1E3A8A", weight }
          })
          const response = await fetch(
            `http://127.0.0.1:${address.port}/api/paper/${saved.id}/native-word?kind=${kind}`,
            { headers: wordHeaders(owner.cookie, saved.basis) }
          )
          expect(response.status).toBe(200)
          const archive = await readPackageZip(
            new Uint8Array(await response.arrayBuffer())
          )
          const part = archive.files.get("word/document.xml")
          if (!part) throw new Error("Missing document XML")
          const table = elements(parsePackageXml(part).root, "tbl").find(
            (node) =>
              elements(node, "gridCol").some(
                (column) => attribute(column, "w") === "5000"
              )
          )
          if (!table) throw new Error("Missing saved table")
          const borders = one(table, "tblBorders")
          for (const edge of [
            "top",
            "left",
            "bottom",
            "right",
            "insideH",
            "insideV",
          ]) {
            const line = one(borders, edge)
            const visible =
              mode === "all" || (mode === "outer" && !edge.startsWith("inside"))
            expect(attribute(line, "val")).toBe(visible ? "single" : "nil")
            if (visible) {
              expect(attribute(line, "color")).toBe("1E3A8A")
              expect(attribute(line, "sz")).toBe(weight === "thin" ? "6" : "12")
            }
          }
        }
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
    await database.close()
  }
})

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
      const saved = await savedRichWord(
        db,
        parseUserId(person.id),
        kind,
        richFormattingPaper
      )
      const documentClient = openRichPaperClient(null, {
        provenance: nativeProvenance(saved.document),
      })
      const sync = async () => {
        const sent = documentClient.prepare()
        const response = await fetch(`${origin}/api/commands/paper.save`, {
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
        })
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
        ).insert(0, "Saved over HTTP \u2014 ")
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
        expect(textOf(part, part.root)).toContain("Saved over HTTP \u2014 Việt")
        const paragraphs = elements(part.root, "p")
        for (const [id, wordId] of [
          ["normal", "Normal"],
          ["title", "Title"],
          ["heading-1", "Heading1"],
          ["heading-2", "Heading2"],
          ["heading-3", "Heading3"],
        ]) {
          const paragraph = paragraphs.find(
            (node) => textOf(part, node) === `${id} Việt e\u0302 😀`
          )
          if (!paragraph) throw new Error(`Missing ${id}`)
          expect(attribute(one(paragraph, "pStyle"), "val")).toBe(wordId)
        }
        const styles = archive.files.get("word/styles.xml")
        const numbering = archive.files.get("word/numbering.xml")
        const relationships = archive.files.get("word/_rels/document.xml.rels")
        if (!styles || !numbering || !relationships)
          throw new Error("Missing formatting parts")
        const stylesPart = parsePackageXml(styles)
        for (const [id, level] of [
          ["Heading1", "0"],
          ["Heading2", "1"],
          ["Heading3", "2"],
        ]) {
          const style = elements(stylesPart.root, "style").find(
            (node) => attribute(node, "styleId") === id
          )
          if (!style) throw new Error(`Missing named style ${id}`)
          expect(attribute(one(style, "outlineLvl"), "val")).toBe(level)
          expect(elements(style, "sz")).toHaveLength(1)
        }
        for (const id of ["bullets", "numbers"]) {
          const paragraph = paragraphs.find(
            (node) => textOf(part, node) === `${id} nested`
          )
          if (!paragraph) throw new Error(`Missing nested ${id}`)
          expect(attribute(one(paragraph, "ilvl"), "val")).toBe("1")
        }
        const formats = elements(parsePackageXml(numbering).root, "numFmt").map(
          (node) => attribute(node, "val")
        )
        expect(formats).toContain("bullet")
        expect(formats).toContain("decimal")
        const relationshipXml = new TextDecoder().decode(relationships)
        for (const href of [
          "https://example.com/career",
          "http://example.com/work",
          "mailto:linh@example.com",
        ])
          expect(relationshipXml).toContain(href)
        expect(elements(part.root, "hyperlink").length).toBeGreaterThanOrEqual(
          3
        )
        const hyperlinkStyle = elements(stylesPart.root, "style").find(
          (node) => attribute(node, "styleId") === "Hyperlink"
        )
        if (!hyperlinkStyle) throw new Error("Missing Hyperlink style")
        expect(attribute(hyperlinkStyle, "type")).toBe("character")
        expect(attribute(one(hyperlinkStyle, "color"), "val")).toBe("1D4ED8")
        expect(attribute(one(hyperlinkStyle, "u"), "val")).toBe("single")
        for (const link of elements(part.root, "hyperlink"))
          for (const run of elements(link, "r")) {
            expect(attribute(one(run, "rStyle"), "val")).toBe("Hyperlink")
            expect(elements(run, "color")).toHaveLength(0)
            if (textOf(part, run) === " Link")
              expect(attribute(one(run, "u"), "val")).toBe("single")
            else expect(elements(run, "u")).toHaveLength(0)
          }
        const cleared = paragraphs.find(
          (node) => textOf(part, node) === "Cleared formatting"
        )
        if (!cleared) throw new Error("Missing cleared paragraph")
        for (const mark of ["b", "i", "strike"])
          for (const value of elements(cleared, mark))
            expect(attribute(value, "val")).toBe("0")
        for (const value of elements(cleared, "u"))
          expect(attribute(value, "val")).toBe("none")
        expect(elements(cleared, "hyperlink")).toHaveLength(0)
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
        const artifacts = await mkdtemp(join(tmpdir(), "paper-word-"))
        try {
          await writeFile(join(artifacts, `${kind}.docx`), bytes)
        } finally {
          await rm(artifacts, { recursive: true, force: true })
        }
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
