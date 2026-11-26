import { randomUUID } from "node:crypto"

import { personActor } from "@workspace/domain/kernel"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../../../db/context.js"
import { paperPackageHeads, user } from "../../../db/schema.js"
import {
  openBackend,
  type Backend,
} from "../../../test/registry-formal-support.js"
import { paperRegistry } from "../../paper-registry.test-support.js"
import { fixturePackage, paragraph, relationship } from "../package-fixtures.js"
import { prepareWordPackage } from "../package-planner.js"
import {
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
} from "../package-store.js"
import { apply, open } from "./document.js"

let backend: Backend
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
})

afterAll(async () => {
  await backend?.close()
})

function registry() {
  const value = paperRegistry()
  return value
}

async function seed() {
  const id = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@test.invalid` })
  return id
}

async function headOf(docId: string) {
  const [head] = await getDb()
    .select({ revision: paperPackageHeads.revision })
    .from(paperPackageHeads)
    .where(eq(paperPackageHeads.docId, docId))
  return head?.revision
}

async function readOnlyImport(owner: string) {
  const bytes = fixturePackage(
    paragraph("Built the hiring pipeline") + paragraph(""),
    { relationships: [relationship("header1", "header", "header1.xml")] }
  )
  const stage = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name: "CV.docx", kind: "cv" },
    bytes
  )
  const head = await publishWordPackage(owner, stage.stageId)
  const page = await open(owner, { kind: "read", doc: head.docId })
  if ("refused" in page) throw new Error(page.message)
  const [line, empty] = page.paragraphs
  if (!line || !empty) throw new Error("Missing fixture paragraphs")
  return { head, page, line, empty }
}

const readOnly =
  "Paper can read this Word file but cannot safely change it, because it uses Word features Paper cannot check yet. No document was changed."

describe("a Word file Paper can only read stays unchanged", () => {
  it("projects no Coach target and refuses a Coach replacement", () =>
    run(async () => {
      const owner = await seed()
      const { head } = await readOnlyImport(owner)
      const projection = await readWordPackage(owner, { docId: head.docId })
      expect(projection.regions.map((region) => region.kind)).toEqual([
        "locked",
        "locked",
      ])
      await expect(
        prepareWordPackage(owner, {
          docId: head.docId,
          basedOn: head.revision,
          edits: [
            {
              op: "replaceText",
              targetId: `t_${"0".repeat(64)}`,
              before: "hiring",
              after: "sales",
            },
          ],
        })
      ).rejects.toThrow()
      expect(await headOf(head.docId)).toBe(head.revision)
    }))

  it("refuses typing on the page with a readable reason", () =>
    run(async () => {
      const owner = await seed()
      const { head, page, line, empty } = await readOnlyImport(owner)
      const commands = registry()
      for (const input of [
        {
          op: "write",
          batch: {
            doc: head.docId,
            basedOn: head.revision,
            ops: [
              {
                op: "setText",
                handle: line.handle,
                text: line.text.slice(0, 5),
              },
              { op: "insert", after: line.handle, text: line.text.slice(5) },
            ],
          },
        },
        {
          op: "write",
          batch: {
            doc: head.docId,
            basedOn: head.revision,
            ops: [{ op: "setText", handle: empty.handle, text: "Hi" }],
          },
        },
      ])
        await expect(
          commands.execute({
            name: "paper.canvas",
            input,
            actor: personActor(owner),
            idempotencyKey: randomUUID(),
          })
        ).rejects.toThrow(readOnly)
      const held = await apply(owner, {
        doc: page.doc,
        basedOn: page.revision,
        ops: [{ op: "setText", handle: line.handle, text: "Built a pipeline" }],
      })
      if (!held.refused) throw new Error("Expected a refusal")
      expect({ reason: held.reason, code: held.code }).toEqual({
        reason: "closed",
        code: "READ_ONLY_PACKAGE",
      })
      expect(held.message).toContain("cannot safely change it")
      expect(await headOf(head.docId)).toBe(head.revision)
    }))
})
