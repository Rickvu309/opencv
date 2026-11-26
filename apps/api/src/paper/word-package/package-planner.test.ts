import { randomUUID } from "node:crypto"

import { paperPackageProjectionSchema } from "@workspace/domain/paper-doc"
import { count, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { transaction, withDatabase } from "../../db/context.js"
import {
  files,
  paperPackageHeads,
  paperPackageVersions,
  user,
} from "../../db/schema.js"
import {
  openBackend,
  type Backend,
} from "../../test/registry-formal-support.js"
import { PaperPackage } from "./package-engine.js"
import {
  fixturePackage,
  paragraph,
  run as wordRun,
} from "./package-fixtures.js"
import { archiveDigest, packageDigest } from "./package-pages.js"
import { prepareWordPackage } from "./package-planner.js"
import {
  exportWordPackage,
  listWordPackages,
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
} from "./package-store.js"

let backend: Backend
const owner = randomUUID()
const stranger = randomUUID()
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
  await backend.db.insert(user).values(
    [owner, stranger].map((id) => ({
      id,
      name: id,
      email: `${id}@test.invalid`,
    }))
  )
})
afterAll(async () => {
  await backend?.close()
})

async function document(
  body = paragraph("A useful original phrase"),
  account = owner
) {
  const bytes = fixturePackage(body)
  const stage = await stageWordPackage(
    account,
    { requestId: randomUUID(), name: "CV.docx", kind: "cv" },
    bytes
  )
  const head = await publishWordPackage(account, stage.stageId)
  const page = await readWordPackage(account, { docId: head.docId })
  const region = page.regions.find((item) => item.kind === "editable")
  if (!region || region.kind !== "editable")
    throw new Error("Missing fixture target")
  return { head, region, bytes }
}

function edit(
  doc: Awaited<ReturnType<typeof document>>,
  before = "original",
  after = "better"
) {
  return {
    docId: doc.head.docId,
    basedOn: doc.head.revision,
    edits: [
      { op: "replaceText", targetId: doc.region.targetId, before, after },
    ],
  }
}

async function counts() {
  return Promise.all([
    backend.db.select({ value: count() }).from(files),
    backend.db.select({ value: count() }).from(paperPackageVersions),
    backend.db.select({ value: count() }).from(paperPackageHeads),
  ])
}

async function retainCandidate(
  plan: Awaited<ReturnType<typeof prepareWordPackage>>,
  requestId = randomUUID()
) {
  if (plan.kind !== "prepared") throw new Error("Expected a private candidate")
  const source = (
    await backend.db
      .select()
      .from(paperPackageVersions)
      .where(eq(paperPackageVersions.revision, plan.basis.revision))
  )[0]
  if (!source) throw new Error("Missing fixture basis")
  const fileId = randomUUID()
  const { bytes, ...candidate } = plan.candidate
  await backend.db.insert(files).values({
    id: fileId,
    userId: source.userId,
    name: source.name,
    mediaType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byteSize: bytes.length,
    bytes,
    purpose: "package",
  })
  await backend.db.insert(paperPackageVersions).values({
    ...source,
    ...candidate,
    fileId,
    requestId,
    parentRevision: source.revision,
  })
  return candidate.revision
}

