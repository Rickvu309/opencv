import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import {
  fixturePackage,
  packageMember,
  paragraph,
  run as wordRun,
} from "./package-fixtures.js"
import { prepareWordPackage } from "./package-planner.js"
import {
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
} from "./package-store.js"
import { readPackageZip } from "./package-zip.js"
import { apply, open } from "./word/document.js"

let backend: Backend
const owner = randomUUID()
const within = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
  await backend.db
    .insert(user)
    .values({ id: owner, name: owner, email: `${owner}@test.invalid` })
})
afterAll(async () => {
  await backend?.close()
})

async function stored(body: string) {
  const bytes = fixturePackage(body)
  const stage = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name: "CV.docx", kind: "cv" },
    bytes
  )
  const head = await publishWordPackage(owner, stage.stageId)
  const page = await readWordPackage(owner, { docId: head.docId })
  const targets = page.regions.flatMap((region) =>
    region.kind === "editable" ? [region] : []
  )
  return { head, targets, bytes }
}

type Stored = Awaited<ReturnType<typeof stored>>

function replace(doc: Stored, target: number, before: string, after: string) {
  const region = doc.targets[target]
  if (!region) throw new Error("Missing fixture target")
  return { op: "replaceText", targetId: region.targetId, before, after }
}

function request(doc: Stored, edits: ReturnType<typeof replace>[]) {
  return { docId: doc.head.docId, basedOn: doc.head.revision, edits }
}

async function prepared(doc: Stored, edits: ReturnType<typeof replace>[]) {
  const plan = await prepareWordPackage(owner, request(doc, edits))
  if (plan.kind !== "prepared") throw new Error("Expected a prepared edit")
  return plan
}

function texts(plan: Awaited<ReturnType<typeof prepared>>) {
  return plan.candidate.projection.regions.map((region) => region.text)
}

async function mainPart(bytes: Uint8Array) {
  return (
    (await packageMember(bytes, "word/document.xml"))?.bytes.toString() ?? ""
  )
}

describe("a Coach replacement is prepared by the Word document module", () => {
  it("prepares one replacement with its review and keeps every other zip member byte for byte", () =>
    within(async () => {
      const doc = await stored(paragraph("A useful original phrase"))
      const plan = await prepared(doc, [replace(doc, 0, "original", "better")])
      expect(plan.review.changes).toEqual([
        expect.objectContaining({
          targetId: doc.targets[0]?.targetId,
          before: "original",
          after: "better",
        }),
      ])
      expect(texts(plan)).toEqual(["A useful better phrase"])
      expect(await mainPart(plan.candidate.bytes)).toContain(
        "A useful better phrase"
      )
      const original = await readPackageZip(doc.bytes)
      const candidate = await readPackageZip(plan.candidate.bytes)
      const untouched = original.entries
        .map((entry) => entry.name)
        .filter((name) => name !== "word/document.xml")
      expect(untouched.length).toBeGreaterThan(0)
      for (const name of untouched)
        expect(packageMember(candidate, name)?.local).toEqual(
          packageMember(original, name)?.local
        )
    }))

  it("prepares several replacements across different paragraphs in one proposal", () =>
    within(async () => {
      const doc = await stored(
        paragraph("First plain line") + paragraph("Second plain line")
      )
      const plan = await prepared(doc, [
        replace(doc, 0, "First", "Opening"),
        replace(doc, 1, "Second", "Closing"),
      ])
      expect(plan.review.changes.map((change) => change.after)).toEqual([
        "Opening",
        "Closing",
      ])
      expect(texts(plan)).toEqual(["Opening plain line", "Closing plain line"])
    }))

  it("prepares two replacements inside one paragraph", () =>
    within(async () => {
      const doc = await stored(
        `<w:p>${wordRun("Alpha one ")}${wordRun("beta two")}</w:p>`
      )
      const plan = await prepared(doc, [
        replace(doc, 0, "one", "1"),
        replace(doc, 1, "two", "2"),
      ])
      expect(plan.review.changes).toHaveLength(2)
      expect(texts(plan).join("")).toBe("Alpha 1 beta 2")
    }))

  it("keeps bold words bold when a replacement lands in the plain run beside them", () =>
    within(async () => {
      const doc = await stored(
        `<w:p>${wordRun("Led the ")}${wordRun("data", "<w:b/>")}${wordRun(" team")}</w:p>`
      )
      const plan = await prepared(doc, [
        replace(doc, 2, " team", " platform team"),
      ])
      expect(texts(plan)).toEqual(["Led the ", "data", " platform team"])
      const bold = plan.candidate.projection.regions[1]
      expect(bold?.kind === "editable" && bold.formatting).toMatchObject({
        kind: "known",
        properties: [{ name: "b" }],
      })
      expect(await mainPart(plan.candidate.bytes)).toContain(
        "<w:r><w:rPr><w:b/></w:rPr><w:t>data</w:t></w:r>"
      )
    }))

  it("holds a replacement that would flatten bold and plain words into one run", () =>
    within(async () => {
      const doc = await stored(
        `<w:p>${wordRun("Led the ")}${wordRun("data", "<w:b/>")}${wordRun(" team")}</w:p>`
      )
      await expect(
        prepareWordPackage(
          owner,
          request(doc, [
            replace(doc, 0, "Led the data team", "Ran the analytics team"),
          ])
        )
      ).rejects.toThrow("This line mixes formatting")
    }))

  it("keeps new words in the run the Coach named when they meet a bold run", () =>
    within(async () => {
      const doc = await stored(
        `<w:p>${wordRun("Hello")}${wordRun(" World", "<w:b/>")}</w:p>`
      )
      const after = await prepared(doc, [
        replace(doc, 0, "Hello", "Hello there"),
      ])
      const xml = await mainPart(after.candidate.bytes)
      expect(xml).toContain(
        `<w:r><w:t>Hello there</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve"> World</w:t></w:r>`
      )
      const before = await prepared(doc, [
        replace(doc, 1, " World", " big World"),
      ])
      expect(await mainPart(before.candidate.bytes)).toContain(
        `<w:r><w:t>Hello</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve"> big World</w:t></w:r>`
      )
    }))

  it("refuses a replacement based on a page that has since changed", () =>
    within(async () => {
      const doc = await stored(paragraph("A useful original phrase"))
      const page = await open(owner, { kind: "read", doc: doc.head.docId })
      if ("refused" in page) throw new Error(page.message)
      const handle = page.paragraphs[0]?.handle
      if (!handle) throw new Error("Missing fixture paragraph")
      const typed = await apply(owner, {
        doc: page.doc,
        basedOn: page.revision,
        ops: [{ op: "setText", handle, text: "A useful typed phrase" }],
      })
      expect(typed.refused).toBe(false)
      await expect(
        prepareWordPackage(
          owner,
          request(doc, [replace(doc, 0, "original", "better")])
        )
      ).rejects.toThrow("changed")
    }))
})
