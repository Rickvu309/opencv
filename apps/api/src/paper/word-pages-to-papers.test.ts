import { randomUUID } from "node:crypto"

import { personActor } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { expect, it } from "vitest"
import { z } from "zod"

import { withDatabase } from "../db/context.js"
import {
  files,
  paperDocs,
  paperPackageHeads,
  paperPackageTrash,
  paperPackageVersions,
  user,
} from "../db/schema.js"
import { installRegistry } from "../install.js"
import { createMigratedTestDb } from "../test/harness.js"
import { insertWordPage } from "../test/word-page-rows.js"
import { fixturePackage, paragraph } from "./word-package/package-fixtures.js"
import { convertWordPages } from "./word-pages-to-papers.js"

const idOf = z.object({ id: z.string() })

it("turns a Word page into a Paper at the same address, keeps its Job link and original file, and makes no second copy", async () => {
  const { db, client } = await createMigratedTestDb()
  const userId = "user-word-pages-become-papers"
  await db
    .insert(user)
    .values({ id: userId, name: "Ada", email: `${randomUUID()}@test.invalid` })
  const registry = installRegistry()
  const person = personActor(userId)
  try {
    await withDatabase(db, async () => {
      const { docId } = await insertWordPage(db, {
        userId,
        name: "Ada CV",
        kind: "cv",
        bytes: fixturePackage(paragraph("Kept words from the Word page")),
      })
      const job = idOf.parse(
        (
          await registry.execute({
            name: "job.create",
            input: { title: "Analyst", company: "Northwind" },
            actor: person,
          })
        ).output
      ).id
      await registry.execute({
        name: "job.linkPaper",
        input: { jobId: job, docId, kind: "cv" },
        actor: person,
      })

      expect(await convertWordPages()).toEqual({
        converted: [docId],
        unreadable: [],
      })

      expect(
        await registry.read(
          "paper.read",
          { view: "info", docId, writer: RICH_NATIVE_WRITER },
          person
        )
      ).toMatchObject({ id: docId, name: "Ada CV", kind: "cv", format: "rich" })
      expect(
        JSON.stringify(await registry.read("paper.outline", { docId }, person))
      ).toContain("Kept words from the Word page")
      expect(
        await registry.read("job.get", { jobId: job }, person)
      ).toMatchObject({ linked: { cv: { id: docId, name: "Ada CV" } } })
      expect(
        (
          (await registry.read(
            "paper.list",
            { writer: RICH_NATIVE_WRITER },
            person
          )) as { id: string; format?: string }[]
        ).map((item) => [item.id, item.format])
      ).toEqual([[docId, "rich"]])

      expect(await convertWordPages()).toEqual({
        converted: [],
        unreadable: [],
      })
      expect(await db.select().from(paperDocs)).toHaveLength(1)

      await registry.execute({
        name: "paper.delete",
        input: { docId },
        actor: person,
      })
      expect(await db.select().from(paperDocs)).toEqual([])
      expect(await db.select().from(paperPackageHeads)).toEqual([])
      expect(
        (await db.select().from(paperPackageTrash)).map((row) => [
          row.docId,
          row.linkedJobs,
        ])
      ).toEqual([[docId, [job]]])
      expect(await convertWordPages()).toEqual({
        converted: [],
        unreadable: [],
      })
      expect(
        await registry.read(
          "paper.list",
          { writer: RICH_NATIVE_WRITER },
          person
        )
      ).toEqual([])
      expect(await db.select().from(paperPackageVersions)).toHaveLength(1)
      expect(
        (await db.select().from(files)).map((file) => file.purpose)
      ).toEqual(["package"])
    })
  } finally {
    await client.close()
  }
})
