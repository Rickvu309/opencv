import { randomUUID } from "node:crypto"

import {
  PAPER_CANVAS_PROFILE,
  coachActor,
  delegateActorSchema,
  paperWordReadSchema,
  parsePaperId,
  parseUserId,
  personActor,
  type Actor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../db/context.js"
import {
  agentConnections,
  chats,
  coachUsage,
  oauthClient,
  files,
  paperPackageCandidates,
  paperPackageTrash,
  paperPackageVersions,
  pendingActions,
  user,
} from "../db/schema.js"
import { installRegistry } from "../install.js"
import { registry } from "../registry/registry.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import { readOutline } from "./outline.js"
import { pruneUnreachableCandidates } from "./package-candidate-prune.js"
import { fixturePackage, paragraph } from "./package-fixtures.js"
import {
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
} from "./package-store.js"

let backend: Backend
const owner = randomUUID()
const stranger = randomUUID()
const person = personActor(owner)
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)
const lineHandle = /\[line ([0-9a-f-]{36})\] Harbor light/

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

async function mintWordPage(name: string) {
  const staged = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name, kind: "cv" },
    fixturePackage(paragraph("Harbor light"))
  )
  return publishWordPackage(owner, staged.stageId, PAPER_CANVAS_PROFILE)
}

function pageText(page: Awaited<ReturnType<typeof readWordPackage>>) {
  return page.regions.map((region) => region.text).join("\n")
}

async function coachTurn() {
  const chatId = randomUUID()
  const turnId = randomUUID()
  await getDb().insert(chats).values({ id: chatId, userId: owner, title: "CV" })
  await getDb().insert(coachUsage).values({
    id: turnId,
    userId: owner,
    chatId,
    plan: "free",
    mode: "free",
    provider: "fake",
    model: "fake",
  })
  return coachActor(owner, chatId, turnId)
}

async function coachProposal(
  docId: string,
  basedOn: string,
  text: string,
  coach: Actor
) {
  const outline = await readOutline(
    parseUserId(owner),
    parsePaperId(docId),
    undefined
  )
  const handle = lineHandle.exec(outline.outline)?.[1]
  if (!handle) throw new Error("missing line handle")
  const proposed = await registry.execute({
    name: "paper.edit",
    input: { docId, basedOn, edits: [{ op: "setText", handle, text }] },
    actor: coach,
    idempotencyKey: randomUUID(),
  })
  expect(proposed.pending).toBe(true)
  return String(proposed.pendingActionId)
}

async function deleteThenUndo(docId: string, between?: () => Promise<void>) {
  const deleted = await registry.execute({
    name: "paper.delete",
    input: { docId },
    actor: person,
  })
  await between?.()
  await registry.execute({
    name: "activity.undo",
    input: { activityId: deleted.activityId },
    actor: person,
  })
}

async function statusOf(id: string) {
  const [row] = await getDb()
    .select({ status: pendingActions.status })
    .from(pendingActions)
    .where(eq(pendingActions.id, id))
  return row?.status
}

async function headOf(docId: string) {
  const page = await readWordPackage(owner, { docId })
  return {
    revision: page.revision,
    packageHash: page.packageHash,
    text: pageText(page),
  }
}

