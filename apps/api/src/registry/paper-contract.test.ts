import {
  commands,
  coachActor,
  emptyCvDocument,
  emptyLetterDocument,
  paperContract,
  paperQueries,
  parseUserId,
  personActor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { saveFile } from "../paper/index.js"
import { createMigratedTestDb } from "../test/harness.js"
import { idOf } from "./coverage-helpers.js"
import { installRegistry } from "./install.js"

async function seed(
  userId: string,
  db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
) {
  await db
    .insert(user)
    .values({ id: userId, name: "Ada", email: `${userId}@example.com` })
}

describe("paper contract", () => {
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
      await run("paper.replace", {
        docId: cv,
        contentVersion: 1,
        document: { ...emptyCvDocument(), name: "Ada Lane" },
      })
      await run("paper.rename", { docId: cv, name: "Ada CV" })
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
      const imported = idOf(await run("paper.import", { fileId: upload.id }))
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
      await read("paper.pdf", { docId: cv })
      const shared = (await registry.read(
        "paper.shared",
        {
          token: (
            (await run("paper.share", { docId: cv })) as { token: string }
          ).token,
        },
        personActor("public")
      )) as unknown
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

  it("refuses a Coach write to any document while Tailored CVs is off, and allows it when on", async () => {
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
      const coach = coachActor(userId, idOf(chat.output))
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
      const replace = (docId: string, document: unknown, contentVersion = 1) =>
        registry.execute({
          name: "paper.replace",
          input: { docId, contentVersion, document },
          actor: coach,
        })

      const allowed = await replace(cv, { ...emptyCvDocument(), name: "Ada" })
      expect(allowed.output).toMatchObject({ contentVersion: 2 })

      await db.update(user).set({ agentCvs: false }).where(eq(user.id, userId))
      for (const [docId, document] of [
        [cv, emptyCvDocument()],
        [letter, { ...emptyLetterDocument(), markdown: "Hello" }],
      ] as const) {
        await expect(replace(docId, document, 2)).rejects.toMatchObject({
          code: "COACH_NOT_ALLOWED",
        })
      }
      const byPerson = await registry.execute({
        name: "paper.replace",
        input: {
          docId: letter,
          contentVersion: 1,
          document: { ...emptyLetterDocument(), markdown: "Hello" },
        },
        actor: person,
      })
      expect(byPerson.output).toMatchObject({ contentVersion: 2 })
    })
    await client.close()
  })
})
