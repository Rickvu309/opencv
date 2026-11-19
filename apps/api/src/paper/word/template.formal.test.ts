import { randomUUID } from "node:crypto"

import {
  PAPER_TEMPLATE_IDS,
  paperPackageEditResultSchema,
  personActor,
  type PaperTemplateId,
  type WordCommit,
  type WordFile,
  type WordPage,
  type WordRefusal,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../../db/context.js"
import { activity, user } from "../../db/schema.js"
import { bindCatalog } from "../../registry/bind.js"
import { Registry } from "../../registry/registry.js"
import {
  openBackend,
  type Backend,
} from "../../test/registry-formal-support.js"
import { registerPaper } from "../commands.js"
import { implementation as readWord } from "../operations/read/server.js"
import { publishWordPackage, stageWordPackage } from "../package-store.js"
import { apply, exportWord, open, undo } from "./document.js"
import { templateLines, templatePageName } from "./template.js"

let backend: Backend
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
})

afterAll(async () => {
  await backend?.close()
})

async function seed() {
  const id = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@test.invalid` })
  return id
}

function pageOf(value: WordPage | WordRefusal): WordPage {
  if ("refused" in value) throw new Error(value.message)
  return value
}

function saved(value: WordCommit | WordRefusal): WordCommit {
  if (value.refused) throw new Error(value.message)
  return value
}

function fileOf(value: WordFile | WordRefusal): WordFile {
  if ("refused" in value) throw new Error(value.message)
  return value
}

async function mintTemplate(owner: string, templateId: PaperTemplateId) {
  return pageOf(
    await open(owner, {
      kind: "mint",
      name: templatePageName(templateId),
      label: "cv",
      templateId,
    })
  )
}

function shapeOf(page: WordPage) {
  return page.paragraphs.map((paragraph) => ({
    text: paragraph.text,
    form: paragraph.form?.kind ?? "plain",
    align: paragraph.align ?? "start",
    held: paragraph.held,
  }))
}

const PLACEHOLDER = /^\[[^\]]+\](?: \| \[[^\]]+\])*$/

describe("a CV made from a template", () => {
  it("writes every line that is not a section title as bracketed placeholder text", () => {
    for (const templateId of PAPER_TEMPLATE_IDS) {
      for (const line of templateLines(templateId)) {
        if (line.style === "Heading1") continue
        expect(line.text).toMatch(PLACEHOLDER)
      }
    }
  })

  it("opens every template as a Word page with a name title, section headings and bullets", () =>
    run(async () => {
      const owner = await seed()
      for (const templateId of PAPER_TEMPLATE_IDS) {
        const page = await mintTemplate(owner, templateId)
        const lines = templateLines(templateId)
        expect(page.label).toBe("cv")
        expect(page.name).toBe(templatePageName(templateId))
        expect(page.paragraphs.map((paragraph) => paragraph.text)).toEqual(
          lines.map((line) => line.text)
        )
        expect(page.paragraphs.every((paragraph) => !paragraph.held)).toBe(true)
        const forms = shapeOf(page).map((line) => line.form)
        expect(forms).toEqual(
          lines.map((line) =>
            line.style === "Title"
              ? "title"
              : line.style === "Heading1"
                ? "heading"
                : line.style === "ListBullet"
                  ? "bullet"
                  : "plain"
          )
        )
        expect(
          shapeOf(page)
            .slice(0, 3)
            .map((line) => line.align)
        ).toEqual(["center", "center", "center"])
      }
    }))

  it("uses each layout's section order", () => {
    const headings = (templateId: PaperTemplateId) =>
      templateLines(templateId)
        .filter((line) => line.style === "Heading1")
        .map((line) => line.text)
    expect(headings("simple")).toEqual([
      "Summary",
      "Experience",
      "Education",
      "Skills",
    ])
    expect(headings("modern")).toEqual([
      "Profile",
      "Experience",
      "Selected work",
    ])
    expect(headings("compact")).toEqual([
      "Work experience",
      "About",
      "Education",
      "Skills",
    ])
    expect(headings("academic")).toEqual([
      "Education",
      "Projects & campus",
      "Experience",
      "Skills & languages",
    ])
  })

  it("downloads as Word and reopens with the same lines and formatting", () =>
    run(async () => {
      const owner = await seed()
      const page = await mintTemplate(owner, "modern")
      const file = fileOf(await exportWord(owner, page.doc, page.revision))
      expect(file.bytes.byteLength).toBeGreaterThan(0)
      const stage = await stageWordPackage(
        owner,
        { requestId: randomUUID(), name: "Reopened.docx", kind: "cv" },
        file.bytes
      )
      const published = await publishWordPackage(owner, stage.stageId)
      const reopened = pageOf(
        await open(owner, { kind: "read", doc: published.docId })
      )
      expect(shapeOf(reopened)).toEqual(shapeOf(page))
    }))

  it("rewrites a bullet, adds a bullet after it, and undoes both", () =>
    run(async () => {
      const owner = await seed()
      const page = await mintTemplate(owner, "simple")
      const bullet = page.paragraphs.find(
        (paragraph) => paragraph.form?.kind === "bullet"
      )
      if (!bullet) throw new Error("no bullet line")
      const done = saved(
        await apply(owner, {
          doc: page.doc,
          basedOn: page.revision,
          ops: [
            { op: "setText", handle: bullet.handle, text: "[Led a project]" },
            { op: "insert", after: bullet.handle, text: "[Second result]" },
          ],
        })
      )
      const at = done.page.paragraphs.findIndex(
        (paragraph) => paragraph.text === "[Led a project]"
      )
      expect(done.page.paragraphs[at]?.form?.kind).toBe("bullet")
      expect(done.page.paragraphs[at + 1]?.text).toBe("[Second result]")
      expect(done.page.paragraphs[at + 1]?.form?.kind).toBe("bullet")
      if (!done.undo) throw new Error("no undo")
      const back = saved(await undo(owner, done.undo))
      expect(shapeOf(back.page)).toEqual(shapeOf(page))
    }))

  it("refuses a template on a letter", () =>
    run(async () => {
      const owner = await seed()
      const result = await open(owner, {
        kind: "mint",
        name: "Letter.docx",
        label: "letter",
        templateId: "simple",
      })
      expect("refused" in result && result.refused).toBe(true)
    }))

  it("mints a template page through paper.canvas with its name and a receipt", () =>
    run(async () => {
      const owner = await seed()
      const registry = new Registry()
      registerPaper(registry)
      bindCatalog(registry, { "paper.read": readWord })
      const result = await registry.execute({
        name: "paper.canvas",
        input: { op: "mint", label: "cv", templateId: "academic" },
        actor: personActor(owner),
        idempotencyKey: randomUUID(),
      })
      const minted = paperPackageEditResultSchema.parse(result.output)
      expect(minted.name).toBe("Academic CV")
      expect(minted.kind).toBe("cv")
      const page = pageOf(
        await open(owner, { kind: "read", doc: minted.docId })
      )
      expect(page.paragraphs.map((paragraph) => paragraph.text)).toEqual(
        templateLines("academic").map((line) => line.text)
      )
      const receipts = await getDb()
        .select({ subjectId: activity.subjectId })
        .from(activity)
        .where(
          and(eq(activity.userId, owner), eq(activity.subjectId, minted.docId))
        )
      expect(receipts).toHaveLength(1)
    }))
})