describe("a proposal made before a Word page was deleted and brought back", () => {
  it("is approvable after Undo while the page's head is the one it was based on, and a declined one stays declined", () =>
    run(async () => {
      const page = await mintWordPage("Proposal Undo.docx")
      const coach = await coachTurn()
      const kept = await coachProposal(
        page.docId,
        page.revision,
        "Harbor lamp",
        coach
      )
      const declined = await coachProposal(
        page.docId,
        page.revision,
        "Harbor fog",
        coach
      )
      await registry.deny(owner, declined)
      await deleteThenUndo(page.docId, async () => {
        await expect(registry.approve(owner, kept)).rejects.toThrow()
        expect(await statusOf(kept)).toBe("pending")
      })
      expect((await headOf(page.docId)).revision).toBe(page.revision)
      await expect(registry.approve(owner, declined)).rejects.toThrow(
        "This action was already declined."
      )
      expect(await registry.approve(owner, kept)).toBeTruthy()
      expect(await statusOf(kept)).toBe("approved")
      expect((await headOf(page.docId)).text).toContain("Harbor lamp")
      expect((await headOf(page.docId)).text).not.toContain("Harbor fog")
    }))

  it("is refused as stale after Undo when the page's head moved", () =>
    run(async () => {
      const page = await mintWordPage("Proposal Stale.docx")
      const coach = await coachTurn()
      const older = await coachProposal(
        page.docId,
        page.revision,
        "Harbor lamp",
        coach
      )
      const newer = await coachProposal(
        page.docId,
        page.revision,
        "Harbor beam",
        coach
      )
      await deleteThenUndo(page.docId)
      await registry.approve(owner, newer)
      const moved = await headOf(page.docId)
      expect(moved.text).toContain("Harbor beam")
      await expect(registry.approve(owner, older)).rejects.toThrow(
        "Basis conflict"
      )
      expect(await headOf(page.docId)).toEqual(moved)
    }))

  it("refuses an agent's proposal whose grant was revoked while the page was deleted", () =>
    run(async () => {
      const page = await mintWordPage("Agent Undo.docx")
      const connectionId = randomUUID()
      const clientId = `card-agent-${connectionId}`
      await getDb()
        .insert(oauthClient)
        .values({
          id: clientId,
          clientId,
          redirectUris: ["http://localhost/cb"],
        })
      await getDb()
        .insert(agentConnections)
        .values({
          id: connectionId,
          userId: owner,
          clientId,
          authorizationCodeId: `code-${connectionId}`,
          name: "Paper agent",
          audience: "http://localhost/mcp",
          scopes: ["paper.read", "paper.write"],
          resources: { kind: "paper" },
          policy: { reads: "allow", writes: "approval" },
          expiresAt: new Date(Date.now() + 600_000),
        })
      const agent = delegateActorSchema.parse({
        type: "delegate",
        userId: owner,
        connectionId,
        name: "Paper agent",
        scopes: ["paper.read", "paper.write"],
        resources: "paper",
        reads: "allow",
        writes: "approval",
      })
      const lines = paperWordReadSchema.parse(
        await registry.read(
          "paper.read",
          { view: "lines", docId: page.docId },
          agent
        )
      )
      const region = lines.paragraphs.find((item) => !item.held)
      if (!region || region.held) throw new Error("missing editable region")
      const proposed = await registry.execute({
        name: "paper.edit",
        input: {
          docId: page.docId,
          basedOn: lines.revision,
          edits: [
            { op: "setText", handle: region.handle, text: "Agent words" },
          ],
        },
        actor: agent,
        idempotencyKey: randomUUID(),
      })
      const id = String(proposed.pendingActionId)
      await deleteThenUndo(page.docId, async () => {
        await getDb()
          .update(agentConnections)
          .set({ revokedAt: new Date() })
          .where(eq(agentConnections.id, connectionId))
      })
      const before = await headOf(page.docId)
      expect(before.revision).toBe(page.revision)
      await expect(registry.approve(owner, id)).rejects.toThrow(
        "no longer active"
      )
      expect(await headOf(page.docId)).toEqual(before)
    }))

  it("keeps an approved edit's Undo across a delete and Undo, even after old candidates are pruned", () =>
    run(async () => {
      const page = await mintWordPage("Approved Undo.docx")
      const original = await headOf(page.docId)
      const coach = await coachTurn()
      const proposal = await coachProposal(
        page.docId,
        page.revision,
        "Harbor lamp",
        coach
      )
      const receipt = (await registry.approve(owner, proposal)) as {
        id: string
      }
      const edited = await headOf(page.docId)
      expect(edited.text).toContain("Harbor lamp")
      await deleteThenUndo(page.docId, async () => {
        const kept = await getDb()
          .delete(paperPackageCandidates)
          .where(eq(paperPackageCandidates.docId, page.docId))
          .returning()
        expect(kept.length).toBeGreaterThan(0)
        await getDb()
          .insert(paperPackageCandidates)
          .values(
            kept.map((row) => ({
              ...row,
              createdAt: new Date(Date.now() - 60 * 60 * 1000),
            }))
          )
        await pruneUnreachableCandidates(owner)
        const [survivor] = await getDb()
          .select({ id: paperPackageCandidates.id })
          .from(paperPackageCandidates)
          .where(eq(paperPackageCandidates.docId, page.docId))
        expect(survivor).toBeDefined()
      })
      expect(await headOf(page.docId)).toEqual(edited)
      await registry.execute({
        name: "activity.undo",
        input: { activityId: receipt.id },
        actor: person,
      })
      const undone = await headOf(page.docId)
      expect(undone.text).toBe(original.text)
      expect(undone.packageHash).toBe(original.packageHash)
    }))

  it("survives a rename: a proposal made before the rename still applies to the unchanged words", () =>
    run(async () => {
      const page = await mintWordPage("Before rename.docx")
      const coach = await coachTurn()
      const proposal = await coachProposal(
        page.docId,
        page.revision,
        "Harbor lamp",
        coach
      )
      await registry.execute({
        name: "paper.update",
        input: { docId: page.docId, patch: { name: "After rename" } },
        actor: person,
      })
      expect(await registry.approve(owner, proposal)).toBeTruthy()
      const after = await readWordPackage(owner, { docId: page.docId })
      expect(pageText(after)).toContain("Harbor lamp")
      expect(after.name).toBe("After rename")
      await expect(
        getDb()
          .update(paperPackageVersions)
          .set({ projector: "tampered" })
          .where(eq(paperPackageVersions.docId, page.docId))
      ).rejects.toThrow()
      await expect(
        getDb()
          .update(paperPackageVersions)
          .set({ name: "Renamed with history.docx" })
          .where(eq(paperPackageVersions.docId, page.docId))
      ).resolves.toBeDefined()
    }))
})

