import {
  catalog,
  commands,
  paperContract,
  paperQueries,
  parseUserId,
  personActor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { saveFile } from "../paper/index.js"
import { createMigratedTestDb } from "../test/harness.js"
import { idOf } from "./coverage-helpers.js"
import { installRegistry } from "./install.js"
import { seedCoachActor } from "../test/coach-turn.js"

async function seed(
  userId: string,
  db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
) {
  await db
    .insert(user)
    .values({ id: userId, name: "Ada", email: `${userId}@example.com` })
}

describe("a paper binding that drifts from the paper contract is rejected", () => {
  it("exposes object-root Paper tools without accepting mixed import forms", () => {
    for (const name of ["paper.import", "paper.read", "paper.export"] as const)
      expect(
        z.toJSONSchema(catalog[name].input, { io: "input", reused: "ref" }),
        name
      ).toMatchObject({ type: "object" })
    const input = catalog["paper.import"].input
    const fileId = "4962177f-66d9-4c13-a9f9-24df1ef97e9d"
    const stageId = "547fb75f-0733-4132-b86d-7b0fef9ada58"
    const schema = z.toJSONSchema(input, { io: "input", reused: "ref" })
    expect(schema).toMatchObject({ type: "object" })
    for (const combinator of ["anyOf", "oneOf", "allOf"])
      expect(schema).not.toHaveProperty(combinator)
    expect(input.parse({ fileId })).toEqual({ fileId })
    expect(input.parse({ generation: "package", stageId })).toEqual({
      generation: "package",
      stageId,
    })
    for (const invalid of [
      {},
      { stageId },
      { generation: "package" },
      { generation: "package", stageId, fileId },
      { generation: "other", stageId },
      { fileId: "invalid" },
      { generation: "package", stageId: "invalid" },
      { fileId, unknown: true },
      { generation: "package", stageId, unknown: true },
    ])
      expect(input.safeParse(invalid).success, JSON.stringify(invalid)).toBe(
        false
      )
  })

  it("parses every paper command output and every paper read", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-paper-contract"
    await seed(userId, db)
    const person = personActor(userId)

    await withDatabase(db, async () => {
      const seen = new Set<string>()
      const run = async (name: keyof typeof paperContract, input: unknown) => {
        const result = await registry.execute({ name, input, actor: person })
        const parsed = paperContract[name].output.safeParse(result.output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return result.output
      }
      const read = async (name: keyof typeof paperQueries, input: unknown) => {
        const output = await registry.read(name, input, person)
        const parsed = paperQueries[name].output.safeParse(output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return output
      }

      const cv = idOf(await run("paper.create", { kind: "cv", name: "My CV" }))
      const letter = idOf(await run("paper.create", { kind: "letter" }))
      await run("paper.rename", { docId: cv, name: "Ada CV" })
      const outline = (await read("paper.outline", { docId: cv })) as {
        revision: number
      }
      const edited = (await run("paper.edit", {
        docId: cv,
        basedOn: outline.revision,
        edits: [{ op: "setHeader", fields: { city: "Hanoi" } }],
      })) as { editId: string }
      await run("paper.revertEdit", { docId: cv, editId: edited.editId })
      await run("paper.sync", {
        docId: cv,
        epoch: 0,
        update: "",
        stateVector: "",
      })
      const beforeFavorite = paperQueries["paper.get"].output.parse(
        await read("paper.get", { docId: cv })
      )
      expect(beforeFavorite.isFavorite).toBe(false)
      await run("paper.setFavorite", { docId: cv, isFavorite: true })
      const favorite = await read("paper.get", { docId: cv })
      expect(favorite).toEqual({ ...beforeFavorite, isFavorite: true })
      await expect(
        registry.execute({
          name: "paper.setFavorite",
          input: { docId: cv, isFavorite: false },
          actor: personActor("user-paper-outsider"),
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
      const copy = idOf(await run("paper.duplicate", { docId: cv }))
      await run("paper.setTemplate", { docId: cv, templateId: "modern" })
      await run("paper.setStatus", { docId: cv, status: "ready" })
      await run("paper.keepTwoPages", { docId: cv })
      await run("paper.share", { docId: cv })
      const upload = await saveFile({
        userId: parseUserId(userId),
        name: "cv.txt",
        mediaType: "text/plain",
        bytes: Buffer.from("not json"),
        purpose: "import",
      })
      const photo = await saveFile({
        userId: parseUserId(userId),
        name: "face.png",
        mediaType: "image/png",
        bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        purpose: "avatar",
      })
      await run("paper.attachPhoto", { docId: cv, fileId: photo.id })
      const importedResult = await registry.execute({
        name: "paper.import",
        input: { fileId: upload.id },
        actor: person,
      })
      const imported = idOf(
        catalog["paper.import"].publicResult.parse(importedResult.output)
      )
      await run("paper.dismissCheck", { docId: imported, checkId: "import" })

      const list = await read("paper.list", {})
      expect(list).toHaveLength(4)
      await read("paper.list", { kind: "letter", query: "untitled" })
      const got = (await read("paper.get", { docId: cv })) as {
        name: string
        templateId: string
        pageChoice: string
      }
      expect(got).toMatchObject({
        name: "Ada CV",
        templateId: "modern",
        pageChoice: "keep",
      })
      await read("paper.pageCount", { docId: cv })
      const shared = (await registry.read(
        "paper.shared",
        {
          token: (
            (await run("paper.share", { docId: cv })) as { token: string }
          ).token,
        },
        personActor("public")
      )) as unknown
      expect(shared).not.toHaveProperty("isFavorite")
      expect(
        paperQueries["paper.shared"].output.safeParse(shared).success
      ).toBe(true)
      seen.add("paper.shared")
      await read("paper.files", {})
      await read("file.get", { fileId: upload.id })
      const job = await registry.execute({
        name: "job.create",
        input: { title: "Dev", company: "Contoso" },
        actor: person,
      })
      await read("paper.keywordGap", { docId: letter, jobId: idOf(job.output) })

      await run("paper.unshare", { docId: cv })
      await run("paper.delete", { docId: copy })
      await run("paper.deleteFile", { fileId: upload.id })
      await run("paper.canvas", { op: "mint" })

      expect([...seen].sort()).toEqual(
        [...Object.keys(paperContract), ...Object.keys(paperQueries)].sort()
      )
    })
    await client.close()
  })

  it("keeps the contract policy and the registry on the same names", () => {
    const registered = new Map(
      installRegistry()
        .list()
        .commands.map((command) => [command.name, command])
    )
    for (const name of Object.keys(paperContract)) {
      expect(registered.get(name), name).toMatchObject({
        coach: commands[name as keyof typeof paperContract].coach,
        destructive: commands[name as keyof typeof paperContract].destructive,
      })
    }
  })

  it("refuses a Coach write to any document, including a letter, while Tailored CVs is off, and allows it when on", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-paper-cvs-gate"
    await seed(userId, db)
    const person = personActor(userId)

    await withDatabase(db, async () => {
      const chat = await registry.execute({
        name: "chat.create",
        input: {},
        actor: person,
      })
      const coach = await seedCoachActor(userId, idOf(chat.output))
      const tool = (await registry.tools(coach)).find(
        (entry) => entry.name === "paper.import"
      )
      if (!tool) throw new Error("Missing Coach import tool")
      const toolSchema = z.toJSONSchema(tool.input, {
        io: "input",
        reused: "ref",
      })
      expect(toolSchema).toMatchObject({ type: "object" })
      for (const combinator of ["anyOf", "oneOf", "allOf"])
        expect(toolSchema).not.toHaveProperty(combinator)
      const cv = idOf(
        (
          await registry.execute({
            name: "paper.create",
            input: { kind: "cv" },
            actor: person,
          })
        ).output
      )
      const letter = idOf(
        (
          await registry.execute({
            name: "paper.create",
            input: { kind: "letter" },
            actor: person,
          })
        ).output
      )
      const edit = (docId: string, text: string) =>
        registry.execute({
          name: "paper.edit",
          input: {
            docId,
            basedOn: 1,
            edits: [{ op: "setHeader", fields: { name: text } }],
          },
          actor: coach,
        })

      const allowed = await edit(cv, "Ada")
      expect(allowed.pending).toBe(true)
      const pendingId = allowed.pendingActionId
      if (!pendingId) throw new Error("missing confirmation")
      const before = (await registry.read(
        "paper.outline",
        { docId: cv },
        person
      )) as { revision: number }
      expect(before.revision).toBe(1)
      const approved = await registry.approve(userId, pendingId)
      expect(approved?.command).toBe("paper.edit")
      const after = (await registry.read(
        "paper.outline",
        { docId: cv },
        person
      )) as { revision: number }
      expect(after.revision).toBe(2)

      await db.update(user).set({ agentCvs: false }).where(eq(user.id, userId))
      await expect(edit(cv, "Grace")).rejects.toMatchObject({
        code: "COACH_NOT_ALLOWED",
      })
      await expect(
        registry.execute({
          name: "paper.edit",
          input: {
            docId: letter,
            basedOn: 1,
            edits: [
              {
                op: "insert",
                after: "@start",
                blocks: [{ type: "paragraph", text: "Hello" }],
              },
            ],
          },
          actor: coach,
        })
      ).rejects.toMatchObject({ code: "COACH_NOT_ALLOWED" })
      const byPerson = await registry.execute({
        name: "paper.edit",
        input: {
          docId: letter,
          basedOn: 1,
          edits: [{ op: "setText", blockId: "letter-1", text: "Hello" }],
        },
        actor: person,
      })
      expect(byPerson.output).toMatchObject({ revision: 2 })
    })
    await client.close()
  })
})
