import { readFile } from "node:fs/promises"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { parseChatId, parseUserId, personActor } from "@workspace/domain"
import { drizzle } from "drizzle-orm/pglite"
import { expect, it, vi } from "vitest"

import { withDatabase } from "../db/context.js"
import { migrationsFolder } from "../db/paths.js"
import * as schema from "../db/schema.js"
import { createId } from "../id.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "../test/harness.js"
import { journalTags } from "../test/migration-journal.js"
import { createChat, getChat, insertCoachMessage } from "./store.js"

const tags = journalTags()

function deferred() {
  let resolve = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

it.each(["Usable answer", ""])(
  "keeps legacy reply %j and every receipt through migration and regeneration",
  async (answer) => {
    const client = new PGlite()
    installRegistry()
    try {
      for (const tag of tags.slice(0, 2)) {
        await client.exec(
          await readFile(path.join(migrationsFolder, `${tag}.sql`), "utf8")
        )
      }
      const userId = parseUserId("legacy-revisions")
      const chatId = parseChatId(createId())
      await client.query(
        'INSERT INTO opencv_app."user" (id, name, email) VALUES ($1, $2, $3)',
        [userId, "Ada", "legacy@example.com"]
      )
      await client.query(
        "INSERT INTO opencv_app.chats (id, user_id, title) VALUES ($1, $2, $3)",
        [chatId, userId, "Legacy"]
      )
      const ids = Array.from({ length: 4 }, () => createId())
      const texts = ["Help", answer, "", "  \n"]
      for (const [index, id] of ids.entries()) {
        const parts =
          index > 0
            ? [
                {
                  type: "tool",
                  name: "job_list",
                  summary: `Receipt ${index}`,
                  ok: true,
                },
              ]
            : []
        await client.query(
          "INSERT INTO opencv_app.chat_messages (id, chat_id, role, text, parts, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [
            id,
            chatId,
            index === 0 ? "person" : "coach",
            texts[index],
            JSON.stringify(parts),
            index === 2 ? "aborted" : index === 3 ? "error" : "final",
            new Date(1700000000000 + index),
          ]
        )
        if (index > 0)
          await client.query(
            "INSERT INTO opencv_app.coach_usage (id,user_id,chat_id,message_id,plan,mode,provider,model) VALUES ($1,$2,$3,$4,'free','free','fake','fake')",
            [createId(), userId, chatId, id]
          )
      }
      await client.exec(
        await readFile(path.join(migrationsFolder, `${tags[2]}.sql`), "utf8")
      )
      await client.exec(
        await readFile(path.join(migrationsFolder, `${tags[6]}.sql`), "utf8")
      )
      const db = drizzle({ client, schema })
      await withDatabase(db, async () => {
        const detail = await getChat(userId, chatId)
        expect(detail.messages.map((message) => message.text)).toEqual([
          "Help",
          answer || "  \n",
        ])
        expect(
          detail.messages[1]?.parts.map((part) =>
            part.type === "tool" ? part.summary : null
          )
        ).toEqual(["Receipt 1", "Receipt 2", "Receipt 3"])
        const saved = await insertCoachMessage({
          userId,
          chatId,
          text: "Replacement",
          parts: [],
          status: "final",
          workedMs: 1,
          supersedesMessageId: detail.messages[1]!.id,
        })
        expect(
          (await getChat(userId, chatId)).messages.map((message) => message.id)
        ).toEqual([ids[0], saved?.id])
        expect((await getChat(userId, chatId)).messages[1]?.parts).toHaveLength(
          3
        )
      })
      expect(
        (
          await client.query(
            "SELECT message_id FROM opencv_app.coach_usage ORDER BY message_id"
          )
        ).rows
      ).toEqual(
        ids
          .slice(1)
          .sort()
          .map((message_id) => ({ message_id }))
      )
      expect(
        (await client.query("SELECT id FROM opencv_app.chat_messages")).rows
      ).toHaveLength(5)
    } finally {
      await client.close()
    }
  }
)

it("returns each committed reply identity when another regeneration supersedes it before the save returns", async () => {
  const { db, client } = await createMigratedTestDb()
  installRegistry()
  try {
    const userId = parseUserId("concurrent-revisions")
    await db
      .insert(schema.user)
      .values({ id: userId, name: "Ada", email: "concurrent@example.com" })
    await withDatabase(db, async () => {
      const chat = await createChat(personActor(userId))
      const chatId = parseChatId(chat.id)
      const input = {
        userId,
        chatId,
        text: "Original",
        parts: [],
        status: "final" as const,
        workedMs: 1,
      }
      const original = await insertCoachMessage(input)
      const committed = deferred()
      const release = deferred()
      const transact = db.transaction.bind(db)
      const spy = vi
        .spyOn(db, "transaction")
        .mockImplementationOnce(async (...args) => {
          const result = await transact(...args)
          committed.resolve()
          await release.promise
          return result
        })
      const first = insertCoachMessage({
        ...input,
        text: "First",
        supersedesMessageId: original!.id,
      })
      await committed.promise
      let second
      try {
        second = await insertCoachMessage({
          ...input,
          text: "Second",
          supersedesMessageId: original!.id,
        })
      } finally {
        release.resolve()
        spy.mockRestore()
      }
      const firstSaved = await first
      expect(firstSaved?.id).toEqual(expect.any(String))
      expect(firstSaved?.id).not.toBe(second?.id)
      expect(
        (await getChat(userId, chatId)).messages.map((message) => message.text)
      ).toEqual(["Second"])
      expect(await db.select().from(schema.chatMessages)).toHaveLength(3)
    })
  } finally {
    await client.close()
  }
})