describe("bringing back a deleted Word page", () => {
  it("answers another person's page exactly like an unknown id, and restores only for its owner, twice without harm", () =>
    run(async () => {
      const page = await mintWordPage("Trashed.docx")
      await registry.execute({
        name: "paper.delete",
        input: { docId: page.docId },
        actor: person,
      })
      const outsider = personActor(stranger)
      const unknown = randomUUID()
      expect(
        await registry.read("paper.isDeleted", { docId: page.docId }, outsider)
      ).toEqual({ docId: page.docId, deleted: false })
      expect(
        await registry.read("paper.isDeleted", { docId: unknown }, outsider)
      ).toEqual({ docId: unknown, deleted: false })
      for (const docId of [page.docId, unknown])
        await expect(
          registry.execute({
            name: "paper.restoreDeleted",
            input: { docId },
            actor: outsider,
          })
        ).rejects.toMatchObject({
          code: "NOT_FOUND",
          message: "Document not found",
        })
      expect(
        await registry.read("paper.isDeleted", { docId: page.docId }, person)
      ).toEqual({ docId: page.docId, deleted: true })
      for (let attempt = 0; attempt < 2; attempt++) {
        const restored = await registry.execute({
          name: "paper.restoreDeleted",
          input: { docId: page.docId },
          actor: person,
        })
        expect(restored.output).toMatchObject({
          id: page.docId,
          name: "Trashed.docx",
        })
      }
      const back = await readWordPackage(owner, { docId: page.docId })
      expect(back.revision).toBe(page.revision)
      expect(
        await registry.read("paper.isDeleted", { docId: page.docId }, person)
      ).toEqual({ docId: page.docId, deleted: false })
    }))

  it("never offers the Coach a way to bring back or probe a deleted page", () =>
    run(async () => {
      const names = (await registry.tools(await coachTurn())).map(
        (tool) => tool.name
      )
      expect(names).toContain("paper.delete")
      expect(names).not.toContain("paper.restoreDeleted")
      expect(names).not.toContain("paper.isDeleted")
    }))
})

