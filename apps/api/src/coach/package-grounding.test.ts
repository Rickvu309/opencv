import { randomUUID } from "node:crypto"

import { personActor } from "@workspace/domain/kernel"
import { paperPackageEditResultSchema } from "@workspace/domain/paper-doc"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { registry } from "../registry/registry.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import { resolveTurnGrounding } from "./context.js"

let backend: Backend
const owner = randomUUID()
const stranger = randomUUID()
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  installRegistry()
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

describe("Coach grounding on a minted page", () => {
  it("finds the page for its owner while a direct read stays missing", () =>
    run(async () => {
      const minted = paperPackageEditResultSchema.parse(
        (
          await registry.execute({
            name: "paper.canvas",
            input: { op: "mint", label: "letter" },
            actor: personActor(owner),
            idempotencyKey: randomUUID(),
          })
        ).output
      )
      const grounding = await resolveTurnGrounding({
        registry,
        actor: personActor(owner),
        requestFocusDocId: minted.docId,
        storedKind: null,
        storedId: null,
        memoryEnabled: false,
      })
      expect(grounding.focusDoc).toMatchObject({
        id: minted.docId,
        name: "Cover letter",
        kind: "letter",
        revision: minted.revision,
      })
      expect(grounding.focusDoc?.outline).toContain(
        `Saved revision ${minted.revision}`
      )
      expect(grounding.note).toContain("Open document: Cover letter (letter).")
      await expect(
        resolveTurnGrounding({
          registry,
          actor: personActor(stranger),
          requestFocusDocId: minted.docId,
          storedKind: null,
          storedId: null,
          memoryEnabled: false,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
    }))
})
