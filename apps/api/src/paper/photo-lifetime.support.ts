import { randomUUID } from "node:crypto"

import { parseUserId, personActor } from "@workspace/domain"
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm"
import fc from "fast-check"
import { expect } from "vitest"

import { withDatabase } from "../db/context.js"
import {
  activity,
  chats,
  files,
  idempotency,
  paperDocs,
  paperDocUpdates,
  pendingActions,
  user,
} from "../db/schema.js"
import { CommandError } from "../registry/errors.js"
import { installRegistry } from "../registry/install.js"
import { twoParagraphCv } from "../test/paper-content.js"
import {
  openBackend,
  REAL,
  SEED,
  type Backend,
} from "../test/registry-formal-support.js"
import { saveFile } from "./store.js"
import { sweepUnattachedPhotos } from "./photo-sweep.js"

export const USER = "user-photo-formal"
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
export const DAY = 24 * 60 * 60 * 1000
export const RUNS = Number(process.env.PHOTO_MODEL_RUNS ?? 8)

type Doc = { id: string; contentVersion: number }
type Model = { docs: Doc[]; files: string[]; activities: string[] }
type Real = { userId: string }

let backend: Backend
let registry: ReturnType<typeof installRegistry>

export function inDb<T>(fn: () => Promise<T>) {
  return withDatabase(backend.db, fn)
}

function conflict(error: unknown) {
  return error instanceof CommandError && error.code === "CONFLICT"
}

function lower(id: string) {
  return id.toLowerCase()
}

export function listed(ids: string[], id: string) {
  return ids.some((item) => lower(item) === lower(id))
}

function collect(text: string, bare: boolean, into: Set<string>) {
  if (
    bare &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
  ) {
    into.add(lower(text))
    return
  }
  const fileRef =
    /file:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi
  const fileField =
    /"fileId"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/gi
  for (const match of text.matchAll(fileRef)) into.add(lower(match[1]!))
  for (const match of text.matchAll(fileField)) into.add(lower(match[1]!))
}

export function textOf(value: unknown) {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function stripped(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return textOf(value)
  }
  const copy = { ...(value as Record<string, unknown>) }
  for (const key of keys) delete copy[key]
  return JSON.stringify(copy)
}

function withoutPrevious(value: unknown) {
  return stripped(value, ["previousDocument", "previousPaper"])
}

function activityResultText(value: unknown) {
  return stripped(value, [
    "document",
    "paper",
    "previousDocument",
    "previousPaper",
  ])
}

export async function reset() {
  await backend.db.execute(sql`
    truncate table
      opencv_app.photo_refs,
      opencv_app.paper_doc_updates,
      opencv_app.paper_shares,
      opencv_app.pending_actions,
      opencv_app.activity,
      opencv_app.idempotency,
      opencv_app.paper_docs,
      opencv_app.files,
      opencv_app.chats
    restart identity cascade
  `)
  const existing = await backend.db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, USER))
  if (existing.length === 0) {
    await backend.db.insert(user).values({
      id: USER,
      name: "Ada",
      email: "user-photo-formal@example.com",
    })
    return
  }
  await backend.db.update(user).set({ image: null }).where(eq(user.id, USER))
}

export async function run(name: string, input: unknown) {
  return inDb(() => registry.execute({ name, input, actor: personActor(USER) }))
}

export async function upload() {
  const saved = await inDb(() =>
    saveFile({
      userId: parseUserId(USER),
      name: "face.png",
      mediaType: "image/png",
      bytes: png,
      purpose: "avatar",
    })
  )
  return lower(saved.id)
}

export async function createDoc() {
  const created = await run("paper.create", {
    kind: "cv",
    name: "CV",
    document: twoParagraphCv,
  })
  return (created.output as { id: string }).id
}

export async function age(ids: string[]) {
  if (ids.length === 0) return
  await backend.db
    .update(files)
    .set({ createdAt: new Date(Date.now() - 2 * DAY) })
    .where(inArray(files.id, ids))
}

export function sweep(now = new Date()) {
  return inDb(() => sweepUnattachedPhotos(now))
}

export async function fileSet() {
  const rows = await backend.db.select({ id: files.id }).from(files)
  return new Set(rows.map((row) => lower(row.id)))
}

export async function referenced(options: { legacy: boolean }) {
  const into = new Set<string>()
  const papers = await backend.db
    .select({
      id: paperDocs.id,
      document: paperDocs.document,
      crdt: paperDocs.crdtDocument,
    })
    .from(paperDocs)
  const paperIds = new Set(papers.map((paper) => paper.id))
  for (const paper of papers) {
    collect(textOf(paper.document), false, into)
    if (!options.legacy && paper.crdt) collect(textOf(paper.crdt), false, into)
  }
  const acts = await backend.db
    .select({
      reversalInput: activity.reversalInput,
      result: activity.result,
      undoneAt: activity.undoneAt,
    })
    .from(activity)
  for (const row of acts) {
    if (row.undoneAt) continue
    const reversal = row.reversalInput as { docId?: string } | null
    const docId =
      reversal && typeof reversal === "object" ? reversal.docId : undefined
    if (!docId || paperIds.has(docId)) {
      collect(textOf(row.reversalInput), false, into)
    }
    if (!options.legacy) collect(activityResultText(row.result), false, into)
  }
  if (!options.legacy) {
    const pending = await backend.db
      .select({
        input: pendingActions.input,
        status: pendingActions.status,
      })
      .from(pendingActions)
    for (const row of pending) {
      if (row.status !== "pending") continue
      collect(textOf(row.input), false, into)
    }
    const stored = await backend.db
      .select({ result: idempotency.result })
      .from(idempotency)
    for (const row of stored) collect(withoutPrevious(row.result), false, into)
    const updates = await backend.db.execute<{ text: string | null }>(sql`
      select encode(u.update, 'escape') as text
      from opencv_app.paper_doc_updates u
      join opencv_app.paper_docs d on d.id = u.paper_id
      where d.crdt_document is null
    `)
    for (const row of updates.rows) {
      if (row.text) collect(row.text, false, into)
    }
    const released = await backend.db
      .select({ ids: paperDocUpdates.releasedPhotoRefs })
      .from(paperDocUpdates)
    for (const row of released) {
      for (const id of row.ids ?? []) into.add(lower(id))
    }
  }
  const people = await backend.db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, USER))
  const image = people[0]?.image
  if (image) collect(image, true, into)
  return into
}