it("leaves nothing of a deleted Word page behind when its owner deletes the account", () =>
  run(async () => {
    const leaving = randomUUID()
    await getDb()
      .insert(user)
      .values({ id: leaving, name: leaving, email: `${leaving}@test.invalid` })
    const staged = await stageWordPackage(
      leaving,
      { requestId: randomUUID(), name: "Leaving.docx", kind: "cv" },
      fixturePackage(paragraph("Harbor light"))
    )
    const page = await publishWordPackage(leaving, staged.stageId)
    await registry.execute({
      name: "paper.delete",
      input: { docId: page.docId },
      actor: personActor(leaving),
    })
    await registry.execute({
      name: "account.delete",
      input: { confirm: "DELETE" },
      actor: personActor(leaving),
    })
    for (const [table, column] of [
      [paperPackageTrash, paperPackageTrash.userId],
      [paperPackageVersions, paperPackageVersions.userId],
      [files, files.userId],
    ] as const)
      expect(
        await getDb().select().from(table).where(eq(column, leaving))
      ).toEqual([])
  }))

describe("Word edit storage while pages sit in the trash", () => {
  it(
    "keeps live editing open after 70 edited pages are deleted, and brings a page and its edit Undo back whole",
    () =>
      run(async () => {
        const deleted = []
        for (let index = 0; index < 70; index += 1) {
          const page = await mintWordPage(`Trashed ${index}.docx`)
          const original = await headOf(page.docId)
          const proposal = await coachProposal(
            page.docId,
            page.revision,
            `Harbor lamp ${index}`,
            await coachTurn()
          )
          const edit = (await registry.approve(owner, proposal)) as {
            id: string
          }
          const edited = await headOf(page.docId)
          const removal = await registry.execute({
            name: "paper.delete",
            input: { docId: page.docId },
            actor: person,
          })
          deleted.push({
            docId: page.docId,
            original,
            edited,
            edit: edit.id,
            removal: String(removal.activityId),
          })
        }
        const live = await mintWordPage("Still editable.docx")
        const proposal = await coachProposal(
          live.docId,
          live.revision,
          "Harbor beacon",
          await coachTurn()
        )
        await registry.approve(owner, proposal)
        expect((await headOf(live.docId)).text).toContain("Harbor beacon")

        const [kept, lost] = deleted
        if (!kept || !lost) throw new Error("missing deleted pages")
        await registry.execute({
          name: "activity.undo",
          input: { activityId: kept.removal },
          actor: person,
        })
        expect(await headOf(kept.docId)).toEqual(kept.edited)
        await registry.execute({
          name: "activity.undo",
          input: { activityId: kept.edit },
          actor: person,
        })
        const undone = await headOf(kept.docId)
        expect(undone.text).toBe(kept.original.text)
        expect(undone.packageHash).toBe(kept.original.packageHash)

        await getDb()
          .delete(paperPackageCandidates)
          .where(eq(paperPackageCandidates.docId, lost.docId))
        await registry.execute({
          name: "activity.undo",
          input: { activityId: lost.removal },
          actor: person,
        })
        expect(await headOf(lost.docId)).toEqual(lost.edited)
        await registry.execute({
          name: "activity.undo",
          input: { activityId: lost.edit },
          actor: person,
        })
        const restoredWithoutCandidate = await headOf(lost.docId)
        expect(restoredWithoutCandidate.text).toBe(lost.original.text)
        expect(restoredWithoutCandidate.packageHash).toBe(
          lost.original.packageHash
        )
      }),
    600_000
  )
})