describe("private pinned Word preparation", () => {
  it("returns exact candidate bytes and complete review without a stored write", () =>
    run(async () => {
      const doc = await document()
      const before = await counts()
      const request = edit(doc)
      const plan = await prepareWordPackage(owner, request)
      if (plan.kind !== "prepared") throw new Error("Expected an edit")
      expect(await counts()).toEqual(before)
      expect(plan.review).toEqual({
        docId: doc.head.docId,
        basedOn: doc.head.revision,
        changes: [
          {
            targetId: doc.region.targetId,
            before: "original",
            after: "better",
            location: doc.region.location,
            formatting: doc.region.formatting,
            context: doc.region.context,
          },
        ],
      })
      expect(plan.reviewHash).toBe(packageDigest(plan.review))
      expect(plan.inputHash).toBe(packageDigest(request))
      expect(plan.candidate.packageHash).toBe(
        archiveDigest(plan.candidate.bytes)
      )
      expect(plan.candidate.sidecarHash).toBe(
        packageDigest(plan.candidate.sidecar)
      )
      expect(plan.candidate.projectionHash).toBe(
        packageDigest(plan.candidate.projection)
      )
      expect(plan.candidate.sidecar.revision).toBe(plan.candidate.revision)
      expect(plan.candidate.projection.revision).toBe(plan.candidate.revision)
      expect(plan.candidate.projection.regions[0]).toMatchObject({
        text: "A useful better phrase",
      })
      expect(plan.candidate.projection.regions[0]).not.toMatchObject({
        targetId: doc.region.targetId,
      })
      const reopened = await PaperPackage.open(
        plan.candidate.bytes,
        {
          docId: doc.head.docId,
          incarnation: plan.basis.incarnation,
          revision: plan.candidate.revision,
        },
        plan.candidate.sidecar
      )
      expect(reopened.read()).toEqual(plan.candidate.projection)
      expect(
        (await exportWordPackage(owner, doc.head.docId, doc.head.revision))
          .bytes
      ).toEqual(doc.bytes)
      expect(
        (await readWordPackage(owner, { docId: doc.head.docId })).revision
      ).toBe(doc.head.revision)
    }))

  it("returns no new identity for unchanged text and refuses nested preparation", () =>
    run(async () => {
      const doc = await document()
      const before = await counts()
      expect(
        await prepareWordPackage(owner, edit(doc, "original", "original"))
      ).toMatchObject({
        kind: "unchanged",
        basis: { revision: doc.head.revision },
      })
      expect(await counts()).toEqual(before)
      await expect(
        transaction(() => prepareWordPackage(owner, edit(doc)))
      ).rejects.toThrow("before starting a save")
    }))

  it("refuses foreign, wrong-target and changed-quote requests without touching bytes", () =>
    run(async () => {
      const doc = await document()
      const foreign = await document(paragraph("Foreign original"), stranger)
      const before = await counts()
      await expect(prepareWordPackage(stranger, edit(doc))).rejects.toThrow(
        "not available"
      )
      await expect(
        prepareWordPackage(owner, { ...edit(doc), edits: edit(foreign).edits })
      ).rejects.toThrow()
      await expect(
        prepareWordPackage(owner, edit(doc, "absent"))
      ).rejects.toThrow()
      const request = edit(doc)
      await expect(
        prepareWordPackage(owner, {
          ...request,
          edits: [...request.edits, ...request.edits],
        })
      ).rejects.toThrow()
      expect(await counts()).toEqual(before)
      expect(
        (await exportWordPackage(owner, doc.head.docId, doc.head.revision))
          .bytes
      ).toEqual(doc.bytes)
    }))

  it("refuses a stored projection shadow even when its stored digest matches", () =>
    run(async () => {
      const doc = await document()
      const version = (
        await backend.db
          .select()
          .from(paperPackageVersions)
          .where(eq(paperPackageVersions.revision, doc.head.revision))
      )[0]
      if (!version) throw new Error("Missing fixture version")
      const stored = paperPackageProjectionSchema.parse(version.projection)
      const projection = {
        ...stored,
        regions: stored.regions.map((region) =>
          region.kind === "editable"
            ? {
                ...region,
                context: {
                  ...region.context,
                  paragraphText: "A different review context",
                },
              }
            : region
        ),
      }
      await backend.db
        .update(paperPackageVersions)
        .set({ projection, projectionHash: packageDigest(projection) })
        .where(eq(paperPackageVersions.revision, doc.head.revision))
      const before = await counts()
      await expect(prepareWordPackage(owner, edit(doc))).rejects.toThrow(
        "This Word projection is no longer available"
      )
      expect(await counts()).toEqual(before)
      expect(
        (await exportWordPackage(owner, doc.head.docId, doc.head.revision))
          .bytes
      ).toEqual(doc.bytes)
      expect(
        (await readWordPackage(owner, { docId: doc.head.docId })).revision
      ).toBe(doc.head.revision)
    }))

  it("refuses a private child upload-key retry without changing stored state", () =>
    run(async () => {
      const doc = await document()
      const plan = await prepareWordPackage(owner, edit(doc))
      if (plan.kind !== "prepared") throw new Error("Expected an edit")
      const requestId = randomUUID()
      await retainCandidate(plan, requestId)
      const before = await counts()
      await expect(
        stageWordPackage(
          owner,
          { requestId, name: "CV.docx", kind: "cv" },
          plan.candidate.bytes
        )
      ).rejects.toThrow("This upload key was already used for another file")
      expect(await counts()).toEqual(before)
      expect(
        (await readWordPackage(owner, { docId: doc.head.docId })).revision
      ).toBe(doc.head.revision)
      expect(
        (await exportWordPackage(owner, doc.head.docId, doc.head.revision))
          .bytes
      ).toEqual(doc.bytes)
    }))

  it("hides private children, prevents import publication, and retains exact published ancestry", () =>
    run(async () => {
      const doc = await document()
      const plan = await prepareWordPackage(owner, edit(doc))
      const child = await retainCandidate(plan)
      const sibling = await retainCandidate(
        await prepareWordPackage(owner, edit(doc, "original", "another"))
      )
      for (const at of [child, sibling]) {
        await expect(
          readWordPackage(owner, { docId: doc.head.docId, at })
        ).rejects.toThrow("not available")
        await expect(
          exportWordPackage(owner, doc.head.docId, at)
        ).rejects.toThrow("not available")
        await expect(publishWordPackage(owner, at)).rejects.toThrow(
          "not available"
        )
      }
      expect(
        (await listWordPackages(owner)).items.find(
          (item) => item.docId === doc.head.docId
        )?.revision
      ).toBe(doc.head.revision)
      await backend.db
        .update(paperPackageHeads)
        .set({ revision: child })
        .where(eq(paperPackageHeads.docId, doc.head.docId))
      expect(
        (await readWordPackage(owner, { docId: doc.head.docId })).revision
      ).toBe(child)
      expect(
        (await exportWordPackage(owner, doc.head.docId, doc.head.revision))
          .bytes
      ).toEqual(doc.bytes)
      await expect(
        readWordPackage(owner, { docId: doc.head.docId, at: sibling })
      ).rejects.toThrow("not available")
      await expect(prepareWordPackage(owner, edit(doc))).rejects.toThrow(
        "changed"
      )
    }))

  it("refuses a complete review above the serialized bound without storing a candidate", () =>
    run(async () => {
      const texts = Array.from({ length: 20 }, (_, i) =>
        Array.from({ length: 6 }, (_, j) => packageDigest([i, j]))
          .join("")
          .slice(0, 350)
      )
      const doc = await document(
        `<w:p>${texts.map((value) => wordRun(value)).join("")}</w:p>`
      )
      let page = await readWordPackage(owner, { docId: doc.head.docId })
      const all = [...page.regions]
      while (page.nextCursor) {
        page = await readWordPackage(owner, {
          docId: doc.head.docId,
          at: page.revision,
          cursor: page.nextCursor,
        })
        all.push(...page.regions)
      }
      const edits = all.flatMap((region) =>
        region.kind === "editable"
          ? [
              {
                op: "replaceText",
                targetId: region.targetId,
                before: region.text,
                after: region.text + "y",
              },
            ]
          : []
      )
      expect(edits).toHaveLength(20)
      const before = await counts()
      await expect(
        prepareWordPackage(owner, {
          docId: doc.head.docId,
          basedOn: doc.head.revision,
          edits,
        })
      ).rejects.toThrow("review is too large")
      expect(await counts()).toEqual(before)
    }))
})