export async function assertLive(swept: boolean) {
  const wanted = await referenced({ legacy: false })
  const present = await fileSet()
  for (const id of wanted) {
    expect(present.has(id), `F1 ${id}`).toBe(true)
  }
  if (!swept) return
  const cutoff = new Date(Date.now() - DAY)
  const rows = await backend.db
    .select({
      id: files.id,
      createdAt: files.createdAt,
      purpose: files.purpose,
    })
    .from(files)
  for (const row of rows) {
    if (row.purpose !== "avatar" || row.createdAt >= cutoff) continue
    expect(wanted.has(lower(row.id)), `F3 ${row.id}`).toBe(true)
  }
}

async function reload(model: Model) {
  const docs = await backend.db
    .select({ id: paperDocs.id, contentVersion: paperDocs.contentVersion })
    .from(paperDocs)
  const stored = await backend.db.select({ id: files.id }).from(files)
  const acts = await backend.db
    .select({ id: activity.id })
    .from(activity)
    .where(
      and(
        eq(activity.userId, USER),
        isNull(activity.undoneAt),
        isNotNull(activity.reversalCommand)
      )
    )
  model.docs = docs
  model.files = stored.map((row) => lower(row.id))
  model.activities = acts.map((row) => row.id)
}

function command(
  name: string,
  check: (model: Readonly<Model>) => boolean,
  act: (model: Model) => Promise<void>
): fc.AsyncCommand<Model, Real> {
  return {
    check,
    async run(model) {
      await act(model)
      await reload(model)
      await assertLive(name === "sweep")
    },
    toString: () => name,
  }
}

export const commands = [
  () =>
    command(
      "upload",
      (model) => model.files.length < 3,
      async () => {
        await upload()
      }
    ),
  () =>
    command(
      "create",
      (model) => model.docs.length < 2,
      async () => {
        await createDoc()
      }
    ),
  () =>
    command(
      "attach",
      (model) => model.docs.length > 0 && model.files.length > 0,
      async (model) => {
        await run("paper.attachPhoto", {
          docId: model.docs[0]!.id,
          fileId: model.files[0]!,
        })
      }
    ),
  () =>
    command(
      "clear",
      (model) => model.docs.length > 0,
      async (model) => {
        await run("paper.attachPhoto", {
          docId: model.docs[0]!.id,
          fileId: null,
        })
      }
    ),
  () =>
    command(
      "undo",
      (model) => model.activities.length > 0,
      async (model) => {
        try {
          await run("activity.undo", {
            activityId: model.activities[model.activities.length - 1]!,
          })
        } catch (error) {
          if (!conflict(error)) throw error
        }
      }
    ),
  () =>
    command(
      "duplicate",
      (model) => model.docs.length > 0 && model.docs.length < 3,
      async (model) => {
        await run("paper.duplicate", { docId: model.docs[0]!.id })
      }
    ),
  () =>
    command(
      "delete",
      (model) => model.docs.length > 0,
      async (model) => {
        await run("paper.delete", { docId: model.docs[0]!.id })
      }
    ),
  () =>
    command(
      "confirm",
      (model) => model.docs.length > 0 && model.files.length > 0,
      async (model) => {
        const chatId = randomUUID()
        const pendingId = randomUUID()
        await backend.db.insert(chats).values({
          id: chatId,
          userId: USER,
          title: "Photo",
        })
        await backend.db.insert(pendingActions).values({
          id: pendingId,
          userId: USER,
          chatId,
          command: "paper.attachPhoto",
          input: { docId: model.docs[0]!.id, fileId: model.files[0]! },
          summary: "Attach the photo",
        })
        try {
          await inDb(() => registry.approve(USER, pendingId))
        } catch (error) {
          if (!conflict(error)) throw error
        }
      }
    ),
  () =>
    command(
      "sync",
      (model) => model.docs.length > 0,
      async (model) => {
        await run("paper.sync", {
          docId: model.docs[0]!.id,
          epoch: 0,
          update: "",
          stateVector: "",
        })
      }
    ),
  () =>
    command(
      "age",
      (model) => model.files.length > 0,
      async (model) => {
        await age(model.files)
      }
    ),
  () =>
    command(
      "sweep",
      () => true,
      async () => {
        await sweep()
      }
    ),
]

export function photoDb() {
  return backend.db
}

export async function startPhotoLifetime() {
  backend = await openBackend()
  registry = installRegistry()
  await reset()
}

export async function stopPhotoLifetime() {
  await backend.close()
}

export { REAL, SEED }
