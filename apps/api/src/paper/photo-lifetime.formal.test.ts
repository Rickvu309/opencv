import { randomUUID } from "node:crypto"

import { parseUserId } from "@workspace/domain"
import { eq, sql } from "drizzle-orm"
import { Pool } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { deleteAccount } from "../account/store.js"
import {
  activity,
  chats,
  idempotency,
  paperDocs,
  pendingActions,
  user,
} from "../db/schema.js"
import { REAL } from "../test/registry-formal-support.js"
import {
  age,
  assertLive,
  createDoc,
  DAY,
  fileSet,
  inDb,
  listed,
  photoDb,
  referenced,
  reset,
  run,
  startPhotoLifetime,
  stopPhotoLifetime,
  sweep,
  textOf,
  upload,
  USER,
} from "./photo-lifetime.support.js"

describe("photo lifetime", () => {
  beforeAll(async () => {
    await startPhotoLifetime()
  }, 30_000)

  afterAll(async () => {
    await stopPhotoLifetime()
  })

  beforeEach(async () => {
    await reset()
  })

  it("keeps a photo that only the CRDT document still names", async () => {
    const docId = await createDoc()
    const fileId = await upload()
    await run("paper.attachPhoto", { docId, fileId })
    await photoDb().execute(sql`
      update opencv_app.paper_docs
      set document = document #- '{header,photo}'
      where id = ${docId}::uuid
    `)
    await photoDb().execute(sql`
      update opencv_app.activity
      set result = '{}'::jsonb, reversal_input = '{}'::jsonb
    `)
    await age([fileId])
    const legacy = await referenced({ legacy: true })
    const live = await referenced({ legacy: false })
    expect(legacy.has(fileId)).toBe(false)
    expect(live.has(fileId)).toBe(true)
    const swept = await sweep()
    expect(listed(swept, fileId)).toBe(false)
    expect((await fileSet()).has(fileId)).toBe(true)
  })

  it("resolves the photo again after undo, and sweeps the replacement", async () => {
    const docId = await createDoc()
    const first = await upload()
    const second = await upload()
    await run("paper.attachPhoto", { docId, fileId: first })
    const replacement = await run("paper.attachPhoto", {
      docId,
      fileId: second,
    })
    await age([first, second])
    expect(listed(await sweep(), first)).toBe(false)
    expect(listed(await sweep(), second)).toBe(false)
    await run("activity.undo", { activityId: replacement.activityId })
    const swept = await sweep()
    expect(listed(swept, second)).toBe(true)
    expect(listed(swept, first)).toBe(false)
    expect((await fileSet()).has(first)).toBe(true)
    const live = await referenced({ legacy: false })
    expect(live.has(first)).toBe(true)
  })

  it("sweeps an unreferenced upload older than a day and keeps a fresh one", async () => {
    const orphan = await upload()
    const fresh = await upload()
    await age([orphan])
    const sweepThatReturnsEarly = () => [] as string[]
    expect(listed(sweepThatReturnsEarly(), orphan)).toBe(false)
    expect((await fileSet()).has(orphan)).toBe(true)
    const swept = await sweep()
    expect(swept).toEqual([orphan])
    expect((await fileSet()).has(fresh)).toBe(true)
    expect((await fileSet()).has(orphan)).toBe(false)
    await assertLive(true)
  })

  it("keeps the copy's photo after the original document is deleted", async () => {
    const docId = await createDoc()
    const fileId = await upload()
    await run("paper.attachPhoto", { docId, fileId })
    const copy = await run("paper.duplicate", { docId })
    const copyId = (copy.output as { id: string }).id
    await run("paper.delete", { docId })
    await age([fileId])
    expect(listed(await sweep(), fileId)).toBe(false)
    expect((await fileSet()).has(fileId)).toBe(true)
    const papers = await photoDb()
      .select({ document: paperDocs.document })
      .from(paperDocs)
      .where(eq(paperDocs.id, copyId))
    expect(textOf(papers[0]?.document)).toContain(`file:${fileId}`)
  })

  it("drops the copy photo when its reference row is removed", async () => {
    const docId = await createDoc()
    const fileId = await upload()
    await run("paper.attachPhoto", { docId, fileId })
    await run("paper.duplicate", { docId })
    await run("paper.delete", { docId })
    await age([fileId])
    await photoDb().execute(sql`
      delete from opencv_app.photo_refs where file_id = ${fileId}::uuid
    `)
    expect(listed(await sweep(), fileId)).toBe(true)
    expect((await fileSet()).has(fileId)).toBe(false)
  })

  it("keeps a photo named only by a pending action until that action is closed", async () => {
    const fileId = await upload()
    const docId = await createDoc()
    const chatId = randomUUID()
    const pendingId = randomUUID()
    await photoDb().insert(chats).values({
      id: chatId,
      userId: USER,
      title: "Photo",
    })
    await photoDb().insert(pendingActions).values({
      id: pendingId,
      userId: USER,
      chatId,
      command: "paper.attachPhoto",
      input: { docId, fileId },
      summary: "Attach the photo",
    })
    await age([fileId])
    expect(listed(await sweep(), fileId)).toBe(false)
    await photoDb()
      .update(pendingActions)
      .set({ status: "denied" })
      .where(eq(pendingActions.id, pendingId))
    expect(listed(await sweep(), fileId)).toBe(true)
  })

  it("keeps a photo named only by an activity result", async () => {
    const fileId = await upload()
    await age([fileId])
    await photoDb()
      .insert(activity)
      .values({
        id: randomUUID(),
        userId: USER,
        actor: "person",
        command: "paper.attachPhoto",
        subjectKind: "paper",
        subjectId: randomUUID(),
        summary: "Attached a photo",
        result: { photo: `file:${fileId}` },
      })
    expect(listed(await sweep(), fileId)).toBe(false)
    expect((await fileSet()).has(fileId)).toBe(true)
    await photoDb().execute(sql`
      delete from opencv_app.photo_refs where source like 'activity.%'
    `)
    expect(listed(await sweep(), fileId)).toBe(true)
  })

  it("does not keep a photo that an idempotency result only stored as previousPaper", async () => {
    const kept = await upload()
    const gone = await upload()
    await photoDb()
      .insert(idempotency)
      .values({
        userId: USER,
        key: "restore-photo",
        command: "paper.restore",
        result: {
          document: { header: { photo: `file:${kept}` } },
          previousPaper: { header: { photo: `file:${gone}` } },
        },
      })
    await age([kept, gone])
    const swept = await sweep()
    expect(listed(swept, gone)).toBe(true)
    expect(listed(swept, kept)).toBe(false)
    expect((await fileSet()).has(kept)).toBe(true)
  })

  it("sweeps a replaced photo once its activity is undone", async () => {
    const docId = await createDoc()
    const first = await upload()
    const second = await upload()
    await run("paper.attachPhoto", { docId, fileId: first })
    const replacement = await run("paper.attachPhoto", {
      docId,
      fileId: second,
    })
    await run("activity.undo", { activityId: replacement.activityId })
    await age([second])
    await photoDb().execute(sql`
      insert into opencv_app.photo_refs (user_id, file_id, source)
      values (${USER}, ${second}::uuid, 'activity.result:undone')
    `)
    expect(listed(await sweep(), second)).toBe(false)
    await photoDb().execute(sql`
      delete from opencv_app.photo_refs where source = 'activity.result:undone'
    `)
    expect(listed(await sweep(), second)).toBe(true)
    expect((await fileSet()).has(first)).toBe(true)
  })

  it("deletes the account while a profile photo is still referenced", async () => {
    const fileId = await upload()
    await run("profile.setPhoto", { fileId })
    await inDb(() => deleteAccount(parseUserId(USER)))
    const rows = await photoDb()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, USER))
    expect(rows).toEqual([])
  })

  it.skipIf(!REAL)(
    "an attach that commits during the sweep keeps the photo",
    async () => {
      const docId = await createDoc()
      const fileId = await upload()
      const pool = (photoDb() as unknown as { $client: Pool }).$client
      const holder = await pool.connect()
      try {
        const pid = await holder.query<{ pid: number }>(
          "select pg_backend_pid() as pid"
        )
        await holder.query("begin")
        await holder.query(
          `update opencv_app.paper_docs
           set document = jsonb_set(document, '{header,photo}', to_jsonb($2::text)),
               crdt_document = jsonb_set(
                 coalesce(crdt_document, document),
                 '{header,photo}',
                 to_jsonb($2::text)
               )
           where id = $1::uuid`,
          [docId, `file:${fileId}`]
        )
        const pending = sweep(new Date(Date.now() + 3 * DAY))
        let waiting = false
        for (let attempt = 0; attempt < 40 && !waiting; attempt++) {
          const probe = await pool.connect()
          const locks = await probe.query(
            "select 1 from pg_locks where pid <> $1 and granted = false limit 1",
            [pid.rows[0]!.pid]
          )
          probe.release()
          waiting = (locks.rowCount ?? 0) > 0
          if (waiting) break
          const settled = await Promise.race([
            pending.then(() => true),
            new Promise<boolean>((resolve) => setTimeout(resolve, 25)),
          ])
          if (settled) break
        }
        expect(waiting).toBe(true)
        await holder.query("commit")
        const swept = await pending
        expect(listed(swept, fileId)).toBe(false)
        expect((await fileSet()).has(fileId)).toBe(true)
        await assertLive(true)
      } finally {
        await holder.query("rollback").catch(() => {})
        holder.release()
      }
    },
    20_000
  )
})
