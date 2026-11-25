import {
  catalog,
  commands,
  paperContract,
  personActor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { idOf } from "./coverage-helpers.test-support.js"
import { installRegistry } from "../install.js"
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
    expect(input.safeParse({ fileId }).success).toBe(false)
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
    })
    await client.close()
  })
})
